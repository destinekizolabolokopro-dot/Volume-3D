/**
 * Le dossier de diagnostics techniques, et la validité de chaque pièce.
 *
 * C'est le tableau qu'un professionnel de l'immobilier rouvre plusieurs fois
 * par semaine, et la question qu'on lui pose le plus souvent : « celui-là, il
 * est encore bon ? ». Le mettre ici plutôt que dans la tête du modèle a une
 * raison précise — une durée de validité est un fait vérifiable, pas une
 * appréciation. Un modèle qui l'invente produit une réponse crédible et
 * fausse ; un tableau se relit et se corrige.
 *
 * Il est affiché sur les fiches concernées et donné au spécialiste avec sa
 * consigne. La règle qui l'accompagne partout : le rapport lui-même porte sa
 * date de réalisation et sa date de fin de validité, et c'est lui qui fait
 * foi — ce tableau dit ce qu'on doit y chercher, pas ce qu'on peut supposer.
 *
 * Écrit au 5 septembre 2026. À revoir quand la réglementation énergétique
 * bouge : c'est la partie qui a changé le plus vite ces dernières années.
 */

export interface Diagnostic {
  nom: string;
  /** Quand il est exigé, et pour quel bien. */
  quand: string;
  /** Durée de validité, avec ses conditions. */
  validite: string;
}

export const DIAGNOSTICS: Diagnostic[] = [
  {
    nom: 'Diagnostic de performance énergétique (DPE)',
    quand: 'Vente et location de presque tout logement, et à joindre à l’annonce.',
    validite: 'Dix ans.',
  },
  {
    nom: 'Audit énergétique',
    quand: 'Vente d’une maison individuelle ou d’un immeuble en monopropriété classé F ou G, et classé E depuis 2025.',
    validite: 'Cinq ans.',
  },
  {
    nom: 'État des risques et pollutions',
    quand: 'Vente et location, dès que la commune est couverte par un arrêté préfectoral.',
    validite: 'Six mois. C’est le plus court du dossier, et celui qui périme le plus souvent entre le compromis et l’acte.',
  },
  {
    nom: 'Amiante',
    quand: 'Bien dont le permis de construire est antérieur au 1ᵉʳ juillet 1997.',
    validite: 'Illimitée si le rapport, postérieur à 2013, conclut à une absence. Trois ans en cas de présence, avec contrôle périodique.',
  },
  {
    nom: 'Plomb (constat de risque d’exposition)',
    quand: 'Logement construit avant le 1ᵉʳ janvier 1949.',
    validite: 'Illimitée si absence. En cas de présence : un an à la vente, six ans à la location.',
  },
  {
    nom: 'Termites',
    quand: 'Vente, dans les zones délimitées par arrêté préfectoral.',
    validite: 'Six mois.',
  },
  {
    nom: 'État de l’installation intérieure de gaz',
    quand: 'Installation intérieure de plus de quinze ans.',
    validite: 'Trois ans à la vente, six ans à la location.',
  },
  {
    nom: 'État de l’installation intérieure d’électricité',
    quand: 'Installation intérieure de plus de quinze ans.',
    validite: 'Trois ans à la vente, six ans à la location.',
  },
  {
    nom: 'Assainissement non collectif',
    quand: 'Vente d’un bien non raccordé au réseau public.',
    validite: 'Trois ans.',
  },
  {
    nom: 'Surface privative (loi Carrez)',
    quand: 'Vente d’un lot de copropriété.',
    validite: 'Illimitée tant que le bien n’est pas modifié. Un mesurage inférieur de plus de cinq pour cent ouvre une action en réduction du prix.',
  },
  {
    nom: 'Surface habitable (loi Boutin)',
    quand: 'Location vide à usage de résidence principale.',
    validite: 'Illimitée tant que le bien n’est pas modifié.',
  },
  {
    nom: 'Bruit (plan d’exposition aux aérodromes)',
    quand: 'Vente et location d’un bien situé dans une zone d’exposition au bruit.',
    validite: 'Information à annexer, sans durée propre.',
  },
];

/**
 * Le calendrier des interdictions de louer selon la classe énergie.
 *
 * Ce n'est pas un diagnostic, mais c'est ce que le DPE déclenche — et la
 * raison pour laquelle on le regarde. Un propriétaire qui achète pour louer a
 * besoin des deux dans la même page.
 */
export const CALENDRIER_ENERGIE: string[] = [
  'Depuis 2023 : les logements les plus consommateurs de la classe G ne peuvent plus être proposés à la location.',
  'Depuis le 1ᵉʳ janvier 2025 : toute la classe G est concernée.',
  'À partir de 2028 : la classe F.',
  'À partir de 2034 : la classe E.',
  'Un logement interdit à la location reste vendable, et le locataire en place n’est pas expulsé : c’est la mise en location, et le renouvellement du bail, qui sont visés.',
];

/** Le tableau, mis à plat pour la consigne du spécialiste. */
export function diagnosticsPourLeModele(): string {
  const lignes = DIAGNOSTICS.map(
    (diagnostic) => `— ${diagnostic.nom} — exigé : ${diagnostic.quand} Validité : ${diagnostic.validite}`,
  );
  return [
    'Diagnostics et durées de validité (faits vérifiés, à ne pas compléter de mémoire) :',
    ...lignes,
    '',
    'Le rapport remis porte sa propre date de réalisation et de fin de validité : c’est elle qui fait foi. Si la personne ne l’a pas sous les yeux, demande-la au lieu de supposer.',
    '',
    'Calendrier des interdictions de louer selon la classe énergie :',
    ...CALENDRIER_ENERGIE.map((ligne) => `— ${ligne}`),
  ].join('\n');
}
