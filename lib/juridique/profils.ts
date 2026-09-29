/**
 * Ce que la personne vient faire ici.
 *
 * Trois questions posées une fois, à l'ouverture du compte, et jamais
 * reposées. Elles ne servent pas à segmenter un fichier commercial : elles
 * servent au spécialiste, qui doit savoir de quel côté du bail se tient celui
 * qui lui écrit avant d'écrire sa première phrase.
 *
 * Le socle distingue déjà deux publics — les propriétaires et les
 * professionnels — mais il devait jusqu'ici le deviner aux mots employés.
 * Deviner marche une fois sur deux ; demander marche à tous les coups, et ne
 * coûte que trois clics.
 *
 * Chaque question est facultative. Un questionnaire obligatoire à
 * l'inscription est un questionnaire qu'on remplit au hasard, et un profil
 * faux est pire qu'un profil vide.
 */

export interface Choix {
  id: string;
  label: string;
  /** Précision affichée sous le libellé, quand elle évite une hésitation. */
  detail?: string;
}

export interface Question {
  /** Champ du compte où la réponse est rangée. */
  cle: 'metier' | 'volume' | 'usage';
  titre: string;
  aide: string;
  choix: Choix[];
}

export const QUESTIONS: Question[] = [
  {
    cle: 'metier',
    titre: 'Vous êtes…',
    aide: 'C’est ce qui décide du point de vue des réponses : la même règle ne se joue pas pareil des deux côtés d’un bail.',
    choix: [
      { id: 'bailleur', label: 'Propriétaire bailleur', detail: 'Location à l’année, vide ou meublée' },
      { id: 'hote', label: 'Loueur en meublé de tourisme', detail: 'Airbnb, location saisonnière' },
      { id: 'coproprietaire', label: 'Copropriétaire', detail: 'Assemblées, charges, travaux' },
      { id: 'agent', label: 'Agent immobilier ou mandataire', detail: 'Transaction, mandats, honoraires' },
      { id: 'gestionnaire', label: 'Gestionnaire ou conciergerie', detail: 'Gestion locative pour le compte d’autrui' },
      { id: 'particulier', label: 'Particulier', detail: 'Acheteur, vendeur, locataire, voisin' },
    ],
  },
  {
    cle: 'volume',
    titre: 'Combien de biens suivez-vous ?',
    aide: 'Un propriétaire d’un studio et une agence de deux cents lots n’ont pas les mêmes questions, ni la même urgence.',
    choix: [
      { id: 'un', label: 'Un seul' },
      { id: 'quelques', label: 'De deux à cinq' },
      { id: 'plusieurs', label: 'De six à vingt' },
      { id: 'beaucoup', label: 'Plus de vingt' },
      { id: 'aucun', label: 'Aucun pour l’instant' },
    ],
  },
  {
    cle: 'usage',
    titre: 'Ce que vous venez chercher',
    aide: 'Cela change la forme de la réponse, pas son contenu.',
    choix: [
      { id: 'comprendre', label: 'Comprendre une situation', detail: 'Savoir où j’en suis, et ce que dit la règle' },
      { id: 'agir', label: 'Vérifier avant d’agir', detail: 'Un délai, une pièce, une condition de forme' },
      { id: 'preparer', label: 'Préparer un rendez-vous ou un courrier', detail: 'Arriver avec les bons arguments' },
      { id: 'securiser', label: 'Sécuriser une opération', detail: 'Une vente, un bail, un chantier, une assemblée' },
    ],
  },
];

/** Les métiers qui font de la personne un professionnel de l'immobilier. */
const PROFESSIONNELS = new Set(['agent', 'gestionnaire']);

export interface Profil {
  metier: string;
  volume: string;
  usage: string;
}

export function estProfessionnel(profil: Partial<Profil> | null | undefined): boolean {
  return Boolean(profil?.metier && PROFESSIONNELS.has(profil.metier));
}

function libelle(cle: Question['cle'], id: string): string {
  const question = QUESTIONS.find((entree) => entree.cle === cle);
  return question?.choix.find((choix) => choix.id === id)?.label ?? '';
}

/** Vrai dès qu'au moins une réponse a été donnée. */
export function profilRenseigne(profil: Partial<Profil> | null | undefined): boolean {
  return Boolean(profil && (profil.metier || profil.volume || profil.usage));
}

/**
 * Le profil, mis en phrases pour le spécialiste.
 *
 * Il est donné APRÈS la fiche du domaine, c'est-à-dire après le point de mise
 * en cache : la consigne du spécialiste reste identique d'un utilisateur à
 * l'autre et se facture une fois, le profil change à chaque personne et ne
 * casse rien.
 *
 * Renvoie une chaîne vide quand rien n'a été répondu — mieux vaut pas de
 * profil qu'un profil vide énoncé comme un fait.
 */
export function profilPourLeModele(profil: Partial<Profil> | null | undefined): string {
  if (!profilRenseigne(profil)) return '';

  const lignes = ['QUI TE PARLE'];
  if (profil?.metier) lignes.push(`— ${libelle('metier', profil.metier)}.`);
  if (profil?.volume) lignes.push(`— Biens suivis : ${libelle('volume', profil.volume)}.`);
  if (profil?.usage) lignes.push(`— Vient pour : ${libelle('usage', profil.usage)}.`);

  lignes.push('');
  if (estProfessionnel(profil)) {
    lignes.push(
      'C’est un professionnel : va droit au fait, emploie le vocabulaire du métier, et dis-lui ce qu’il doit écrire et conserver — il engage sa responsabilité, pas seulement son affaire.',
    );
  } else {
    lignes.push(
      'Ce n’est pas un professionnel du droit : explique la règle en langue de tous les jours, sans jargon, et nomme les interlocuteurs concrets.',
    );
  }
  lignes.push(
    'Ce profil dit d’où la personne parle, pas ce qui lui arrive. S’il contredit ce qu’elle écrit, c’est ce qu’elle écrit qui gagne.',
  );

  return lignes.join('\n');
}
