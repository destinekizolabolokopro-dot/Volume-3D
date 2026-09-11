'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
const MEMOIRE_MAINS_LIBRES = 'jur-mains-libres';

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

/* ================================================== le mode mains libres === */

/**
 * Mains libres : la réponse se lit toute seule, et le micro s'arme ensuite.
 *
 * C'est la seule fonction de ce site qui demande aux deux moitiés de la voix
 * de se parler — la lecture doit dire quand elle a fini pour que la dictée
 * démarre. Les faire communiquer par des propriétés aurait obligé chaque
 * composant intermédiaire à transporter un état qui ne le regarde pas ; d'où
 * ce contexte, qui ne porte que ça.
 *
 * ── Ce que le mode fait, et ce qu'il ne fait pas ───────────────────────────
 * Il lit la réponse dès qu'elle arrive, puis il ouvre le micro. Il n'envoie
 * PAS la question tout seul : ce serait le dernier pas, et c'est celui qu'il
 * ne faut pas faire. Une question de droit mal entendue et postée sans qu'on
 * l'ait relue produit une réponse à côté, sur un sujet où l'on croit ce qu'on
 * lit. On parle, le texte s'écrit, on l'envoie soi-même.
 *
 * ── Pourquoi le micro ne s'ouvre qu'après la lecture ───────────────────────
 * Parce qu'un micro ouvert pendant que le haut-parleur parle se réentend
 * lui-même, et la réponse se retrouve recopiée dans la question suivante.
 */

interface EtatVoix {
  /** Vrai quand le navigateur sait lire ET écouter : sinon le mode n'existe pas. */
  offert: boolean;
  mainsLibres: boolean;
  basculer(): void;
  /** Incrémenté à chaque fin de lecture. La dictée l'observe pour s'armer. */
  finLecture: number;
  signalerFinLecture(): void;
}

const ContexteVoix = createContext<EtatVoix | null>(null);

/**
 * `propose` dit si le mode a lieu d'être À CET ENDROIT.
 *
 * Il ne suffit pas que le navigateur en soit capable. Le choix est retenu
 * d'une visite à l'autre ; sans ce garde-fou, quelqu'un qui l'avait allumé
 * dans son espace se faisait lire à voix haute les réponses de la vitrine et
 * des fiches publiques, où aucun interrupteur ne s'affiche pour l'éteindre.
 */
export function FournisseurVoix({
  propose = false,
  children,
}: {
  propose?: boolean;
  children: ReactNode;
}) {
  const capable = useDisponible(() => synthese() !== null && reconnaissance() !== null);
  const offert = propose && capable;
  const [mainsLibres, setMainsLibres] = useState(false);
  const [finLecture, setFinLecture] = useState(0);

  /* Le choix est retenu d'une visite à l'autre : quelqu'un qui travaille à la
     voix le fait tous les jours, pas une fois. */
  useEffect(() => {
    try {
      setMainsLibres(window.localStorage.getItem(MEMOIRE_MAINS_LIBRES) === '1');
    } catch {
      /* Stockage refusé : le mode vaut pour la session. */
    }
  }, []);

  const basculer = useCallback(() => {
    setMainsLibres((avant) => {
      const apres = !avant;
      if (!apres) synthese()?.cancel();
      try {
        window.localStorage.setItem(MEMOIRE_MAINS_LIBRES, apres ? '1' : '0');
      } catch {
        /* Idem : la session suffit. */
      }
      return apres;
    });
  }, []);

  const signalerFinLecture = useCallback(() => setFinLecture((n) => n + 1), []);

  const valeur = useMemo(
    () => ({
      offert,
      /* Le réglage retenu ne vaut que là où le mode est proposé. */
      mainsLibres: offert && mainsLibres,
      basculer,
      finLecture,
      signalerFinLecture,
    }),
    [offert, mainsLibres, basculer, finLecture, signalerFinLecture],
  );

  return <ContexteVoix.Provider value={valeur}>{children}</ContexteVoix.Provider>;
}

/**
 * L'état de la voix, ou un état éteint.
 *
 * Il ne lève pas hors du fournisseur : les mêmes composants — le champ, le
 * fil — servent sur la vitrine, où le mode mains libres n'a pas lieu d'être.
 * Un composant qui casse selon l'endroit où on le pose n'est pas réutilisable.
 */
