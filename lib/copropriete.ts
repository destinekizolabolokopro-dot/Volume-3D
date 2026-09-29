/**
 * Ce qu'un spécialiste de la copropriété a dans la tête, et qu'un modèle
 * reconstruit mal.
 *
 * Le corpus joint à chaque consultation porte déjà les 346 articles de la loi
 * de 1965 et du décret de 1967. Ce fichier n'ajoute pas de texte : il ajoute
 * la MISE EN TABLE de ce texte, c'est-à-dire exactement ce qui sépare
 * quelqu'un qui a lu la loi de quelqu'un qui la pratique.
 *
 * Trois tables, choisies parce que ce sont les trois questions qui reviennent
 * et les trois endroits où une erreur ne se rattrape pas.
 *
 * LES MAJORITÉS. « Quelle majorité pour cette décision ? » est la question la
 * plus posée en copropriété, et la plus coûteuse à rater : une résolution
 * votée à la mauvaise majorité est annulable, et l'annulation emporte les
 * travaux, les appels de fonds et le marché signé avec l'entreprise. Un
 * modèle qui déduit la majorité en relisant trois mille signes d'article s'en
 * sort souvent ; « souvent » ne suffit pas ici.
 *
 * LES PASSERELLES. Elles sont la partie que presque personne ne connaît, y
 * compris parmi les syndics, et celle qui change le plus de choses : une
 * résolution qui « échoue » peut être adoptée dans la même séance, au second
 * vote, sans reconvoquer. Ne pas le dire, c'est faire perdre six mois.
 *
 * LE CALENDRIER DE L'ASSEMBLÉE. Le délai de contestation ne court pas de
 * l'assemblée mais de la notification du procès-verbal, et le syndic a un
 * mois pour la faire. Confondre les deux points de départ fait déclarer
 * irrecevable une contestation qui était dans les temps.
 *
 * TOUT CE QUI EST ÉCRIT ICI EST VÉRIFIÉ CONTRE LE CORPUS. Chaque numéro
 * d'article cité est comparé, par un test, au texte réellement présent dans
 * corpus/copropriete.json : un article inventé ou renuméroté fait échouer la
 * suite avant d'atteindre quiconque. Voir tests/copropriete.test.ts.
 *
 * Arrêté au fonds LEGI du 8 septembre 2026.
 */

export interface Majorite {
  /** Le nom court, tel qu'on le prononce : « majorité de l'article 25 ». */
  nom: string;
  /** L'article qui la porte. Vérifié contre le corpus. */
  article: string;
  /** Comment elle se compte. C'est là que se font les erreurs. */
  calcul: string;
  /** Les décisions qu'elle gouverne, dans l'ordre où on les rencontre. */
  decisions: string[];
}

export const MAJORITES: Majorite[] = [
  {
    nom: 'Majorité simple',
    article: '24',
    calcul:
      'Majorité des voix EXPRIMÉES par les copropriétaires présents, représentés ou ayant voté par correspondance. Les abstentions ne comptent pas, et les absents non plus : c’est la majorité la plus facile à atteindre.',
    decisions: [
      'travaux nécessaires à la conservation de l’immeuble, à la santé et à la sécurité des occupants — stabilité, clos, couvert, réseaux, mise aux normes de salubrité',
      'travaux d’entretien courant et budget prévisionnel',
      'approbation des comptes et quitus au syndic',
      'autorisation d’ester en justice donnée au syndic',
      'modalités de réalisation et d’exécution des travaux rendus obligatoires par la loi',
      'adaptation du règlement de copropriété aux modifications législatives',
    ],
  },
  {
    nom: 'Majorité absolue',
    article: '25',
    calcul:
      'Majorité des voix de TOUS les copropriétaires, y compris les absents et les abstentionnistes. Un copropriétaire qui ne vient pas vote de fait contre.',
    decisions: [
      'désignation ou révocation du syndic et des membres du conseil syndical',
      'autorisation donnée à un copropriétaire de faire à ses frais des travaux affectant les parties communes ou l’aspect extérieur',
      'délégation de pouvoir au syndic ou au conseil syndical pour un acte relevant de l’article 24',
      'travaux d’économie d’énergie ou de réduction des émissions de gaz à effet de serre',
      'installation ou modification d’un équipement commun',
      'suppression des vide-ordures pour raison d’hygiène',
    ],
  },
  {
    nom: 'Double majorité',
    article: '26',
    calcul:
      'Majorité des MEMBRES du syndicat représentant au moins les DEUX TIERS des voix. Deux conditions cumulatives : on compte les têtes et on compte les tantièmes.',
    decisions: [
      'modification du règlement de copropriété quant à la jouissance, l’usage et l’administration des parties communes',
      'actes d’acquisition immobilière et actes de disposition',
      'suppression du poste de gardien ou de concierge et vente de son logement',
      'travaux de transformation, d’addition ou d’amélioration',
    ],
  },
  {
    nom: 'Unanimité',
    article: '26',
    calcul:
      'Tous les copropriétaires, sans exception. Rien ne s’y substitue, et aucune passerelle n’y mène.',
    decisions: [
      'aliénation de parties communes dont la conservation est nécessaire au respect de la destination de l’immeuble',
      'modification de la répartition des charges hors les cas où la loi la permet autrement',
      'atteinte aux droits que chacun tient de la destination de l’immeuble',
    ],
  },
];

