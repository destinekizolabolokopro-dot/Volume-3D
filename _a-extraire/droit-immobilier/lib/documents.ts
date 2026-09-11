/**
 * Ce que l'assistant sait rédiger.
 *
 * Dix-sept modèles de courriers et d'actes, rangés par famille. Le fichier est
 * du contenu, pas du code : aucun appel réseau, aucune dépendance, et il se lit
 * comme un aide-mémoire de cabinet.
 *
 * ── Ce qu'il contient, et ce qu'il ne contient pas ──────────────────────────
 * Il ne contient AUCUN texte de courrier tout fait. Un modèle figé se reconnaît
 * à dix mètres, ne colle jamais tout à fait à la situation, et donne à son
 * auteur la fausse assurance d'avoir traité son affaire.
 *
 * Il contient ce qui rend un courrier VALABLE : les mentions sans lesquelles il
 * est nul, les pièges qui l'annulent, le mode d'envoi qui fait preuve, et le
 * délai qui l'enferme. C'est ce qu'on donne au modèle avant qu'il n'écrive, et
 * c'est ce qu'on affiche à la personne après.
 *
 * ── Pourquoi les mentions comptent plus que le style ────────────────────────
 * Un congé pour vendre qui omet le prix est nul. Une contestation d'assemblée
 * générale envoyée par courriel n'existe pas. Une déclaration de sinistre hors
 * délai fait perdre la garantie. Dans chacun de ces cas, la phrase était bien
 * tournée et le résultat vaut zéro — ce fichier existe pour cette raison.
 *
 * ── Sur les références ──────────────────────────────────────────────────────
 * Comme dans lib/domaines.ts : aucun numéro d'article ici. Les textes sont
 * joints à la conversation (voir lib/corpus.ts) et c'est de là que viennent les
 * numéros cités, jamais de la mémoire du modèle ni de ce fichier.
 */

import type { DomaineId } from './domaines';

export type FamilleId = 'bailleur' | 'copropriete' | 'profession' | 'chantier';

export interface Famille {
  id: FamilleId;
  label: string;
  resume: string;
}

export const FAMILLES: Famille[] = [
  {
    id: 'bailleur',
    label: 'Courriers du bailleur',
    resume: 'Congé, impayés, dépôt de garantie, révision du loyer.',
  },
  {
    id: 'copropriete',
    label: 'Copropriété',
    resume: 'Assemblée générale, syndic, communication de pièces.',
  },
  {
    id: 'profession',
    label: 'Actes du professionnel',
    resume: 'Mandats, bon de visite, dénonciation. Carte professionnelle requise.',
  },
  {
    id: 'chantier',
    label: 'Travaux et sinistres',
    resume: 'Réception, malfaçons, assurance, garantie décennale.',
  },
];

export interface ModeleDocument {
  id: string;
  titre: string;
  famille: FamilleId;
  /** La spécialité qui répond des règles de ce document. */
  domaine: DomaineId;
  resume: string;
  /** Qui l'écrit, et à qui. */
  pourQui: string;
  /**
   * Ce qui DOIT y figurer. C'est la partie utile : un courrier auquel il
   * manque une de ces mentions peut être nul, quelle que soit sa qualité.
   */
  mentions: string[];
  /** Ce qui l'annule, ou le rend inopposable. */
  pieges: string[];
  /** Comment l'envoyer pour que l'envoi se prouve. */
  envoi: string;
  /** Le délai qui l'enferme, quand il y en a un. */
  delai?: string;
}

