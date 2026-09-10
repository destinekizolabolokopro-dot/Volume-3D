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

/** Une voix telle qu'on la propose au visiteur. */
export interface VoixOfferte {
  /** L'identifiant technique renvoyé par le navigateur. */
  nom: string;
  /** Ce qui s'affiche dans la liste : « Thomas — français (France) ». */
  libelle: string;
  /** Vrai pour la voix que le système désigne comme celle de la langue. */
  parDefaut: boolean;
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
 * Les voix françaises, dédoublonnées et ordonnées.
 *
 * Trois décisions, et chacune vient d'un défaut constaté plutôt que d'un goût.
 *
 * On ne garde que le français. Un système en propose parfois soixante, dont
 * cinquante-cinq qui liront « congé » comme un mot anglais. Une liste longue
 * où presque tout est inutilisable est pire qu'une liste courte.
 *
 * On dédoublonne par nom. Le même moteur est souvent déclaré plusieurs fois
 * avec des variantes de langue, et la liste affiche alors trois « Thomas »
 * qu'on ne peut pas distinguer.
 *
 * On met les voix LOCALES en tête. Une voix distante sonne mieux mais s'arrête
 * dès que le réseau hésite, au milieu d'une phrase — et sur une réponse
 * juridique, la phrase coupée est peut-être celle qui portait le délai.
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
      const locale = Number(b.localService ?? false) - Number(a.localService ?? false);
      if (locale !== 0) return locale;
      const defaut = Number(b.default ?? false) - Number(a.default ?? false);
      if (defaut !== 0) return defaut;
      return a.name.localeCompare(b.name, 'fr');
    })
    .map((voix) => {
      const region = REGIONS[(voix.lang ?? '').toLowerCase()];
      return {
        nom: voix.name,
        libelle: region ? `${voix.name} — ${region}` : voix.name,
        parDefaut: Boolean(voix.default),
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
  return texte
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
