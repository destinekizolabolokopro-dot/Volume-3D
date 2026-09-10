'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { classerVoix, decouperPourLaVoix, type VoixOfferte } from '@/lib/voix';

/**
 * Écouter la réponse, et dicter la question.
 *
 * Tout vient du navigateur — aucune clé, aucune facture, et surtout : ce qui
 * est dicté ne transite chez personne. Quelqu'un qui dit à voix haute « mon
 * locataire ne paie plus depuis trois mois » confie quelque chose ; l'envoyer
 * à un prestataire de plus pour le seul confort d'une plus jolie voix serait
 * un mauvais échange.
 *
 * Le prix à payer est assumé : la qualité dépend de la machine du visiteur, et
 * la dictée n'existe pas sur Firefox. D'où la règle tenue partout ici — quand
 * la fonction manque, le bouton n'apparaît pas. Un bouton qui ne fait rien est
 * pire que pas de bouton.
 */

const MEMOIRE = 'jur-voix';

/**
 * « Ce navigateur sait-il le faire ? », posé APRÈS le montage.
 *
 * Tester `window` pendant le rendu paraît naturel et casse l'hydratation : le
 * serveur ne connaît pas `window`, il rend donc l'absence du bouton, le client
 * le connaît et rend le bouton, et React constate que les deux arbres
 * diffèrent. Il jette alors tout et refait le rendu — avec, au passage, une
 * erreur en console que personne ne comprend six mois plus tard.
 *
 * Le premier rendu client doit donc être IDENTIQUE à celui du serveur : rien.
 * L'effet ne s'exécutant qu'après, c'est lui qui décide d'afficher.
 */
function useDisponible(test: () => boolean): boolean {
  const [disponible, setDisponible] = useState(false);
  useEffect(() => setDisponible(test()), [test]);
  return disponible;
}

