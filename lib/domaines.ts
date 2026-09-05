/**
 * Le catalogue des spécialités du droit immobilier.
 *
 * Chaque entrée décrit UN spécialiste : ce qu'il traite, ce qu'il ne traite
 * pas, les textes sur lesquels il s'appuie, et les délais qu'il doit signaler.
 * Ce fichier est du contenu, pas du code : il ne fait aucun appel réseau, ne
 * dépend de rien, et se lit comme une fiche. C'est délibéré — il est la seule
 * source de vérité pour trois choses à la fois : l'aiguillage automatique
 * (`lib/aiguillage.ts`), la consigne donnée au modèle (`lib/juriste.ts`) et ce
 * que le visiteur lit à l'écran. Faire diverger ces trois-là serait le moyen le
 * plus sûr d'avoir un spécialiste qui affiche un périmètre et en applique un
 * autre.
 *
 * ── À qui il parle ──────────────────────────────────────────────────────────
 * À des propriétaires : bailleurs, loueurs en meublé de tourisme,
 * copropriétaires, conciergeries. C'est le public de Volume3D, et ça change
 * tout — pas le droit, mais le point de vue. « Puis-je donner congé ? » et
 * « mon propriétaire peut-il me donner congé ? » appellent la même règle et
 * deux réponses différentes. Les exemples, le vocabulaire et les délais sont
 * écrits du côté du propriétaire. Un locataire qui pose sa question obtient
 * quand même une réponse juste : le spécialiste dit alors depuis quel côté il
 * répond.
 *
 * ── Sur les références ──────────────────────────────────────────────────────
 * `sources` ne contient que des NOMS de textes, jamais de numéros d'article.
 * Un numéro d'article change (recodifications, réformes) et une référence
 * périmée citée devant un juge coûte plus cher que pas de référence du tout.
 * Le modèle reçoit la même consigne : nommer le texte, jamais le numéroter.
 *
 * ── Sur les délais ──────────────────────────────────────────────────────────
 * `delais` est le champ qui justifie à lui seul l'existence de ce fichier. En
 * droit, la faute qu'on ne rattrape pas n'est presque jamais d'avoir mal
 * argumenté : c'est d'avoir laissé passer un délai. Ils sont donc affichés en
 * clair sur la page du spécialiste, avant même la première question, et
 * rappelés au modèle à chaque réponse.
 *
 * Ils sont écrits au 5 septembre 2026 et doivent être revus quand la loi
 * bouge — la location de courte durée en particulier, où deux lois ont changé
 * les règles en trois ans. Aucun n'est présenté comme s'appliquant
 * automatiquement : la règle affichée partout est que la mention portée sur le
 * document reçu, ou la date inscrite au contrat, l'emporte sur cette page.
 */

export type DomaineId =
  | 'bail-habitation'
  | 'courte-duree'
  | 'copropriete'
  | 'achat-vente'
  | 'travaux'
  | 'urbanisme'
  | 'voisinage'
  | 'fiscalite'
  | 'sinistres';

export interface Renvoi {
  /** La situation qui sort du périmètre, telle qu'un propriétaire la formulerait. */
  quand: string;
  vers: DomaineId;
}

export interface Domaine {
  id: DomaineId;
  /** Nom du spécialiste, tel qu'il s'affiche sur sa carte et dans le fil. */
  label: string;
  /** Une ligne sous le titre : de quoi il s'occupe, en langue de tous les jours. */
  resume: string;
  /** Les matières couvertes. Affichées, et données au modèle comme périmètre. */
  matieres: string[];
  /** Ce qui n'est pas de son ressort, et à qui passer la main. */
  renvois: Renvoi[];
  /** Textes de référence, nommés sans numéro d'article (voir l'en-tête). */
  sources: string[];
  /** Délais couperets. Le premier de la liste est le plus souvent décisif. */
  delais: string[];
  /**
   * Termes décisifs pour l'aiguillage : leur présence désigne le domaine à
   * elle seule. « décennale » ne veut dire qu'une chose.
   */
  signaux: string[];
  /**
   * Champ lexical : chacun pèse peu, mais leur accumulation compte. Ils
   * peuvent être partagés entre domaines — « travaux » est partout.
   */
  motsCles: string[];
  /** Questions d'exemple, cliquables. Elles montrent le niveau de précision utile. */
  exemples: string[];
}

/**
 * L'ordre de cette liste est celui de la grille d'accueil, et il est trié par
 * fréquence des besoins d'un propriétaire, pas par ordre alphabétique : le
 * bail et la location courte durée sont ce pour quoi on vient.
 */