export function useVoixPartagee(): EtatVoix {
  return (
    useContext(ContexteVoix) ?? {
      offert: false,
      mainsLibres: false,
      basculer: () => {},
      finLecture: 0,
      signalerFinLecture: () => {},
    }
  );
}

/** L'interrupteur, posé en tête de l'espace de travail. */
export function InterrupteurVoix() {
  const { offert, mainsLibres, basculer } = useVoixPartagee();
  if (!offert) return null;

  return (
    <div className="jur-mains-libres">
      <button
        type="button"
        role="switch"
        aria-checked={mainsLibres}
        onClick={basculer}
        className={`jur-bascule${mainsLibres ? ' jur-bascule-active' : ''}`}
      >
        <span className="jur-bascule-piste" aria-hidden="true">
          <span className="jur-bascule-pastille" />
        </span>
        <span className="jur-bascule-texte">
          <strong>Mains libres</strong>
          <span>
            {mainsLibres
              ? 'La réponse est lue à voix haute, puis le micro s’ouvre. Vous relisez avant d’envoyer.'
              : 'La réponse se lit à voix haute et le micro s’ouvre tout seul : pour les mains prises.'}
          </span>
        </span>
      </button>
    </div>
  );
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

/**
 * Le bouton d'écoute, et la lecture automatique du mode mains libres.
 *
 * `dernier` marque la réponse la plus récente du fil. Seule celle-là se lit
 * toute seule : sans cette distinction, rouvrir une consultation de six
 * messages déclencherait six lectures en même temps.
 */
export function Lecture({ texte, dernier = false }: { texte: string; dernier?: boolean }) {
  const disponible = useDisponible(() => synthese() !== null);
  const { voix, choisie, retenir } = useVoix();
  const { mainsLibres, signalerFinLecture } = useVoixPartagee();
  const [enCours, setEnCours] = useState(false);
  const arreteRef = useRef(false);
  /* Le texte déjà lu automatiquement. Sans cette mémoire, le moindre rendu —
     un survol, un changement de voix — relancerait la lecture depuis le
     début. */
  const luRef = useRef('');

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
        /* La fin naturelle arme le micro ; une interruption volontaire, non.
           Quelqu'un qui coupe la lecture ne demande pas la parole. */
        if (!arreteRef.current) signalerFinLecture();
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
  }, [texte, choisie, signalerFinLecture]);

  /* La lecture automatique attend que les voix soient chargées : `getVoices()`
     rend une liste vide au premier appel, et lire avant qu'elle arrive donne
     la voix par défaut du système au lieu de celle qu'on a choisie. */
  useEffect(() => {
    if (!mainsLibres || !dernier || !disponible) return;
    if (!texte || luRef.current === texte) return;
    if (voix.length > 0 && !choisie) return;
    luRef.current = texte;
    lire();
  }, [mainsLibres, dernier, disponible, texte, voix.length, choisie, lire]);

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
  const { mainsLibres, finLecture } = useVoixPartagee();
  const [ecoute, setEcoute] = useState(false);
  const [refus, setRefus] = useState('');
  const sessionRef = useRef<SpeechRecognition | null>(null);
  /* `onTexte` change à chaque rendu du parent. Le garder dans une référence
     évite de reconstruire `demarrer` — et donc de relancer l'effet qui arme le
     micro — à chaque frappe au clavier. */
  const onTexteRef = useRef(onTexte);
  onTexteRef.current = onTexte;
  /* La dernière fin de lecture qui a ouvert le micro. */
  const dernierArmementRef = useRef(0);

  useEffect(() => () => sessionRef.current?.abort(), []);

  const arreter = useCallback(() => {
    sessionRef.current?.stop();
  }, []);

  const demarrer = useCallback(() => {
    /* La session précédente est DÉBRANCHÉE avant d'être abandonnée.
    
       `abort()` ne tue pas l'objet sur-le-champ : son `onend` arrive un
       instant plus tard, et il remettait alors `sessionRef` à null — c'est-à-
       dire par-dessus la session qu'on venait d'ouvrir. Le bouton « Arrêter »,
       la fermeture de la page et l'arrêt à l'envoi devenaient des gestes sans
       effet, micro ouvert. */
    const ancienne = sessionRef.current;
    if (ancienne) {
      ancienne.onresult = null;
      ancienne.onerror = null;
      ancienne.onend = null;
      ancienne.abort();
      sessionRef.current = null;
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
      onTexteRef.current((precedent) => {
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
    session.onend = () => {
      sessionRef.current = null;
      setEcoute(false);
    };

    setRefus('');
    sessionRef.current = session;
    try {
      session.start();
      setEcoute(true);
    } catch {
      /* `start()` lève si une session tourne déjà. Rien à dire à l'écran : le
         micro est ouvert, c'est ce qu'on voulait. */
    }
  }, []);

  const basculer = useCallback(() => {
    if (ecoute) arreter();
    else demarrer();
  }, [ecoute, arreter, demarrer]);

  /**
   * Mains libres : le micro s'ouvre quand la lecture finit.
   *
   * L'effet observe le compteur de fins de lecture plutôt qu'un booléen :
   * deux réponses lues à la suite donnent deux valeurs différentes, là où un
   * booléen repassé à vrai n'aurait rien déclenché la seconde fois.
   *
   * Le premier armement d'une page suit toujours un clic — celui de
   * l'interrupteur, ou celui du bouton d'envoi. C'est ce qui permet au
   * navigateur d'ouvrir le micro sans redemander l'autorisation.
   */
  useEffect(() => {
    if (finLecture === 0 || !mainsLibres || !actif || !disponible) return;
    /* Une seule ouverture par fin de lecture. L'effet dépend aussi de `actif`,
       qui bascule à chaque envoi : sans cette mémoire, le micro se rouvrait à
       chaque retour du champ, avec un compteur inchangé — c'est-à-dire
       PENDANT que la réponse suivante était lue à voix haute, et le
       haut-parleur se réentendait dans le micro. */
    if (finLecture === dernierArmementRef.current) return;
    dernierArmementRef.current = finLecture;
    demarrer();
  }, [finLecture, mainsLibres, actif, disponible, demarrer]);

  /* Le champ se ferme pendant l'envoi : le micro se ferme avec lui.
  
     La reconnaissance est `continuous`, donc elle continuait d'écrire APRÈS
     l'envoi — dans un champ qu'on venait de vider, et à partir du texte déjà
     accumulé. La question partait, puis se réécrivait toute seule dessous. */
  useEffect(() => {
    if (!actif) arreter();
  }, [actif, arreter]);

  if (!disponible) return null;

  return (
    <>
      {/* Le micro est un bouton plein, rond, de la couleur de l'accent : c'est
          le geste que tout le monde connaît, et il était jusqu'ici une pastille
          grise qu'on ne voyait pas. Quand il écoute, trois barres s'animent —
          on doit savoir qu'on est entendu sans avoir à lire. */}
      <button
        type="button"
        className={`jur-micro${ecoute ? ' jur-micro-actif' : ''}`}
        onClick={basculer}
        disabled={!actif}
        aria-pressed={ecoute}
        title={ecoute ? 'Arrêter la dictée' : 'Dicter votre question'}
      >
        <span className="jur-micro-icone" aria-hidden="true">
          {ecoute ? (
            <span className="jur-ondes">
              <i />
              <i />
              <i />
            </span>
          ) : (
            '🎙'
          )}
        </span>
        {ecoute ? 'J’écoute…' : 'Dicter'}
      </button>
      {/* D'où passe la dictée, dit une fois et sans dramatiser. Ce service vend
          de la confidentialité : quelqu'un qui s'apprête à raconter un litige
          à voix haute doit savoir que la reconnaissance vocale est celle de
          son navigateur, et que plusieurs d'entre eux la font tourner sur
          leurs serveurs. Le texte, lui, ne part qu'au moment de l'envoi. */}
      <p className="jur-micro-note">
        La reconnaissance vocale est celle de votre navigateur et peut envoyer l’audio à son
        éditeur. Ce que vous dictez reste ici tant que vous n’envoyez pas.
      </p>
      {refus && <p className="jur-refus">{refus}</p>}
    </>
  );
}