function synthese(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/**
 * Les voix disponibles, une fois que le navigateur les connaît.
 *
 * `getVoices()` renvoie une liste VIDE au premier appel sur presque tous les
 * navigateurs : elles sont chargées de façon asynchrone et l'événement
 * `voiceschanged` les annonce. Sans cet écouteur, la liste reste vide pour
 * quiconque ouvre la page assez vite — c'est le piège classique de cette API.
 */
function useVoix() {
  const [voix, setVoix] = useState<VoixOfferte[]>([]);
  const [choisie, setChoisie] = useState('');

  useEffect(() => {
    const moteur = synthese();
    if (!moteur) return;

    const relire = () => {
      const offertes = classerVoix(moteur.getVoices());
      setVoix(offertes);
      setChoisie((actuelle) => {
        if (actuelle && offertes.some((v) => v.nom === actuelle)) return actuelle;
        let retenue = '';
        try {
          retenue = window.localStorage.getItem(MEMOIRE) ?? '';
        } catch {
          /* Navigation privée, ou stockage refusé : on retombe sur le défaut. */
        }
        if (retenue && offertes.some((v) => v.nom === retenue)) return retenue;
        return offertes[0]?.nom ?? '';
      });
    };

    relire();
    moteur.addEventListener('voiceschanged', relire);
    return () => moteur.removeEventListener('voiceschanged', relire);
  }, []);

  const retenir = useCallback((nom: string) => {
    setChoisie(nom);
    try {
      window.localStorage.setItem(MEMOIRE, nom);
    } catch {
      /* Le choix vaut alors pour la session, ce qui est déjà l'essentiel. */
    }
  }, []);

  return { voix, choisie, retenir };
}

export function Lecture({ texte }: { texte: string }) {
  const disponible = useDisponible(() => synthese() !== null);
  const { voix, choisie, retenir } = useVoix();
  const [enCours, setEnCours] = useState(false);
  const arreteRef = useRef(false);

  /* Une voix qui continue de parler après qu'on a quitté la page est une
     nuisance dont le visiteur ne comprend pas l'origine. */
  useEffect(() => () => synthese()?.cancel(), []);

  const arreter = useCallback(() => {
    arreteRef.current = true;
    synthese()?.cancel();
    setEnCours(false);
  }, []);

  const lire = useCallback(() => {
    const moteur = synthese();
    if (!moteur) return;

    moteur.cancel();
    arreteRef.current = false;

    const morceaux = decouperPourLaVoix(texte);
    if (morceaux.length === 0) return;

    const laVoix = moteur.getVoices().find((v) => v.name === choisie) ?? null;
    setEnCours(true);

    /* Les morceaux sont enfilés un par un plutôt que tous d'un coup : au-delà
       de quelques centaines de caractères, plusieurs navigateurs s'arrêtent en
       cours de phrase sans lever d'erreur ni prévenir. */
    const dire = (rang: number) => {
      if (arreteRef.current || rang >= morceaux.length) {
        setEnCours(false);
        return;
      }
      const enonce = new SpeechSynthesisUtterance(morceaux[rang]);
      if (laVoix) enonce.voice = laVoix;
      enonce.lang = laVoix?.lang ?? 'fr-FR';
      enonce.rate = 1;
      enonce.onend = () => dire(rang + 1);
      /* Une panne au milieu ne doit pas laisser le bouton bloqué sur
         « Arrêter » : on rend la main plutôt que d'insister. */
      enonce.onerror = () => setEnCours(false);
      moteur.speak(enonce);
    };

    dire(0);
  }, [texte, choisie]);

  if (!disponible) return null;

  return (
    <div className="jur-voix">
      <button type="button" className="jur-voix-bouton" onClick={enCours ? arreter : lire}>
        <span aria-hidden="true">{enCours ? '■' : '▶'}</span>
        {enCours ? 'Arrêter' : 'Écouter la réponse'}
      </button>

      {voix.length > 1 && (
        <label className="jur-voix-choix">
          <span className="sr-only">Voix de lecture</span>
          <select value={choisie} onChange={(ev) => retenir(ev.target.value)} disabled={enCours}>
            {voix.map((v) => (
              <option key={v.nom} value={v.nom}>
                {v.libelle}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/* ================================================================ la dictée === */

/** Le constructeur, préfixé sur les navigateurs fondés sur Chromium. */
function reconnaissance(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  const fenetre = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return fenetre.SpeechRecognition ?? fenetre.webkitSpeechRecognition ?? null;
}

/**
 * Le bouton de dictée.
 *
 * `onTexte` reçoit une FONCTION de mise à jour, pas un texte : la dictée
 * s'ajoute à ce qui est déjà écrit au lieu de l'effacer. C'est ce que fait
 * quelqu'un qui a tapé trois lignes, bute sur une phrase et appuie sur le
 * micro pour la finir — recevoir un texte tout fait lui aurait pris les trois
 * lignes. `setState` de React accepte cette forme telle quelle, donc l'appel
 * reste `onTexte={setBrouillon}`.
 */
export function Dictee({
  onTexte,
  actif,
}: {
  onTexte: (maj: (precedent: string) => string) => void;
  actif: boolean;
}) {
  const disponible = useDisponible(() => reconnaissance() !== null);
  const [ecoute, setEcoute] = useState(false);
  const [refus, setRefus] = useState('');
  const sessionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => () => sessionRef.current?.abort(), []);

  const basculer = useCallback(() => {
    if (ecoute) {
      sessionRef.current?.stop();
      return;
    }

    const Moteur = reconnaissance();
    if (!Moteur) return;

    const session = new Moteur();
    session.lang = 'fr-FR';
    session.continuous = true;
    /* Les résultats provisoires remontent au fur et à mesure : voir le texte
       apparaître pendant qu'on parle est ce qui distingue une dictée d'une
       boîte noire dont on ne sait pas si elle entend. */
    session.interimResults = true;

    let acquis = '';
    /* Ce qui était écrit avant qu'on parle, saisi au premier résultat et non
       à l'ouverture : le champ peut encore changer entre les deux. Retenu
       ensuite pour toute la session, sans quoi chaque résultat provisoire se
       recollerait derrière le précédent. */
    let socle: string | null = null;

    session.onresult = (evenement) => {
      let provisoire = '';
      for (let i = evenement.resultIndex; i < evenement.results.length; i += 1) {
        const morceau = evenement.results[i][0].transcript;
        if (evenement.results[i].isFinal) acquis += morceau;
        else provisoire += morceau;
      }
      const dicte = (acquis + provisoire).trim();
      onTexte((precedent) => {
        if (socle === null) socle = precedent.trimEnd();
        return socle ? `${socle} ${dicte}` : dicte;
      });
    };

    session.onerror = (evenement) => {
      /* Le seul cas qui mérite un message : le micro a été refusé. Les autres
         — silence, coupure réseau — se voient à ce qu'il ne se passe rien. */
      if (evenement.error === 'not-allowed' || evenement.error === 'service-not-allowed') {
        setRefus('Le micro est bloqué pour ce site. Autorisez-le dans la barre d’adresse.');
      }
      setEcoute(false);
    };
    session.onend = () => setEcoute(false);

    setRefus('');
    sessionRef.current = session;
    session.start();
    setEcoute(true);
  }, [ecoute, onTexte]);

  if (!disponible) return null;

  return (
    <>
      <button
        type="button"
        className={`jur-dictee${ecoute ? ' jur-dictee-active' : ''}`}
        onClick={basculer}
        disabled={!actif}
        aria-pressed={ecoute}
      >
        <span aria-hidden="true">●</span>
        {ecoute ? 'J’écoute…' : 'Dicter'}
      </button>
      {refus && <p className="jur-refus">{refus}</p>}
    </>
  );
}