export const DOMAINES: Domaine[] = [
  {
    id: 'bail-habitation',
    label: 'Bail d’habitation',
    resume: 'Louer à l’année, vide ou meublé : loyer, congé, dépôt, impayés.',
    matieres: [
      'rédaction et contenu du bail : durée, clauses, annexes obligatoires',
      'loyer : fixation, révision annuelle, encadrement dans les zones concernées',
      'charges : provisions, régularisation annuelle, ce qui est récupérable',
      'dépôt de garantie, état des lieux d’entrée et de sortie, réparations locatives',
      'congé donné par le bailleur : reprise, vente, motif légitime et sérieux',
      'impayés : relance, commandement de payer, clause résolutoire, expulsion',
      'garant, caution solidaire, assurance loyers impayés, colocation',
      'obligations du bailleur : logement décent, entretien, travaux à sa charge',
    ],
    renvois: [
      { quand: 'une location à la nuit ou à la semaine, un meublé de tourisme', vers: 'courte-duree' },
      { quand: 'les charges votées en assemblée générale de l’immeuble', vers: 'copropriete' },
      { quand: 'l’imposition des loyers encaissés', vers: 'fiscalite' },
      { quand: 'un dégât des eaux ou un sinistre à faire indemniser', vers: 'sinistres' },
    ],
    sources: [
      'la loi du 6 juillet 1989 sur les rapports locatifs',
      'le décret sur les charges récupérables et celui sur les réparations locatives',
      'le code civil, pour le louage et la responsabilité',
      'le code des procédures civiles d’exécution, pour l’expulsion',
    ],
    delais: [
      'Congé donné par le bailleur : six mois avant l’échéance du bail pour un logement vide, trois mois pour un meublé. Un congé tardif d’un seul jour ne vaut rien et le bail se reconduit pour trois ans.',
      'Restitution du dépôt de garantie : un mois après la remise des clés si l’état des lieux de sortie est conforme à celui d’entrée, deux mois sinon. Au-delà, la somme due augmente chaque mois de retard.',
      'Révision annuelle du loyer : elle doit être demandée dans l’année qui suit la date convenue, sinon elle est perdue pour cette année-là — elle ne se rattrape pas rétroactivement.',
      'Régularisation des charges : trois ans en arrière, pas davantage, et la même limite vaut pour le locataire qui réclame un trop-versé.',
      'Impayés : après un commandement de payer délivré par commissaire de justice, le locataire dispose d’un délai — six semaines depuis la loi de 2023 — pour régler avant que la clause résolutoire puisse jouer.',
    ],
    signaux: [
      'bail',
      'locataire',
      'depot de garantie',
      'etat des lieux',
      'quittance',
      'conge du bailleur',
      'impaye',
      'encadrement des loyers',
      'clause resolutoire',
      'commandement de payer',
      'expulsion',
      'reparations locatives',
      'regularisation des charges',
      'caution solidaire',
      'irl',
      'indice de reference des loyers',
      'logement decent',
      'preavis du locataire',
      'bail meuble',
      'renouvellement du bail',
      'depart du locataire',
      'diagnostic de performance energetique du logement loue',
    ],
    motsCles: [
      'loyer',
      'location',
      'locative',
      'bailleur',
      'preavis',
      'charges',
      'provision',
      'colocation',
      'garant',
      'meuble',
      'vide',
      'clefs',
      'cles',
      'appartement',
      'logement',
      'louer',
      'annee',
    ],
    exemples: [
      'Mon locataire est parti en laissant deux mois de loyer : par quoi je commence ?',
      'Je veux reprendre mon appartement pour y loger ma fille : quand donner congé ?',
      'Puis-je retenir le dépôt de garantie pour des trous dans les murs ?',
      'J’ai oublié de réviser le loyer l’an dernier : puis-je rattraper ?',
    ],
  },
  {
    id: 'courte-duree',
    label: 'Location courte durée',
    resume: 'Airbnb et meublés de tourisme : déclaration, quotas, taxe, litiges.',
    matieres: [
      'déclaration en mairie et numéro d’enregistrement, selon la commune',
      'changement d’usage, autorisation, compensation dans les villes concernées',
      'limite annuelle de location d’une résidence principale',
      'taxe de séjour : collecte, reversement, part de la plateforme',
      'ce que le règlement de copropriété autorise ou interdit',
      'relations avec les plateformes : annulation, blocage de compte, commissions',
      'litiges voyageurs : dégradations, dépôt de garantie, avis, nuisances',
      'obligations d’information, contrat de location saisonnière, assurance',
      'mandat de conciergerie et gestion déléguée',
    ],
    renvois: [
      { quand: 'une location à l’année, vide ou meublée', vers: 'bail-habitation' },
      { quand: 'une décision d’assemblée générale qui veut interdire la location', vers: 'copropriete' },
      { quand: 'le régime LMNP, le micro-BIC ou l’abattement applicable', vers: 'fiscalite' },
      { quand: 'un dégât causé par un voyageur, à faire prendre en charge', vers: 'sinistres' },
    ],
    sources: [
      'le code du tourisme et le code de la construction et de l’habitation',
      'la loi du 19 novembre 2024 sur les meublés de tourisme',
      'la délibération de votre commune : c’est elle qui fixe l’enregistrement, la compensation et la taxe de séjour',
      'le règlement de copropriété de l’immeuble',
    ],
    delais: [
      'La déclaration en mairie et le numéro d’enregistrement s’obtiennent AVANT la première mise en ligne, dans les communes qui les ont instaurés. Louer sans numéro expose à une amende civile qui se compte en dizaines de milliers d’euros par logement.',
      'Résidence principale : la location est plafonnée à cent vingt jours par an. Au-delà, le logement n’est plus une résidence principale au sens de la règle, et une autorisation de changement d’usage devient nécessaire.',
      'Taxe de séjour : elle se reverse à la périodicité fixée par la commune — souvent deux fois par an. Le retard porte intérêt, et la plateforme qui l’a collectée ne vous en décharge pas toujours.',
      'Contester une décision d’assemblée générale interdisant la location : deux mois à compter de la notification du procès-verbal, et seulement si vous étiez opposant ou absent.',
      'Dégradation par un voyageur : les plateformes enferment la réclamation dans un délai très court, souvent avant l’arrivée du voyageur suivant. C’est un délai contractuel et non légal, mais il s’applique quand même — les photos se prennent le jour du départ.',
    ],
    signaux: [
      'airbnb',
      'booking',
      'meuble de tourisme',
      'location saisonniere',
      'courte duree',
      'numero d enregistrement',
      'changement d usage',
      'taxe de sejour',
      'conciergerie',
      'voyageur',
      '120 jours',
      'declaration en mairie',
      'plateforme de location',
      'compensation',
      'nuitee',
      'sous location touristique',
      'residence principale louee',
      'clause d habitation bourgeoise',
      'check in',
      'annulation de reservation',
    ],
    motsCles: [
      'tourisme',
      'sejour',
      'nuit',
      'reservation',
      'hote',
      'plateforme',
      'annonce',
      'saisonnier',
      'commune',
      'mairie',
      'vacances',
      'louer',
      'voyageurs',
      'menage',
      'linge',
      'residence secondaire',
    ],
    exemples: [
      'Ma ville impose un numéro d’enregistrement : que se passe-t-il si j’ai loué sans ?',
      'Un copropriétaire veut faire interdire la location courte durée en assemblée générale.',
      'Un voyageur a cassé du mobilier : comment me faire indemniser ?',
      'Puis-je louer ma résidence secondaire toute l’année sans autorisation ?',
    ],
  },
  {
    id: 'copropriete',
    label: 'Copropriété',
    resume: 'Assemblée générale, syndic, charges, travaux, règlement.',
    matieres: [
      'assemblée générale : convocation, ordre du jour, majorités, procès-verbal',
      'contester une décision votée, ou faire inscrire une résolution',
      'charges de copropriété : répartition, tantièmes, appels de fonds, impayés',
      'travaux sur parties communes, fonds de travaux, ravalement, ascenseur',
      'syndic : mandat, mise en concurrence, révocation, carences',
      'règlement de copropriété : ce qu’il autorise, comment il se modifie',
      'parties communes et privatives, jouissance exclusive, empiètement',
      'conseil syndical, immatriculation, diagnostic technique global',
    ],
    renvois: [
      { quand: 'ce qui se passe à l’intérieur du logement loué', vers: 'bail-habitation' },
      { quand: 'l’interdiction de louer en meublé de tourisme', vers: 'courte-duree' },
      { quand: 'des malfaçons sur un chantier déjà réceptionné', vers: 'travaux' },
      { quand: 'une autorisation d’urbanisme pour modifier la façade', vers: 'urbanisme' },
    ],
    sources: [
      'la loi du 10 juillet 1965 et son décret d’application de 1967',
      'le règlement de copropriété et l’état descriptif de division de votre immeuble',
      'le code civil, pour la propriété et la responsabilité',
    ],
    delais: [
      'Contester une décision d’assemblée générale : deux mois à compter de la notification du procès-verbal. Ce délai est appliqué avec une rigueur absolue, et il n’est ouvert qu’aux copropriétaires opposants ou absents — celui qui a voté pour ne peut plus revenir dessus.',
      'Convocation à l’assemblée : vingt et un jours au moins avant la séance, avec les documents joints. Une convocation tardive ou incomplète est une cause de nullité, à soulever dans les deux mois du procès-verbal.',
      'Demande d’inscription d’une résolution à l’ordre du jour : elle doit parvenir au syndic assez tôt pour figurer dans la convocation — en pratique, dès la clôture de l’assemblée précédente.',
      'Charges impayées : le syndicat peut les réclamer cinq ans en arrière, et le copropriétaire dispose du même délai pour contester une répartition erronée.',
    ],
    signaux: [
      'copropriete',
      'syndic',
      'assemblee generale',
      'reglement de copropriete',
      'tantieme',
      'millieme',
      'charges de copropriete',
      'conseil syndical',
      'parties communes',
      'appel de fonds',
      'proces verbal d assemblee',
      'coproprietaire',
      'fonds de travaux',
      'ordre du jour',
      'syndicat des coproprietaires',
      'lot',
      'jouissance exclusive',
      'ravalement',
    ],
    motsCles: [
      'immeuble',
      'ascenseur',
      'couloir',
      'facade',
      'toiture',
      'entretien',
      'vote',
      'majorite',
      'resolution',
      'travaux',
      'gardien',
      'palier',
      'cave',
      'parking',
      'balcon',
    ],
    exemples: [
      'L’assemblée a voté un ravalement que je conteste : quel recours et dans quel délai ?',
      'Le syndic ne répond plus depuis six mois : que puis-je faire ?',
      'La répartition des charges d’ascenseur me semble fausse pour mon lot.',
      'Puis-je faire inscrire une résolution à l’ordre du jour ?',
    ],
  },
  {
    id: 'achat-vente',
    label: 'Achat et vente',
    resume: 'Compromis, conditions suspensives, diagnostics, vices cachés.',
    matieres: [
      'offre d’achat, compromis ou promesse : portée, rétractation, séquestre',
      'conditions suspensives, notamment de prêt : rédaction, délais, mise en jeu',
      'diagnostics obligatoires, surface, informations dues à l’acquéreur',
      'vices cachés découverts après la vente, action contre le vendeur',
      'refus de signer, retard du notaire, clause pénale',
      'droit de préemption de la commune, du locataire, des indivisaires',
      'vente d’un bien loué, congé pour vente, droit de préemption du locataire',
      'mandat d’agence, commission, exclusivité',
    ],
    renvois: [
      { quand: 'le congé donné au locataire en place et son préavis', vers: 'bail-habitation' },
      { quand: 'des malfaçons sur des travaux récents encore garantis', vers: 'travaux' },
      { quand: 'la plus-value ou les frais à payer sur la vente', vers: 'fiscalite' },
      { quand: 'la conformité du bien aux autorisations d’urbanisme', vers: 'urbanisme' },
    ],
    sources: [
      'le code civil, pour la vente, la garantie des vices cachés et l’obligation d’information',
      'le code de la construction et de l’habitation',
      'la loi Hoguet, pour les agents immobiliers',
      'le code de l’urbanisme, pour le droit de préemption',
    ],
    delais: [
      'Rétractation de l’acquéreur non professionnel : dix jours à compter du lendemain de la notification du compromis signé. Le vendeur, lui, n’a aucun délai de rétractation — il est engagé dès la signature.',
      'Condition suspensive de prêt : le délai est fixé au contrat, jamais inférieur à un mois. Passé ce terme sans refus notifié, l’acquéreur perd le bénéfice de la condition et risque la clause pénale.',
      'Vice caché : deux ans à compter de la découverte du défaut, sans pouvoir dépasser vingt ans depuis la vente. Le délai court de la découverte, pas de l’achat — mais il faut pouvoir dater cette découverte.',
      'Droit de préemption de la commune : deux mois pour répondre à la déclaration d’intention d’aliéner adressée par le notaire ; le silence vaut renonciation.',
      'Vente d’un logement loué vide : le congé pour vente vaut offre au locataire et se donne six mois avant l’échéance du bail, avec un droit de préemption ouvert deux mois.',
    ],
    signaux: [
      'compromis',
      'promesse de vente',
      'acte authentique',
      'condition suspensive',
      'vice cache',
      'sequestre',
      'droit de preemption',
      'offre d achat',
      'acquereur',
      'clause penale',
      'loi carrez',
      'declaration d intention d aliener',
      'frais de notaire',
      'diagnostic obligatoire',
      'mandat exclusif',
      'signature chez le notaire',
      'refus de pret',
      'conge pour vente',
    ],
    motsCles: [
      'acheter',
      'vendre',
      'achat',
      'vente',
      'notaire',
      'prix',
      'agence immobiliere',
      'mandat',
      'visite',
      'bien',
      'maison',
      'appartement',
      'diagnostic',
      'dpe',
      'pret',
      'banque',
      'vendeur',
    ],
    exemples: [
      'L’acquéreur refuse de signer l’acte alors que le compromis est signé.',
      'J’ai découvert une infiltration trois mois après avoir vendu : suis-je responsable ?',
      'Mon acheteur n’a pas notifié son refus de prêt dans les délais.',
      'Je vends un appartement loué : quelle procédure pour le locataire ?',
    ],
  },
  {
    id: 'travaux',
    label: 'Travaux et malfaçons',
    resume: 'Devis, artisans, réception, garanties, chantier abandonné.',
    matieres: [
      'devis et marché de travaux : contenu, prix, avenants, acomptes',
      'réception des travaux, réserves, procès-verbal',
      'garanties du constructeur : parfait achèvement, bon fonctionnement, décennale',
      'assurance dommages-ouvrage : souscription, déclaration, délais de réponse',
      'malfaçons, désordres, expertise amiable ou judiciaire',
      'abandon de chantier, retard de livraison, pénalités',
      'artisan non assuré, sous-traitance, paiement direct',
      'rénovation énergétique, aides, entreprises RGE',
    ],
    renvois: [
      { quand: 'des travaux votés et payés par la copropriété', vers: 'copropriete' },
      { quand: 'une autorisation à demander avant de commencer', vers: 'urbanisme' },
      { quand: 'des dégâts causés au voisin par le chantier', vers: 'voisinage' },
      { quand: 'un sinistre à déclarer à l’assurance du bien', vers: 'sinistres' },
    ],
    sources: [
      'le code civil, pour le contrat d’entreprise et les garanties légales de construction',
      'le code des assurances, pour la dommages-ouvrage et la responsabilité décennale',
      'le code de la construction et de l’habitation, pour le contrat de construction de maison individuelle',
    ],
    delais: [
      'Garantie décennale : dix ans à compter de la réception des travaux, pour tout désordre qui compromet la solidité ou rend le bien impropre à sa destination. Sans réception, aucune garantie ne court — c’est l’acte le plus important du chantier, et le plus souvent négligé.',
      'Garantie de parfait achèvement : un an après la réception, pour tous les désordres signalés, réserves comprises. C’est la seule qui couvre les défauts esthétiques.',
      'Garantie de bon fonctionnement : deux ans, pour les éléments d’équipement dissociables — volets, chaudière, robinetterie.',
      'Assurance dommages-ouvrage : elle se souscrit AVANT l’ouverture du chantier. Une fois le sinistre déclaré, l’assureur a soixante jours pour se prononcer et quatre-vingt-dix pour proposer une indemnité.',
      'Les réserves se consignent au procès-verbal de réception le jour même : ce qui n’y figure pas est réputé accepté, sauf vice caché.',
    ],
    signaux: [
      'decennale',
      'parfait achevement',
      'biennale',
      'dommages ouvrage',
      'malfacon',
      'reception des travaux',
      'artisan',
      'maitre d oeuvre',
      'devis de travaux',
      'chantier',
      'reserves',
      'ccmi',
      'abandon de chantier',
      'expertise judiciaire',
      'constructeur',
      'entreprise de travaux',
      'sous traitant',
      'desordre',
      'rge',
    ],
    motsCles: [
      'travaux',
      'renovation',
      'fissure',
      'infiltration',
      'toit',
      'plomberie',
      'electricite',
      'isolation',
      'peinture',
      'carrelage',
      'chaudiere',
      'facture',
      'acompte',
      'devis',
      'chantier',
      'retard',
    ],
    exemples: [
      'Des fissures sont apparues deux ans après la fin des travaux : qui paie ?',
      'L’artisan a encaissé l’acompte et ne revient plus sur le chantier.',
      'Je vais réceptionner les travaux : que dois-je écrire au procès-verbal ?',
      'Mon entreprise n’avait pas d’assurance décennale, je viens de le découvrir.',
    ],
  },
  {
    id: 'urbanisme',
    label: 'Urbanisme et autorisations',
    resume: 'Permis, déclaration préalable, PLU, recours, conformité.',
    matieres: [
      'quelle autorisation pour quel projet : déclaration préalable ou permis',
      'instruction du dossier, pièces manquantes, majoration de délai',
      'refus de permis, retrait, recours gracieux et contentieux',
      'recours d’un tiers contre votre permis, affichage sur le terrain',
      'plan local d’urbanisme, zonage, règles de hauteur et d’implantation',
      'changement de destination d’un local, division d’un logement',
      'achèvement des travaux, conformité, contrôle de la mairie',
      'construction sans autorisation, régularisation, prescription',
    ],
    renvois: [
      { quand: 'l’exécution du chantier et les malfaçons', vers: 'travaux' },
      { quand: 'une autorisation de l’assemblée générale pour modifier la façade', vers: 'copropriete' },
      { quand: 'un litige de limite ou de vue avec le voisin', vers: 'voisinage' },
      { quand: 'le changement d’usage pour louer en meublé de tourisme', vers: 'courte-duree' },
    ],
    sources: [
      'le code de l’urbanisme',
      'le plan local d’urbanisme de votre commune, qui prime sur les généralités',
      'le code de justice administrative, pour les recours',
    ],
    delais: [
      'Recours d’un tiers contre un permis : deux mois à compter du premier jour d’un affichage régulier et continu sur le terrain. Un panneau mal posé ou retiré trop tôt rouvre le délai pendant six mois après l’achèvement — photographiez le panneau, daté, dès le premier jour.',
      'Recours contre un refus de permis : deux mois à compter de la notification. Un recours gracieux formé dans ce délai le proroge, et le compteur repart à la réponse ou au silence gardé pendant deux mois.',
      'Retrait d’un permis par la mairie elle-même : trois mois après sa délivrance, pas au-delà.',
      'Validité du permis : trois ans pour ouvrir le chantier, prorogeable deux fois un an sur demande déposée avant l’expiration.',
      'Après la déclaration d’achèvement, la mairie a trois mois pour contester la conformité — cinq mois en secteur protégé.',
    ],
    signaux: [
      'permis',
      'declaration prealable',
      'plu',
      'urbanisme',
      'certificat d urbanisme',
      'affichage du permis',
      'recours des tiers',
      'daact',
      'changement de destination',
      'architecte des batiments de france',
      'abf',
      'surface de plancher',
      'emprise au sol',
      'refus de permis',
      'conformite des travaux',
      'zone protegee',
      'tribunal administratif',
      'recours gracieux',
    ],
    motsCles: [
      'mairie',
      'commune',
      'affichage',
      'autorisation',
      'construire',
      'agrandir',
      'extension',
      'veranda',
      'piscine',
      'abri de jardin',
      'cadastre',
      'terrain',
      'hauteur',
      'garage',
      'combles',
      'division',
    ],
    exemples: [
      'La mairie a refusé mon permis pour une extension : quel recours ?',
      'Un voisin attaque mon permis : mon affichage était-il valable ?',
      'Puis-je transformer mon garage en studio à louer ?',
      'J’ai construit un abri sans déclaration il y a quatre ans : que risque-t-on ?',
    ],
  },
  {
    id: 'voisinage',
    label: 'Voisinage et limites',
    resume: 'Bruit, vues, mitoyenneté, bornage, plantations, servitudes.',
    matieres: [
      'troubles anormaux de voisinage : bruit, odeurs, fumées, vis-à-vis',
      'limites de propriété, bornage amiable ou judiciaire, empiètement',
      'mur mitoyen, clôture, participation aux frais',
      'plantations : distances, hauteurs, élagage, branches et racines',
      'vues et jours : distances à respecter pour une fenêtre ou une terrasse',
      'servitudes : passage, écoulement des eaux, canalisation',
      'nuisances causées par des locataires ou des voyageurs',
      'conciliation, constat, mise en demeure, action en justice',
    ],
    renvois: [
      { quand: 'une autorisation de construire contestée', vers: 'urbanisme' },
      { quand: 'un bruit venant des parties communes ou d’un autre lot', vers: 'copropriete' },
      { quand: 'des dégâts matériels à faire indemniser par une assurance', vers: 'sinistres' },
      { quand: 'des nuisances causées par vos propres voyageurs', vers: 'courte-duree' },
    ],
    sources: [
      'le code civil, pour la propriété, les servitudes, la mitoyenneté et les plantations',
      'le principe jurisprudentiel du trouble anormal de voisinage, désormais inscrit dans le code civil',
      'le code de la santé publique, pour les bruits de voisinage',
      'les usages locaux de votre département, qui priment parfois sur les distances générales',
    ],
    delais: [
      'Trouble anormal de voisinage : cinq ans pour agir, à compter du jour où le trouble a été connu. Un trouble qui se répète fait courir un nouveau délai à chaque fois.',
      'Bornage et actions portant sur la propriété elle-même : trente ans. C’est aussi le délai au terme duquel une occupation prolongée peut faire acquérir un droit — un empiètement toléré trop longtemps devient difficile à faire cesser.',
      'Servitude de passage : elle s’acquiert par trente ans d’usage continu et apparent, ou par titre. Laisser passer sans rien écrire pendant des années n’est jamais neutre.',
      'Avant toute action en justice pour un litige de voisinage de faible montant, une tentative de conciliation ou de médiation est obligatoire : sans elle, la demande est déclarée irrecevable.',
    ],
    signaux: [
      'voisin',
      'trouble anormal',
      'mitoyennete',
      'bornage',
      'servitude de passage',
      'elagage',
      'empietement',
      'cloture mitoyenne',
      'nuisance sonore',
      'tapage',
      'geometre',
      'vue droite',
      'mur mitoyen',
      'plantation',
      'haie',
      'conciliateur de justice',
      'droit de passage',
      'racines',
    ],
    motsCles: [
      'bruit',
      'odeur',
      'fumee',
      'arbre',
      'branche',
      'limite',
      'terrain',
      'jardin',
      'cloture',
      'mur',
      'fenetre',
      'terrasse',
      'vis a vis',
      'chien',
      'piscine',
    ],
    exemples: [
      'Les arbres du voisin dépassent sur mon terrain : puis-je les couper ?',
      'Mon voisin a construit une terrasse qui donne directement chez moi.',
      'Il conteste la limite entre nos deux terrains : comment faire borner ?',
      'Mes locataires se plaignent du bruit du voisin : est-ce mon affaire ?',
    ],
  },
  {
    id: 'fiscalite',
    label: 'Fiscalité du bien',
    resume: 'LMNP, revenus fonciers, plus-value, taxe foncière, contrôle.',
    matieres: [
      'louer en meublé : LMNP, LMP, micro-BIC ou régime réel, amortissement',
      'louer vide : revenus fonciers, micro-foncier, régime réel, déficit foncier',
      'meublé de tourisme : abattements applicables, classement, seuils',
      'plus-value à la revente : abattements, exonérations, résidence principale',
      'taxe foncière, taxe d’habitation sur résidence secondaire, surtaxe',
      'cotisation foncière des entreprises et TVA sur les locations',
      'déclaration d’activité, guichet unique, obligations comptables',
      'contrôle fiscal, proposition de rectification, réclamation',
    ],
    renvois: [
      { quand: 'la rédaction du bail ou un litige avec le locataire', vers: 'bail-habitation' },
      { quand: 'la déclaration en mairie et les quotas de location', vers: 'courte-duree' },
      { quand: 'la vente elle-même et ses conditions', vers: 'achat-vente' },
    ],
    sources: [
      'le code général des impôts',
      'le livre des procédures fiscales',
      'la doctrine publiée au BOFiP, opposable à l’administration',
    ],
    delais: [
      'Réclamation contre un impôt : jusqu’au 31 décembre de la deuxième année suivant la mise en recouvrement ou le versement. Le sursis de paiement doit être demandé DANS la réclamation : demandé après, il ne suspend plus rien.',
      'Répondre à une proposition de rectification : trente jours, prorogeables trente jours sur simple demande. Le silence vaut acceptation du redressement.',
      'Option pour le régime réel : elle s’exerce avant la date limite de déclaration et engage pour l’année — trois ans en revenus fonciers, avec reconduction tacite.',
      'Début d’une activité de location meublée : la déclaration auprès du guichet unique se fait dans les quinze jours, faute de quoi le numéro SIRET manque au moment de déclarer.',
      'Droit de reprise de l’administration : trois ans en principe, bien davantage en cas d’activité occulte ou de revenus non déclarés.',
    ],
    signaux: [
      'lmnp',
      'lmp',
      'micro bic',
      'revenus fonciers',
      'taxe fonciere',
      'plus value',
      'amortissement',
      'deficit foncier',
      'regime reel',
      'taxe d habitation',
      'ifi',
      'abattement',
      'cotisation fonciere des entreprises',
      'cfe',
      'guichet unique',
      'micro foncier',
      'proposition de rectification',
      'controle fiscal',
      'siret',
      'bofip',
    ],
    motsCles: [
      'impot',
      'fiscal',
      'declaration',
      'revenus',
      'charges deductibles',
      'tva',
      'exoneration',
      'recettes',
      'comptable',
      'benefice',
      'imposable',
      'meuble',
      'louer',
      'vendre',
    ],
    exemples: [
      'Micro-BIC ou réel pour un meublé qui rapporte 18 000 € par an ?',
      'Puis-je amortir le bien et déduire les travaux en LMNP ?',
      'Comment est calculée la plus-value sur un bien détenu depuis douze ans ?',
      'J’ai reçu une proposition de rectification sur mes revenus locatifs.',
    ],
  },
  {
    id: 'sinistres',
    label: 'Sinistres et assurances',
    resume: 'Dégât des eaux, incendie, expertise, indemnisation, recours.',
    matieres: [
      'déclaration d’un sinistre : forme, délais, pièces à fournir',
      'dégât des eaux : recherche de fuite, convention entre assureurs, franchise',
      'incendie, tempête, catastrophe naturelle, sécheresse et fissures',
      'assurance propriétaire non occupant, multirisque, garanties utiles',
      'expertise : contre-expertise, désaccord sur le montant',
      'recours contre le locataire, le voisin, la copropriété ou l’artisan',
      'garantie loyers impayés : conditions, mise en jeu, refus de prise en charge',
      'défaut d’assurance du locataire, résiliation du contrat par l’assureur',
    ],
    renvois: [
      { quand: 'l’obligation d’assurance du locataire inscrite au bail', vers: 'bail-habitation' },
      { quand: 'un sinistre dont l’origine est dans les parties communes', vers: 'copropriete' },
      { quand: 'un désordre relevant de la garantie décennale d’un artisan', vers: 'travaux' },
      { quand: 'un dommage causé par le voisin lui-même', vers: 'voisinage' },
    ],
    sources: [
      'le code des assurances',
      'le contrat d’assurance et ses conditions générales, qui fixent garanties et franchises',
      'la convention IRSI, appliquée entre assureurs pour les dégâts des eaux courants',
      'le code civil, pour la responsabilité et les recours',
    ],
    delais: [
      'Prescription en assurance : deux ans à compter de l’événement qui donne naissance à l’action. C’est le délai le plus court et le plus méconnu du droit immobilier — passé deux ans, un refus d’indemnisation ne se conteste plus.',
      'Déclarer un sinistre : cinq jours ouvrés en principe, deux jours ouvrés pour un vol, dix jours après la publication de l’arrêté pour une catastrophe naturelle.',
      'Dégât des eaux courant : la convention entre assureurs organise la prise en charge sous des plafonds précis ; au-delà, chacun reprend ses recours, et l’expertise devient contradictoire.',
      'Contre-expertise : elle se demande avant d’accepter l’indemnité proposée. Un accord signé sur un montant se défait très difficilement.',
    ],
    signaux: [
      'degat des eaux',
      'sinistre',
      'assurance habitation',
      'pno',
      'proprietaire non occupant',
      'contre expertise',
      'indemnisation',
      'franchise',
      'catastrophe naturelle',
      'incendie',
      'irsi',
      'declaration de sinistre',
      'assureur',
      'multirisque',
      'garantie loyers impayes',
      'gli',
      'fuite',
      'tempete',
      'vetuste',
    ],
    motsCles: [
      'assurance',
      'inondation',
      'reparation',
      'expert',
      'contrat',
      'prime',
      'plafond',
      'refus',
      'indemnite',
      'humidite',
      'voisin',
      'locataire',
    ],
    exemples: [
      'Une fuite chez mon locataire a abîmé l’appartement du dessous : qui déclare ?',
      'Mon assureur refuse d’indemniser en invoquant un défaut d’entretien.',
      'L’expert propose 2 000 € pour un sinistre qui en coûte 7 000 : que faire ?',
      'La garantie loyers impayés refuse de jouer parce que le dossier était incomplet.',
    ],
  },
];

const PAR_ID = new Map<DomaineId, Domaine>(DOMAINES.map((domaine) => [domaine.id, domaine]));

export function estDomaineId(value: unknown): value is DomaineId {
  return typeof value === 'string' && PAR_ID.has(value as DomaineId);
}

/** Lève si l'identifiant est inconnu : un domaine manquant est un bug, pas un cas. */
export function domaine(id: DomaineId): Domaine {
  const found = PAR_ID.get(id);
  if (!found) throw new Error(`Domaine inconnu : ${id}`);
  return found;
}

export function domaineOuNull(id: unknown): Domaine | null {
  return estDomaineId(id) ? domaine(id) : null;
}
