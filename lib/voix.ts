/**
 * La voix : ce qu'on peut décider sans navigateur.
 *
 * La synthèse et la dictée viennent du navigateur (Web Speech API) et non d'un
 * fournisseur : aucune clé de plus, aucune facture à l'usage, et — ce qui
 * compte le plus ici — la question posée à voix haute ne transite chez
 * personne d'autre. Quelqu'un qui dicte « mon locataire ne paie plus depuis
 * trois mois » dit quelque chose de sensible ; l'envoyer à un troisième
 * prestataire pour le seul confort d'une plus jolie voix serait un mauvais
 * échange.
 *
 * Ce fichier ne touche à rien de tout cela. Il contient les trois décisions
 * qui se prennent sur du texte, et qui se testent donc sans navigateur : quelles
 * voix proposer, comment lire une réponse à haute voix, et comment la découper
 * pour qu'elle aille jusqu'au bout.
 */

import { avantLeDetail } from './mise-en-forme.ts';

/** Une voix telle qu'on la propose au visiteur. */
export interface VoixOfferte {
  /** L'identifiant technique renvoyé par le navigateur. */
  nom: string;
  /** Ce qui s'affiche dans la liste : « Thomas — français (France) ». */
  libelle: string;
  /** Vrai pour la voix que le système désigne comme celle de la langue. */
  parDefaut: boolean;
  /**
   * Vrai pour un moteur neuronal — « Natural », « Premium », « Google ».
   *
   * Sert à le DIRE dans la liste. Six noms propres sans indication ne
   * permettent de choisir qu'en les essayant un par un, et personne ne le
   * fait : on garde le premier, quel qu'il soit.
   */
  moderne: boolean;
}

/** La forme minimale d'une voix du navigateur. Le DOM n'est pas requis ici. */
export interface VoixBrute {
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
}

const LANGUE = /^fr(-|$)/i;

const REGIONS: Record<string, string> = {
  'fr-fr': 'France',
  'fr-ca': 'Canada',
  'fr-be': 'Belgique',
  'fr-ch': 'Suisse',
};

/**
 * Ce qui, dans le NOM d'une voix, annonce un moteur moderne.
 *
 * Il n'existe aucun moyen de demander la qualité à l'API : `SpeechSynthesis`
 * ne rend qu'un nom, une langue et un drapeau « locale ». Le nom, lui, est
 * étiqueté par les éditeurs eux-mêmes, et toujours de la même façon — c'est le
 * seul signal disponible, et il est fiable.
 *
 * Denise et Henri « Online (Natural) » chez Microsoft, les voix « Enhanced »
 * et « Premium » d'Apple, « Google français » : ce sont des moteurs neuronaux,
 * et ils ne s'entendent pas comme les autres.
 */
const MOTEURS_MODERNES = /natural|neural|online|premium|enhanced|google|siri/i;

/**
 * Ce qui annonce l'inverse : un moteur par concaténation, des années 2000.
 *
 * eSpeak est celui de Linux et de Chrome sans voix système ; « Compact » est la
 * variante réduite d'Apple, installée par défaut tant qu'on n'a pas téléchargé
 * la vraie ; Hortense est l'ancienne voix SAPI de Windows. Ce sont exactement
 * celles qu'on entend quand on trouve que « ça fait robot ».
 */
const MOTEURS_ANCIENS = /espeak|compact|pico|festival|hortense/i;

/** 2 pour un moteur moderne, 0 pour un moteur ancien, 1 pour le reste. */
function qualite(voix: VoixBrute): number {
  const nom = voix.name ?? '';
  if (MOTEURS_ANCIENS.test(nom)) return 0;
  if (MOTEURS_MODERNES.test(nom)) return 2;
  return 1;
}

/**
 * Les voix françaises, dédoublonnées et ordonnées de la meilleure à la pire.
 *
 * On ne garde que le français. Un système en propose parfois soixante, dont
 * cinquante-cinq qui liront « congé » comme un mot anglais. Une liste longue
 * où presque tout est inutilisable est pire qu'une liste courte.
 *
 * On dédoublonne par nom. Le même moteur est souvent déclaré plusieurs fois
 * avec des variantes de langue, et la liste affiche alors trois « Thomas »
 * qu'on ne peut pas distinguer.
 *
 * ET ON CLASSE PAR QUALITÉ, ce qui est le changement.
 *
 * Les voix LOCALES passaient devant, au motif qu'une voix distante s'arrête
 * dès que le réseau hésite. Le raisonnement était juste et la conséquence
 * mauvaise : les voix locales sont précisément les anciennes — eSpeak sur
 * Linux, Hortense sur Windows, les « Compact » d'Apple. Le réglage par défaut
 * choisissait donc, à tous les coups, la voix la plus robotique installée sur
 * la machine. C'est cela qu'on entendait.
 *
 * La crainte d'origine est traitée ailleurs, et mieux : chaque énoncé est
 * découpé sous deux cents caractères (voir `decouperPourLaVoix`), si bien
 * qu'une coupure réseau ne fait perdre qu'une phrase, reprise à la suivante.
 * La localité reste dans le classement, mais en dernier recours : à qualité
 * égale, la voix qui ne dépend de rien gagne.
 */