export const MODELES: ModeleDocument[] = [
  {
    id: 'conge-vente',
    titre: 'Congé pour vendre',
    famille: 'bailleur',
    domaine: 'bail-habitation',
    resume:
      'Mettre fin au bail à l’échéance parce qu’on vend le logement.',
    pourQui:
      'Le bailleur, à son locataire. Le congé vaut offre de vente à celui-ci.',
    mentions: [
      'le motif : la décision de vendre, énoncée expressément',
      'le PRIX de vente et les conditions de la vente — c’est ce qui manque le plus souvent, et son absence suffit à annuler le congé',
      'la description du bien tel qu’il est offert à la vente',
      'la reproduction des dispositions légales sur le droit de préemption du locataire, que la loi impose de recopier dans le congé',
      'la date d’échéance du bail à laquelle le congé prend effet',
    ],
    pieges: [
      'un congé donné moins de six mois avant l’échéance ne vaut rien : le bail se reconduit pour trois ans',
      'un prix omis, ou annoncé comme « à débattre », rend le congé nul',
      'un locataire âgé aux ressources modestes bénéficie d’une protection qui peut interdire le congé sans offre de relogement : à vérifier AVANT d’envoyer',
      'vendre ensuite moins cher qu’annoncé oblige à en informer le locataire, qui retrouve son droit d’acheter',
    ],
    envoi:
      'Acte de commissaire de justice, remise en main propre contre récépissé, ou lettre recommandée avec accusé de réception. C’est la date de RÉCEPTION qui compte, pas celle d’envoi.',
    delai:
      'Six mois avant l’échéance pour un logement vide, trois mois pour un meublé.',
  },
  {
    id: 'conge-reprise',
    titre: 'Congé pour reprise',
    famille: 'bailleur',
    domaine: 'bail-habitation',
    resume:
      'Reprendre le logement pour y habiter, ou y loger un proche.',
    pourQui:
      'Le bailleur, à son locataire.',
    mentions: [
      'le motif : la reprise pour habiter',
      'les NOM et ADRESSE du bénéficiaire de la reprise',
      'la nature du lien entre le bailleur et ce bénéficiaire — la loi limite strictement qui peut l’être',
      'le caractère réel et sérieux de la reprise, justifié',
      'la date d’échéance à laquelle le congé prend effet',
    ],
    pieges: [
      'un bénéficiaire hors de la liste légale rend le congé nul',
      'une reprise qui n’est pas suivie d’effet expose à des dommages et intérêts, et le juge le vérifie',
      'la protection du locataire âgé aux ressources modestes s’applique ici aussi',
    ],
    envoi:
      'Acte de commissaire de justice, remise en main propre contre récépissé, ou recommandé avec accusé de réception.',
    delai:
      'Six mois avant l’échéance pour un vide, trois mois pour un meublé.',
  },
  {
    id: 'mise-en-demeure-loyers',
    titre: 'Mise en demeure pour loyers impayés',
    famille: 'bailleur',
    domaine: 'bail-habitation',
    resume:
      'Réclamer les loyers dus, avant toute procédure.',
    pourQui:
      'Le bailleur, à son locataire — et au garant s’il y en a un.',
    mentions: [
      'le décompte précis : chaque mois dû, le montant, et le total',
      'la période concernée, sans approximation',
      'un délai pour payer, explicite',
      'l’annonce de ce qui suivra à défaut de paiement',
      'les coordonnées où payer',
    ],
    pieges: [
      'un décompte faux ou gonflé décrédibilise tout le dossier devant le juge',
      'la mise en demeure n’est pas le commandement de payer : celui-ci relève du commissaire de justice et fait courir les délais de la clause résolutoire',
      'le garant doit être informé, sous peine de ne plus pouvoir être appelé pour la suite',
    ],
    envoi:
      'Lettre recommandée avec accusé de réception. Conservez le double et l’avis de réception.',
    delai:
      'Sans attendre : les loyers se prescrivent, et le retard nuit au dossier.',
  },
  {
    id: 'restitution-depot',
    titre: 'Réclamation du dépôt de garantie',
    famille: 'bailleur',
    domaine: 'bail-habitation',
    resume:
      'Réclamer un dépôt de garantie non restitué dans les délais.',
    pourQui:
      'Le locataire sorti, à son ancien bailleur. Le bailleur peut s’en servir pour motiver une retenue.',
    mentions: [
      'la date de remise des clés — c’est elle qui fait courir le délai',
      'le montant versé à l’entrée',
      'le rappel du délai légal de restitution',
      'la majoration due par mois de retard entamé',
      'un délai pour s’exécuter avant saisine du juge',
    ],
    pieges: [
      'une retenue doit être JUSTIFIÉE par des devis ou factures : une retenue forfaitaire est contestable',
      'l’usure normale ne se retient pas ; seule la dégradation le fait',
      'sans état des lieux de sortie contradictoire, le logement est présumé rendu en bon état',
    ],
    envoi:
      'Lettre recommandée avec accusé de réception.',
    delai:
      'Un mois après la remise des clés si l’état des lieux de sortie est conforme à celui d’entrée, deux mois sinon.',
  },
  {
    id: 'revision-loyer',
    titre: 'Révision annuelle du loyer',
    famille: 'bailleur',
    domaine: 'bail-habitation',
    resume:
      'Appliquer l’indexation prévue au bail.',
    pourQui:
      'Le bailleur, à son locataire.',
    mentions: [
      'la clause de révision du bail, citée',
      'l’indice de référence des loyers du trimestre prévu au contrat, et celui de la même période l’année précédente',
      'le calcul, posé en toutes lettres',
      'le nouveau loyer et sa date d’application',
    ],
    pieges: [
      'sans clause de révision au bail, aucune révision n’est possible',
      'la révision se prescrit : passé un an, elle ne se rattrape pas rétroactivement',
      'un logement au diagnostic énergétique le plus mauvais ne peut pas voir son loyer révisé',
    ],
    envoi:
      'Lettre simple suffit, mais le recommandé date la demande.',
    delai:
      'Dans l’année qui suit la date de révision prévue au bail.',
  },
  {
    id: 'resolution-ag',
    titre: 'Inscription d’une résolution à l’ordre du jour',
    famille: 'copropriete',
    domaine: 'copropriete',
    resume:
      'Faire porter une question au vote de la prochaine assemblée.',
    pourQui:
      'Un copropriétaire, au syndic.',
    mentions: [
      'la rédaction EXACTE de la résolution telle qu’elle devra être soumise au vote',
      'les documents nécessaires à la décision, joints',
      'pour des travaux : les devis, sans lesquels la résolution ne peut pas être votée',
      'la demande expresse d’inscription à l’ordre du jour de la prochaine assemblée',
    ],
    pieges: [
      'une résolution vague ne peut pas être votée et sera écartée',
      'arrivée trop tard pour figurer dans la convocation, elle attend un an',
      'une question posée sans les pièces exigées est inscrite mais invotable',
    ],
    envoi:
      'Lettre recommandée avec accusé de réception, ou tout moyen prévu par le règlement.',
    delai:
      'Assez tôt pour figurer dans la convocation — en pratique, dès la clôture de l’assemblée précédente.',
  },
  {
    id: 'contestation-ag',
    titre: 'Contestation d’une décision d’assemblée générale',
    famille: 'copropriete',
    domaine: 'copropriete',
    resume:
      'Attaquer une résolution votée, devant le tribunal.',
    pourQui:
      'Un copropriétaire opposant ou absent. Celui qui a voté pour ne peut pas contester.',
    mentions: [
      'la date de l’assemblée et celle de la notification du procès-verbal',
      'la ou les résolutions attaquées, désignées par leur numéro',
      'votre position au procès-verbal : opposant, ou absent',
      'les motifs de la contestation : irrégularité de forme, majorité erronée, abus de majorité',
    ],
    pieges: [
      'DEUX MOIS à compter de la notification du procès-verbal, et ce délai est appliqué sans indulgence',
      'cette contestation se porte devant le tribunal : une lettre au syndic n’interrompt rien',
      'avoir voté pour ferme le recours, même si l’on a changé d’avis depuis',
    ],
    envoi:
      'La saisine du tribunal. Le courrier au syndic ne remplace pas l’assignation et ne suspend pas le délai.',
    delai:
      'Deux mois à compter de la notification du procès-verbal.',
  },
  {
    id: 'mise-en-demeure-syndic',
    titre: 'Mise en demeure au syndic',
    famille: 'copropriete',
    domaine: 'copropriete',
    resume:
      'Obtenir d’un syndic qu’il exécute ce qu’il doit.',
    pourQui:
      'Un copropriétaire ou le conseil syndical, au syndic.',
    mentions: [
      'l’obligation précise qui n’est pas remplie',
      'les faits, datés',
      'les demandes antérieures restées sans réponse, avec leurs dates',
      'un délai pour s’exécuter',
      'la suite envisagée : saisine du conseil syndical, du tribunal, ou question à l’ordre du jour',
    ],
    pieges: [
      'une réclamation sans date et sans pièce ne pèse rien',
      'certaines carences relèvent de l’assemblée, pas du tribunal : la révocation du syndic se vote',
    ],
    envoi:
      'Lettre recommandée avec accusé de réception, copie au conseil syndical.',
  },
  {
    id: 'demande-pieces',
    titre: 'Demande de communication de pièces',
    famille: 'copropriete',
    domaine: 'copropriete',
    resume:
      'Obtenir les documents de la copropriété que le syndic doit tenir à disposition.',
    pourQui:
      'Un copropriétaire ou le conseil syndical, au syndic.',
    mentions: [
      'la liste précise des pièces demandées : contrats, factures, relevés, procès-verbaux, carnet d’entretien',
      'la période concernée',
      'le fondement de la demande — droit de consultation du copropriétaire, prérogatives du conseil syndical',
      'un délai de réponse',
    ],
    pieges: [
      'une demande globale du type « tous les documents » se voit opposer un refus légitime',
      'certaines pièces se consultent au cabinet du syndic sans obligation d’envoi de copies',
    ],
    envoi:
      'Lettre recommandée avec accusé de réception.',
  },
  {
    id: 'mandat-vente',
    titre: 'Mandat de vente',
    famille: 'profession',
    domaine: 'profession',
    resume:
      'Le contrat par lequel un propriétaire confie la vente à un professionnel.',
    pourQui:
      'L’agent immobilier titulaire de la carte professionnelle, avec son mandant.',
    mentions: [
      'l’identité complète des parties et la désignation du bien',
      'le NUMÉRO d’inscription au registre des mandats — sans lui, aucune commission n’est due',
      'la durée du mandat et ses conditions de renouvellement',
      'le prix de vente et le montant des honoraires, en précisant qui les supporte',
      'les conditions de la faculté de rétractation quand elle s’applique',
      'la mention de la garantie financière et de l’assurance de responsabilité professionnelle',
    ],
    pieges: [
      'un mandat non numéroté au registre, ou numéroté après coup, prive de toute rémunération',
      'un exemplaire doit être REMIS au mandant : le défaut de remise est sanctionné',
      'un mandat sans durée déterminée est nul',
      'seul le titulaire de la carte professionnelle peut recevoir ce mandat',
    ],
    envoi:
      'Signé en autant d’exemplaires que de parties, un remis au mandant le jour même.',
  },
  {
    id: 'mandat-gestion',
    titre: 'Mandat de gestion locative',
    famille: 'profession',
    domaine: 'profession',
    resume:
      'Confier la gestion d’un bien loué à un professionnel.',
    pourQui:
      'L’administrateur de biens titulaire de la carte, avec le propriétaire.',
    mentions: [
      'l’étendue exacte des pouvoirs confiés : encaissement, quittances, travaux jusqu’à quel montant, congés',
      'le numéro d’inscription au registre des mandats',
      'la durée et les conditions de résiliation',
      'la rémunération, son assiette et son mode de calcul',
      'la garantie financière couvrant les fonds détenus pour autrui',
      'la périodicité des comptes rendus de gestion',
    ],
    pieges: [
      'détenir des fonds sans garantie financière suffisante est une faute lourde',
      'un pouvoir de donner congé qui ne serait pas expressément prévu n’existe pas',
    ],
    envoi:
      'Signé en autant d’exemplaires que de parties, un remis au mandant.',
  },
  {
    id: 'bon-visite',
    titre: 'Bon de visite',
    famille: 'profession',
    domaine: 'profession',
    resume:
      'Attester qu’un acquéreur a découvert le bien par l’agence.',
    pourQui:
      'L’agent immobilier, signé par le visiteur.',
    mentions: [
      'l’identité du visiteur et la désignation du bien',
      'la DATE de la visite',
      'le nom de l’agence et son mandat',
      'l’engagement de ne pas traiter directement avec le vendeur',
    ],
    pieges: [
      'le bon de visite prouve la visite, pas le droit à commission : il ne vaut que rapproché d’un mandat valable',
      'un bon signé sans mandat en cours ne sert à rien',
      'une clause de dédit disproportionnée sera écartée par le juge',
    ],
    envoi:
      'Signé sur place, un exemplaire remis au visiteur.',
  },
  {
    id: 'denonciation-mandat',
    titre: 'Dénonciation de mandat',
    famille: 'profession',
    domaine: 'profession',
    resume:
      'Mettre fin à un mandat, d’un côté ou de l’autre.',
    pourQui:
      'Le mandant ou le mandataire.',
    mentions: [
      'la référence du mandat et son numéro de registre',
      'la date d’effet de la dénonciation',
      'le respect du préavis prévu au mandat',
      'le sort des démarches en cours et des acquéreurs déjà présentés',
    ],
    pieges: [
      'un mandat exclusif ne se dénonce qu’aux conditions qu’il prévoit, et rarement avant son terme initial',
      'traiter avec un acquéreur présenté pendant le mandat peut rester dû après sa fin : les clauses de survie s’appliquent',
    ],
    envoi:
      'Lettre recommandée avec accusé de réception.',
    delai:
      'Le préavis stipulé au mandat, à compter de la réception.',
  },
  {
    id: 'declaration-sinistre',
    titre: 'Déclaration de sinistre',
    famille: 'chantier',
    domaine: 'sinistres',
    resume:
      'Déclarer un dégât des eaux, un incendie, un vol à son assureur.',
    pourQui:
      'L’assuré, à son assureur.',
    mentions: [
      'le numéro de contrat et l’adresse du bien',
      'la DATE et l’heure du sinistre, et la date de sa découverte',
      'la nature et les circonstances, sans interprétation',
      'la description des dommages, pièce par pièce',
      'les coordonnées des tiers concernés : voisin, syndic, autre assureur',
      'les mesures conservatoires déjà prises',
    ],
    pieges: [
      'hors délai, la garantie peut être refusée — c’est le motif de refus le plus fréquent',
      'réparer avant le passage de l’expert prive de la preuve : photographier d’abord, tout conserver',
      'minimiser les dommages dans la déclaration se retourne contre l’assuré à l’indemnisation',
    ],
    envoi:
      'Par le canal prévu au contrat, doublé d’un recommandé avec accusé de réception quand l’enjeu est important.',
    delai:
      'Cinq jours ouvrés en règle générale, deux jours ouvrés pour un vol. Le contrat peut prévoir mieux, jamais moins.',
  },
  {
    id: 'mise-en-demeure-artisan',
    titre: 'Mise en demeure d’un artisan',
    famille: 'chantier',
    domaine: 'travaux',
    resume:
      'Obtenir la reprise d’un chantier arrêté, ou d’une malfaçon.',
    pourQui:
      'Le maître d’ouvrage, à l’entreprise.',
    mentions: [
      'la référence du devis signé et la date de commande',
      'les travaux prévus, et ce qui est réellement fait',
      'les désordres constatés, décrits un par un et datés',
      'les sommes déjà versées',
      'un délai pour reprendre et achever',
      'la suite envisagée à défaut : exécution par un tiers aux frais de l’entreprise, résolution du marché',
    ],
    pieges: [
      'sans mise en demeure préalable, la plupart des recours sont irrecevables : c’est la première étape, pas une formalité',
      'faire achever par un tiers sans autorisation du juge est risqué, sauf urgence caractérisée',
      'retenir le solde sans mise en demeure expose à des pénalités de retard',
    ],
    envoi:
      'Lettre recommandée avec accusé de réception, avec photographies datées.',
  },
  {
    id: 'reserves-reception',
    titre: 'Réserves à la réception des travaux',
    famille: 'chantier',
    domaine: 'travaux',
    resume:
      'Consigner ce qui ne va pas au moment de recevoir le chantier.',
    pourQui:
      'Le maître d’ouvrage, à l’entreprise, le jour de la réception.',
    mentions: [
      'la date de réception — c’est elle qui fait courir toutes les garanties',
      'la liste des réserves, chacune décrite et localisée',
      'le délai imparti pour les lever',
      'la signature des deux parties, ou la mention du refus de signer',
    ],
    pieges: [
      'SANS RÉCEPTION, aucune garantie ne court : c’est l’acte le plus important du chantier et le plus souvent négligé',
      'une réception sans réserve rend les défauts apparents inopposables',
      'une réserve vague — « finitions à revoir » — ne permet pas d’exiger quoi que ce soit',
    ],
    envoi:
      'Procès-verbal signé sur place, un exemplaire à chaque partie. À défaut d’accord, réception judiciaire ou par commissaire de justice.',
    delai:
      'Le jour même. Les réserves ne s’ajoutent pas après coup.',
  },
  {
    id: 'decennale',
    titre: 'Mise en jeu de la garantie décennale',
    famille: 'chantier',
    domaine: 'travaux',
    resume:
      'Faire jouer la garantie de dix ans pour un désordre grave.',
    pourQui:
      'Le maître d’ouvrage, à l’entreprise ET à son assureur décennal.',
    mentions: [
      'la date de RÉCEPTION des travaux, qui ouvre le décompte des dix ans',
      'la nature du désordre et en quoi il compromet la solidité ou rend le bien impropre à sa destination',
      'la date d’apparition du désordre',
      'les références de l’attestation d’assurance décennale de l’entreprise',
      'la demande d’expertise',
    ],
    pieges: [
      'un désordre esthétique ne relève pas de la décennale : la gravité est la condition',
      'dix ans à compter de la réception, sans prorogation',
      'déclarer à l’entreprise seule ne suffit pas si elle a disparu : l’assureur se saisit directement',
    ],
    envoi:
      'Lettre recommandée avec accusé de réception à l’entreprise et à son assureur, avec photographies et devis de reprise.',
    delai:
      'Dix ans à compter de la réception.',
  },
];