/**
 * Les deux passerelles : ce qui se passe quand une résolution n'atteint pas
 * sa majorité.
 *
 * C'est la partie la moins connue et la plus utile. Elle évite de reconvoquer
 * une assemblée — donc six mois — pour une résolution qui pouvait être
 * adoptée dans la même séance.
 */
export const PASSERELLES = [
  'Article 25-1, première passerelle : une résolution de l’article 25 qui n’atteint pas la majorité absolue MAIS qui recueille au moins le tiers des voix de tous les copropriétaires est immédiatement soumise à un second vote, dans la même assemblée, à la majorité de l’article 24. Le syndic doit procéder à ce second vote : ce n’est pas une faculté.',
  'Article 25-1, seconde passerelle : pour les travaux du f de l’article 25, si le tiers n’est même pas atteint, une nouvelle assemblée convoquée dans les trois mois sur un projet IDENTIQUE peut statuer à la majorité de l’article 24.',
  'Article 26-1 : une résolution de l’article 26 qui n’atteint pas la double majorité mais qui recueille l’approbation de la moitié des membres présents, représentés ou votant par correspondance, représentant au moins le tiers des voix de tous, est immédiatement soumise à un second vote à la majorité de l’article 25.',
  'Aucune passerelle ne mène à l’unanimité, ni n’en part.',
];

/**
 * Le calendrier de l'assemblée, du premier courrier au dernier recours.
 *
 * Le point qui compte le plus est le troisième : le délai de contestation ne
 * court pas de l'assemblée mais de la notification du procès-verbal.
 */
export const CALENDRIER = [
  'Convocation : vingt et un jours au moins avant la séance, avec les pièces exigées pour chaque résolution. Une convocation tardive ou incomplète est une cause de nullité — mais elle se soulève dans le délai de contestation, pas après.',
  'Notification du procès-verbal par le syndic : dans le mois de la tenue de l’assemblée (article 42).',
  'Contestation : DEUX MOIS à compter de la notification du procès-verbal, sans ses annexes — et non de la tenue de l’assemblée. À peine de déchéance : passé ce délai, la décision est inattaquable, même illégale.',
  'Qui peut contester : seulement les copropriétaires OPPOSANTS ou DÉFAILLANTS (absents et non représentés). Celui qui a voté pour, ou qui s’est abstenu en séance, ne le peut pas.',
  'Sauf urgence, le syndic ne peut pas exécuter les travaux décidés avant l’expiration de ce délai de deux mois (article 42).',
  'Actions personnelles entre copropriétaires, ou entre un copropriétaire et le syndicat : cinq ans (article 42, qui renvoie à l’article 2224 du code civil).',
];

/**
 * Les charges : la seule question où deux clés de répartition coexistent dans
 * le même article, et où les confondre fausse tout le calcul.
 */