export function classerVoix(brutes: VoixBrute[]): VoixOfferte[] {
  const francaises = brutes.filter((voix) => LANGUE.test(voix.lang ?? ''));

  const vues = new Set<string>();
  const retenues = francaises.filter((voix) => {
    if (vues.has(voix.name)) return false;
    vues.add(voix.name);
    return true;
  });

  return retenues
    .sort((a, b) => {
      const moteur = qualite(b) - qualite(a);
      if (moteur !== 0) return moteur;
      const defaut = Number(b.default ?? false) - Number(a.default ?? false);
      if (defaut !== 0) return defaut;
      const locale = Number(b.localService ?? false) - Number(a.localService ?? false);
      if (locale !== 0) return locale;
      return a.name.localeCompare(b.name, 'fr');
    })
    .map((voix) => {
      const region = REGIONS[(voix.lang ?? '').toLowerCase()];
      const moderne = qualite(voix) === 2;
      const base = region ? `${voix.name} — ${region}` : voix.name;
      return {
        nom: voix.name,
        libelle: moderne ? `${base} · la plus naturelle` : base,
        parDefaut: Boolean(voix.default),
        moderne,
      };
    });
}

/**
 * La réponse, telle qu'elle doit s'entendre.
 *
 * Le texte est écrit pour l'œil : des intertitres suivis de deux points, des
 * énumérations ouvertes par un tiret cadratin. Lu tel quel par une synthèse,
 * ça donne « Le délai deux points six mois tiret cadratin compter six mois ».
 *
 * On enlève donc ce qui n'est de la ponctuation que pour la mise en page, et
 * on la remplace par ce qui produit la bonne pause à l'oreille : un point.
 */
export function pourLaVoix(texte: string): string {
  /* Le détail juridique ne se dit pas : il s'écrit, et il se lit à l'œil. */
  return avantLeDetail(texte)
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne !== '')
    .map((ligne) => {
      /* Un intertitre : on garde le mot, on retire le deux-points, on ferme
         par un point pour que la voix marque l'arrêt. */
      if (/:$/.test(ligne)) return `${ligne.slice(0, -1).trim()}.`;
      /* Une puce : le tiret ne se prononce pas, mais la pause doit rester. */
      if (/^[—–-]\s*/.test(ligne)) {
        const point = ligne.replace(/^[—–-]\s*/, '').trim();
        return /[.;:!?]$/.test(point) ? point : `${point}.`;
      }
      return ligne;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Au-delà, plusieurs navigateurs coupent l'énoncé au milieu, sans erreur. */
export const LONGUEUR_MAX = 200;

/**
 * Le texte, découpé en énoncés que la synthèse ira au bout.
 *
 * Ce découpage n'est pas une élégance : passé quelques centaines de
 * caractères, plusieurs navigateurs s'arrêtent en cours de phrase sans rien
 * signaler. On coupe donc aux fins de phrase, et seulement si nécessaire à
 * l'espace le plus proche — jamais au milieu d'un mot, parce qu'une synthèse
 * qui reprend au milieu d'un mot est incompréhensible.
 */
export function decouperPourLaVoix(texte: string): string[] {
  const propre = pourLaVoix(texte);
  if (!propre) return [];

  const phrases = propre.match(/[^.!?]+[.!?]*\s*/g) ?? [propre];
  const morceaux: string[] = [];
  let courant = '';

  const poser = () => {
    const fini = courant.trim();
    if (fini) morceaux.push(fini);
    courant = '';
  };

  for (const phrase of phrases) {
    if (phrase.length > LONGUEUR_MAX) {
      poser();
      let reste = phrase.trim();
      while (reste.length > LONGUEUR_MAX) {
        const coupe = reste.lastIndexOf(' ', LONGUEUR_MAX);
        const a = coupe > LONGUEUR_MAX / 2 ? coupe : LONGUEUR_MAX;
        morceaux.push(reste.slice(0, a).trim());
        reste = reste.slice(a).trim();
      }
      courant = reste;
      continue;
    }
    if ((courant + phrase).length > LONGUEUR_MAX) poser();
    courant += phrase;
  }
  poser();

  return morceaux;
}