/** Les modèles d'une famille, dans l'ordre du catalogue. */
export function modelesDeLaFamille(famille: FamilleId): ModeleDocument[] {
  return MODELES.filter((modele) => modele.famille === famille);
}

export function modeleOuNull(id: string): ModeleDocument | null {
  return MODELES.find((modele) => modele.id === id) ?? null;
}

/**
 * La fiche donnée au modèle avant qu'il n'écrive.
 *
 * Elle est volontairement impérative : ce sont des conditions de validité, pas
 * des suggestions de style. Un courrier auquel il manque une mention est nul,
 * et « nul » ne se rattrape pas par une jolie tournure.
 */
export function consigneDuModele(modele: ModeleDocument): string {
  const lignes = [
    `DOCUMENT À RÉDIGER : ${modele.titre.toUpperCase()}`,
    modele.resume,
    `Qui l\u2019écrit : ${modele.pourQui}`,
    '',
    'MENTIONS OBLIGATOIRES. Chacune doit figurer dans le courrier. Quand une information manque pour en écrire une, laisse un blanc en majuscules entre crochets — [PRIX DE VENTE] — plutôt que d’inventer une valeur :',
    ...modele.mentions.map((mention) => `— ${mention}`),
    '',
    'PIÈGES. Signale ceux qui concernent la situation décrite, après le courrier :',
    ...modele.pieges.map((piege) => `— ${piege}`),
    '',
    `ENVOI : ${modele.envoi}`,
  ];
  if (modele.delai) lignes.push(`DÉLAI : ${modele.delai}`);
  return lignes.join('\n');
}