export const CHARGES = [
  'Article 10, premier alinéa — charges de SERVICES COLLECTIFS et d’ÉLÉMENTS D’ÉQUIPEMENT COMMUN : réparties en fonction de l’UTILITÉ OBJECTIVE que le service présente pour chaque lot, et non des tantièmes. C’est ce qui fait qu’un rez-de-chaussée sans accès par l’ascenseur ne paie pas comme un cinquième étage.',
  'Article 10, second alinéa — charges de CONSERVATION, d’ENTRETIEN et d’ADMINISTRATION des parties communes, et cotisation au fonds de travaux : réparties proportionnellement aux TANTIÈMES du lot.',
  'Utilité objective et non usage réel : celui qui n’emprunte jamais l’ascenseur mais habite au quatrième le paie quand même.',
  'Article 19-2 — impayés : à défaut de versement d’une provision à son échéance, et après une mise en demeure restée sans effet pendant TRENTE JOURS, toutes les provisions non encore échues de l’exercice deviennent immédiatement exigibles. C’est la déchéance du terme, et c’est le levier principal du syndicat.',
];

/** Ce qu'il faut avoir sous les yeux avant de trancher quoi que ce soit. */
export const PIECES = [
  'le règlement de copropriété et l’état descriptif de division — ils priment sur toute supposition, et ils sont propres à l’immeuble',
  'la convocation, avec sa date d’envoi et les pièces jointes à chaque résolution',
  'le procès-verbal, et la DATE DE SA NOTIFICATION — c’est elle qui ouvre le délai, pas la date de l’assemblée',
  'la position exacte portée au procès-verbal : pour, contre, abstention, absent',
  'les tantièmes du lot pour la clé de répartition en cause',
];

/**
 * La table, telle qu'elle part avec la consigne du spécialiste.
 *
 * Elle est placée avant le point de mise en cache, comme le reste de la fiche :
 * elle ne change pas d'une question à l'autre.
 */
export function coproprietePourLeModele(): string {
  const majorites = MAJORITES.flatMap((majorite) => [
    `— ${majorite.nom} (article ${majorite.article}) — ${majorite.calcul}`,
    ...majorite.decisions.map((decision) => `    · ${decision}`),
  ]);

  return [
    'LES MAJORITÉS EN ASSEMBLÉE GÉNÉRALE (faits vérifiés contre les textes joints, à ne pas compléter de mémoire).',
    '',
    'Une résolution votée à la mauvaise majorité est annulable, et l’annulation emporte les travaux, les appels de fonds et le marché signé. Avant de dire « c’est voté », dis à quelle majorité ça devait l’être.',
    '',
    ...majorites,
    '',
    'LES PASSERELLES — ce qui se passe quand la majorité n’est pas atteinte. C’est la partie que la plupart des gens ignorent, y compris des syndics, et elle évite de reconvoquer une assemblée pour rien :',
    ...PASSERELLES.map((passerelle) => `— ${passerelle}`),
    '',
    'LE CALENDRIER DE L’ASSEMBLÉE :',
    ...CALENDRIER.map((ligne) => `— ${ligne}`),
    '',
    'LA RÉPARTITION DES CHARGES :',
    ...CHARGES.map((ligne) => `— ${ligne}`),
    '',
    'AVANT DE TRANCHER, ce qu’il faut avoir sous les yeux. Quand une de ces pièces manque et qu’elle change la réponse, réclame-la au lieu de supposer :',
    ...PIECES.map((piece) => `— ${piece}`),
    '',
    'DEUX RÉFLEXES DE SPÉCIALISTE, à tenir dans chaque réponse de copropriété.',
    'Le règlement de copropriété de CET immeuble peut être plus exigeant que la loi, et il s’impose alors : ne conclus jamais sans avoir dit qu’il faut le vérifier, sauf quand tu l’as sous les yeux.',
    'Et le délai de contestation court de la NOTIFICATION du procès-verbal, jamais de la tenue de l’assemblée. Quand quelqu’un te donne la date de l’assemblée, demande celle de la notification : entre les deux, il peut y avoir un mois.',
  ].join('\n');
}
