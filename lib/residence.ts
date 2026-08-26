/**
 * ORIEL — la résidence, ses cotes et son texte.
 *
 * Ce fichier ne dessine rien. Il tient **la trame du bâtiment** et **le texte
 * de la page**, pour une raison simple : les deux disent les mêmes nombres.
 * « Douze étages », « 6 648 m² », « cinquante-huit logements » ne sont pas des
 * chiffres d'agence tapés à la main dans une section « nos chiffres » — ce
 * sont des mesures de la géométrie que `components/three/edifice.ts` monte à
 * l'écran, calculées ici par la même fonction d'empreinte.
 *
 * C'est la seule façon d'éviter le défaut classique de ces pages : un compteur
 * qui annonce quarante-deux étages au-dessus d'une image qui en montre douze.
 * Personne ne compte les étages, mais tout le monde le sent.
 *
 * Sur la langue : le reste du site est en français, cette page est en anglais.
 * Ce n'est pas une inadvertance. C'est une page de démonstration — la vitrine
 * de ce que Volume3D sait rendre — adressée au marché où ce langage-là se
 * parle, celui des agences d'architecture et de la promotion haut de gamme.
 * Les identifiants restent français, comme partout ailleurs dans le dépôt.
 */

import * as THREE from 'three';

/* ================================================================= trame === */

/** Trame de façade. Tout se cale dessus : meneaux, largeurs, redans. */
export const TRAME = 1.8;
/** Hauteur d'étage, dalle à dalle. */
export const ETAGE = 3.55;
/** Nombre de niveaux courants au-dessus du socle. */
export const NIVEAUX = 12;
/** Épaisseur du nez de dalle vu de l'extérieur. */
export const NEZ = 0.42;
/** Le socle, une fois et demie plus haut qu'un étage courant. */
export const SOCLE = ETAGE * 1.6;
/** Retrait du bandeau vitré derrière le nez de dalle. */
export const RETRAIT = 0.2;

export interface Empreinte {
  /** Demi-largeur, en mètres. */
  hx: number;
  /** Demi-profondeur, en mètres. */
  hz: number;
  /** Décalage du centre sur l'axe des x : c'est lui qui fait le redan. */
  dx: number;
}

/**
 * Empreinte du niveau `n`.
 *
 * Trois redans successifs, tous du même côté, et c'est le sujet du bâtiment :
 * une masse qui s'allège en montant et dégage trois terrasses. Un empilement
 * constant donnerait une tour ; un empilement qui se retire donne une
 * silhouette, et une silhouette se reconnaît de loin.
 */
export function empreinte(niveau: number): Empreinte {
  if (niveau < 5) return { hx: 9 * TRAME, hz: 6 * TRAME, dx: 0 };
  if (niveau < 8) return { hx: 7.5 * TRAME, hz: 6 * TRAME, dx: -1.5 * TRAME };
  if (niveau < 11) return { hx: 6 * TRAME, hz: 5 * TRAME, dx: -3 * TRAME };
  return { hx: 4.5 * TRAME, hz: 4 * TRAME, dx: -4.5 * TRAME };
}

/* ================================================================= hall === */

/**
 * Le hall, en cotes.
 *
 * Le rez n'est pas seulement vu du dehors : le vol s'y termine. Ses cotes
 * servent donc à trois endroits — la géométrie qui le construit, la caméra qui
 * y entre, et le test qui vérifie que la caméra y est bien. D'où leur place
 * ici plutôt que dans le fichier de rendu.
 */
export const HALL = {
  /** Demi-largeur dans œuvre, en mètres. */
  hx: 9 * TRAME - TRAME / 2,
  /** Demi-profondeur dans œuvre. */
  hz: 6 * TRAME - TRAME / 2,
  /** Hauteur libre sous plafond. */
  haut: ETAGE * 1.6 - 0.25,
  /** Demi-largeur de la porte, sur la face +x. */
  porte: 4,
} as const;

/* ========================================================= appartement === */

/**
 * L'appartement, et pourquoi la page ne montre plus que lui.
 *
 * La première version faisait le tour du bâtiment puis y entrait : vue
 * aérienne, parvis, hall, atrium, séjour. C'était une belle promenade et une
 * mauvaise démonstration. Volume3D ne vend pas des immeubles — il vend la
 * reconstitution d'un **logement**, et un client qui regarde la page veut y
 * voir ce qu'on lui livrera : ses pièces, une par une, meublées, à hauteur
 * d'œil.
 *
 * Le bâtiment reste construit autour — c'est ce qu'on voit par les baies, et
 * c'est ce qui donne au séjour son cinquième étage. Mais la caméra n'en sort
 * plus, et tout ce qu'elle ne peut plus voir a été retiré de la scène : le
 * hall, ses silhouettes, l'atrium et ses coursives ne coûtent plus rien
 * puisqu'on ne les regarde plus. C'est ce budget-là qui est repassé dans le
 * mobilier, les cloisons et la lumière des pièces.
 */

/** Le niveau où se trouve l'appartement. Le premier redan lui donne sa terrasse. */
export const NIVEAU_APPARTEMENT = 5;

/** Altitude du plancher brut du niveau `n`, en mètres. */
export function altitudeNiveau(n: number): number {
  return SOCLE + 0.25 + n * ETAGE;
}

/** Altitude du sol fini de l'appartement. */
export const SOL = altitudeNiveau(NIVEAU_APPARTEMENT) + 0.12;
/** Hauteur sous plafond. */
export const SOUS_PLAFOND = 3.0;

export interface Piece {
  nom: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/**
 * Le plan.
 *
 * Une bande de service à l'ouest — entrée, chambre, salle de bains — et une
 * bande de jour à l'est, ouverte d'un bout à l'autre, qui prend les deux
 * façades vitrées. C'est la distribution d'un angle, et c'est la seule qui
 * tienne ici : sur les quatre côtés de l'étage, deux seulement sont vitrés,
 * et il n'y a aucune raison de donner le jour à un couloir quand on peut le
 * donner à un séjour de soixante-seize mètres carrés.
 *
 * L'entrée est le pivot : on y arrive, et de là on va à l'est vers le jour, au
 * nord vers la chambre, au sud vers les bains. Aucune pièce ne se traverse
 * pour en atteindre une autre, ce qui est la première chose qu'on regarde sur
 * un plan et la dernière qu'on pardonne.
 */
export const PIECES: Record<string, Piece> = {
  entree: { nom: 'Entrée', x0: -3.6, x1: 0.6, z0: 3.0, z1: 6.6 },
  sejour: { nom: 'Séjour', x0: 0.6, x1: 10.6, z0: 3.0, z1: 10.6 },
  cuisine: { nom: 'Cuisine', x0: 0.6, x1: 10.6, z0: -1.4, z1: 3.0 },
  chambre: { nom: 'Chambre', x0: -3.6, x1: 0.6, z0: 6.6, z1: 10.6 },
  bains: { nom: 'Salle de bains', x0: -3.6, x1: 0.6, z0: -1.4, z1: 3.0 },
};

/** L'emprise de la terrasse, dégagée par le premier redan. */
export const TERRASSE = { x0: 10.8, x1: 16.2, z0: 1.0, z1: 10.6 } as const;

/** La baie coulissante, sur la façade est : c'est par là qu'on sort. */
export const BAIE = { z0: 6.4, z1: 9.2 } as const;

/** Épaisseur d'une cloison de distribution. */
export const CLOISON = 0.12;
/** Hauteur d'une porte intérieure. */
export const PORTE = 2.25;

export interface Refend {
  /** Vrai si la cloison est un plan `x = fixe` ; faux pour un plan `z = fixe`. */
  selonZ: boolean;
  fixe: number;
  de: number;
  a: number;
  /** Les passages, en cotes absolues sur l'axe libre, avec leur hauteur. */
  trous: [number, number, number][];
}

/*
 * Les cloisons, ici et pas dans le modèle.
 *
 * Elles y étaient — trois appels dans `appartement.ts`, avec les cotes des
 * portes écrites à la main. Le jour où l'on a voulu vérifier que **la caméra
 * franchit chaque cloison par une ouverture**, il n'y avait rien à vérifier :
 * le test aurait dû recopier les cotes, donc recopier l'erreur.
 *
 * Elles remontent donc dans le fichier qui fait déjà autorité sur le plan. Le
 * modèle les lit, le test les lit, et une porte déplacée déplace les deux.
 */
export const CLOISONS: Refend[] = [
  /* La cloison maîtresse, entre la bande de service et la bande de jour. Son
     unique passage fait 1,80 m et n'a pas de porte : c'est la respiration du
     plan, et une porte y ferait un couloir de ce qui est un dégagement. */
  { selonZ: true, fixe: 0.6, de: -1.4, a: 10.6, trous: [[4.2, 6.0, SOUS_PLAFOND]] },
  // Entrée / chambre, et entrée / bains : deux portes de quatre-vingt-dix.
  /* La porte de la chambre a glissé vers l'est. Elle était à l'aplomb du
     dressing, qui court tout le long du même mur : on ne pouvait pas entrer
     dans la chambre, et la caméra ne s'en privait pas — elle traversait la
     cloison. C'est le genre d'erreur qu'un plan dessiné à la main ne fait
     jamais et qu'un plan écrit en chiffres fait tout le temps. */
  { selonZ: false, fixe: 6.6, de: -3.6, a: 0.6, trous: [[-0.5, 0.4, PORTE]] },
  { selonZ: false, fixe: 3.0 - CLOISON, de: -3.6, a: 0.6, trous: [[-2.8, -1.9, PORTE]] },
];

/** Surface d'une pièce, en mètres carrés. */
export function surfacePiece(p: Piece): number {
  return (p.x1 - p.x0) * (p.z1 - p.z0);
}

/** Surface habitable, cloisons non déduites. */
export function surfaceAppartement(): number {
  return Object.values(PIECES).reduce((somme, p) => somme + surfacePiece(p), 0);
}

/* ================================================================== vol === */

/**
 * Une étape du vol : où est l'œil, ce qu'il regarde, et avec quel foyer.
 *
 * Les cotes sont en mètres, dans le repère du bâtiment. C'est un changement de
 * nature par rapport à la première version de cette page, qui décrivait la
 * caméra en coordonnées sphériques — rayon, azimut, site autour d'un axe. Ce
 * vocabulaire-là ne sait dire qu'une chose : tourner autour. Il ne peut pas
 * exprimer « passer sous la marquise », encore moins « entrer ».
 */
export interface Etape {
  /** Position du curseur de défilement où cette étape est atteinte. */
  t: number;
  /** L'œil. */
  oeil: [number, number, number];
  /** Le point visé. */
  vise: [number, number, number];
  /** Champ vertical, en degrés. Un long foyer écrase, un court exagère. */
  foyer: number;
  /**
   * Panoramique, en degrés. Positif pousse le bâtiment vers la droite du cadre.
   *
   * C'est le seul réglage de la liste qui ne parle pas du bâtiment mais de la
   * **page**. Le titre du premier écran tient la moitié gauche du cadre ; sans
   * panoramique, le vol place la masse en plein dessous. Un cadreur ne recule
   * pas pour régler cela — il panote, et c'est bien un panoramique et non une
   * translation : la perspective ne change pas, seulement la place dans
   * l'image. Il s'annule à l'entrée : dans le hall, ce qu'on regarde est au
   * centre parce que c'est là qu'est le mur.
   */
  pan?: number;
  /**
   * La section de la page sur laquelle cette étape se cale.
   *
   * Les `t` écrits ci-dessous sont un **repli**, pas une vérité : la vraie
   * position d'une section dépend de la longueur de son texte, de la largeur
   * de l'écran et de la taille de la fonte, c'est-à-dire de trois choses
   * qu'aucun nombre écrit ici ne peut connaître. Elle est donc relevée dans le
   * document au montage, et à chaque changement de forme de la page.
   *
   * Ce n'est pas une précaution théorique : la première version calait ses
   * fractions à la main, et ajouter deux sections a suffi pour que l'arrêt de
   * l'atrium tombe quinze pour cent trop loin — on arrivait dans la verrière
   * au lieu du puits.
   */
  ancre?: string;
  /** Décalage depuis le haut de l'ancre, en hauteurs d'écran. */
  ecran?: number;
}

/**
 * Le vol.
 *
 * Huit étapes, et une seule idée : **on avance, on ne tourne pas.** La caméra
 * part haut et loin, dans la brume de l'heure dorée où le bâtiment n'est
 * encore qu'une masse ; elle descend en se rapprochant, passe à hauteur
 * d'homme sur le parvis, s'engage sous la marquise, franchit les portes et
 * s'arrête dans le hall, devant le nom gravé sur le marbre.
 *
 * Deux choses qui ne se voient pas dans les nombres mais qui font tout :
 *
 *  · **les étapes se resserrent.** Cinquante mètres entre les deux premières,
 *    treize entre les deux dernières. Comme le paramètre avance linéairement
 *    d'une étape à l'autre, la caméra ralentit toute seule à mesure qu'elle
 *    approche — c'est ce que fait une caméra de publicité, et cela n'a coûté
 *    aucune courbe d'accélération : c'est la géométrie qui le donne ;
 *  · **le foyer s'ouvre en chemin,** de trente-deux à quarante-six degrés,
 *    puis se referme à trente-huit dans le hall. Un champ qui s'élargit pendant
 *    qu'on avance accentue la fuite des lignes : c'est l'effet Vertigo, dosé au
 *    quart de ce qu'il faudrait pour qu'on le remarque. Refermé à l'arrivée, il
 *    rend au hall ses proportions justes.
 *
 * Les valeurs de `t` suivent les sections de la page : 0 le premier écran,
 * 0,14 la présentation, 0,28 l'architecture, puis les trois écrans de la
 * galerie, les chiffres et l'appel final.
 */
export const VOL: Etape[] = [
  /*
   * Dix arrêts, tous à hauteur d'œil, tous **depuis un seuil ou un angle**.
   *
   * Deux règles, et la seconde a coûté une série de captures pour rien.
   *
   * `SOL + 1,55` partout, sans exception : c'est la hauteur d'où l'on regarde
   * une pièce quand on la visite, et la seule qui permette de comparer deux
   * pièces entre elles. Une caméra qui monte à deux mètres pour « mieux
   * montrer » aplatit le plafond et agrandit la pièce ; c'est le mensonge le
   * plus courant de l'image immobilière, et le plus vite démasqué à la visite.
   *
   * Et **une petite pièce se cadre depuis sa porte, au grand angle**. Placée en
   * son milieu au foyer du séjour, la chambre rendait un mur gris sur les deux
   * tiers de l'image : à deux mètres quarante d'une cloison, quarante-six
   * degrés ne cadrent pas une chambre, ils cadrent une cloison. Soixante
   * degrés depuis l'angle de la porte la montrent entière — c'est exactement
   * ce que fait un photographe d'intérieur, et pour la même raison.
   */
  /* L'entrée, **sur le seuil** et non au fond.
     Au fond de l'entrée, le cadre est aux trois quarts rempli par la cloison
     qu'on a devant soi et l'ouverture n'occupe qu'un tiers de la largeur : la
     première image du logement était celle d'un couloir. Posée dans
     l'embrasure, la même caméra ne voit plus que le séjour et son angle vitré.
     C'est l'arrivée telle qu'on la vit — on ne s'arrête pas sur le paillasson
     pour regarder une porte. */
  { t: 0.0, ancre: '#top', oeil: [0.5, 25.35, 4.9], vise: [10.4, 25.2, 9.4], foyer: 58 },
  /* Le séjour, pris de son angle nord-ouest : on longe le canapé, la table à
     manger vient au fond, et la baie tient toute la droite du cadre. */
  { t: 0.12, ancre: '#sejour', oeil: [2.0, 25.35, 9.8], vise: [10.4, 25.2, 4.4], foyer: 54 },
  /* La cuisine, dans l'axe du linéaire : l'îlot au premier plan, la baie au
     fond. */
  { t: 0.24, ancre: '#cuisine', oeil: [1.4, 25.35, 2.6], vise: [10.2, 25.15, -0.6], foyer: 54 },
  /* Galerie I — le coin salon, vu depuis l'angle vitré. On regarde vers
     l'intérieur : c'est le seul plan qui montre l'appartement de dos. */
  { t: 0.37, ancre: '#galerie', oeil: [9.8, 25.35, 9.8], vise: [1.6, 25.15, 4.2], foyer: 52 },
  /*
   * Galerie II — la baie, et le point de netteté **dehors**.
   *
   * La direction n'a pas changé d'un degré ; seule la distance du point visé
   * est passée de onze mètres à cinquante-cinq. C'est le même geste qu'un
   * photographe qui fait le point à travers une fenêtre : ce qu'on regarde
   * n'est pas la vitre, c'est ce qu'il y a derrière.
   *
   * Sans cela, la profondeur de champ — réglée sur ce que la caméra vise —
   * mettait toute la ville au-delà de quarante-six mètres dans un flou complet.
   * On avait construit une ville pour la regarder par une baie, et on l'avait
   * mise hors champ par un nombre.
   */
  /* Cent cinquante mètres, et non cinquante-cinq. Même direction au degré
     près, mais le point de netteté était encore trop près : à cinquante-cinq
     mètres, le flou s'installe à soixante-quatorze et sature à deux cent
     trente — c'est-à-dire sur toute la ville, qui commence à cent cinquante.
     Le plan dont le sujet est la vue rendait donc la vue en bouillie. À cent
     cinquante, le premier rang de toitures est net et seul le lointain part
     dans la brume : c'est ce que fait un œil qui regarde par une fenêtre. */
  { t: 0.47, ancre: '#galerie', ecran: 1, oeil: [5.0, 25.35, 7.0], vise: [154.4, 21.4, 20.4], foyer: 46 },
  /* Galerie III — la diagonale complète : treize mètres de l'angle est
     jusqu'au fond de l'entrée, à travers l'ouverture. C'est ce plan-là qui dit
     la surface, bien mieux qu'un chiffre. */
  { t: 0.57, ancre: '#galerie', ecran: 2, oeil: [10.0, 25.35, 3.6], vise: [-3.2, 25.2, 5.6], foyer: 50 },
  /*
   * Les transits, et pourquoi il y en a cinq.
   *
   * Une visite qui va du séjour à la chambre passe par l'entrée et par une
   * porte. Le vol, lui, allait tout droit : il traversait la cloison maîtresse
   * hors de son passage, puis le mur de la chambre à côté de sa porte, deux
   * fois, à l'aller et au retour. Personne ne l'avait vu, et pour une raison
   * précise — **les captures sont prises aux arrêts**, et à un arrêt la caméra
   * est toujours dans une pièce. Ce qui se passait entre deux arrêts n'était
   * photographié par rien.
   *
   * C'est un test qui l'a dit, pas un rendu (`la caméra franchit chaque
   * cloison par une ouverture`). Les cinq points ci-dessous sont sa réponse :
   * ils ne sont pas des cadrages, ce sont des **passages** — un devant chaque
   * porte, et deux dans la respiration entre bande de jour et bande de
   * service. Le vol y ralentit à peine, et il y traverse de l'air.
   */
  /* Devant la porte de la chambre, dans l'entrée. */
  { t: 0.63, oeil: [-0.05, 25.35, 5.5], vise: [-1.4, 25.2, 9.2], foyer: 56 },
  /* La chambre, depuis sa porte. */
  /* Depuis l'angle sud-est, et non depuis le pied du lit. Posée à cinquante
     centimètres du matelas, la caméra ne cadrait plus une chambre : elle
     cadrait un drap. Une pièce de quatre mètres sur quatre se prend de son
     coin le plus dégagé, et c'est celui de la porte. */
  { t: 0.68, ancre: '#chambre', oeil: [0.15, 25.35, 7.15], vise: [-1.6, 25.15, 10.3], foyer: 60 },
  /* On ressort de la chambre, puis on se présente devant la salle de bains. */
  { t: 0.72, oeil: [-1.0, 25.35, 4.4], vise: [-2.6, 25.2, 1.2], foyer: 58 },
  { t: 0.76, oeil: [-2.5, 25.35, 3.6], vise: [-2.6, 25.15, 0.2], foyer: 60 },
  /* La salle de bains, depuis sa porte également, dans l'axe de la baignoire. */
  /* Depuis le seuil, en diagonale sur l'angle sud-ouest : la double vasque
     prend la gauche du cadre, la baignoire le fond, la douche la droite. Visée
     dans l'axe de la pièce, on ne cadrait qu'un mur — dix-huit mètres carrés
     de pierre claire résumés à un aplat et à une baignoire vue de dessus. */
  /*
   * On cadre la vasque, pas la baignoire.
   *
   * Quatre réglages de lumière n'y ont rien fait, et c'est le signe qu'on
   * réglait la mauvaise chose. Dans l'axe de la pièce, ce plan montrait une
   * baignoire vue de flanc — une grande boîte claire — devant un grand mur
   * clair : quatre-vingts pour cent de l'image en surfaces lisses de même
   * valeur. Aucune source ne sauve un cadrage qui n'a rien à montrer.
   *
   * De trois quarts sur l'angle de la vasque, le même mètre carré contient la
   * réglette, le miroir, la crédence de pierre, les deux robinets, la pile de
   * serviettes et le retour de la baignoire. Ce sont des objets, ils ont des
   * tailles différentes et des matières différentes, et c'est exactement ce
   * que photographie quelqu'un dont le métier est de vendre une salle de
   * bains. Le point à un mètre quarante laisse le reste de la pièce partir
   * dans le flou, ce qui est la façon la plus simple de dire dix-huit mètres
   * carrés sans avoir à les cadrer.
   */
  /*
   * Reculée de soixante centimètres, une fois la vasque posée.
   *
   * Le paragraphe ci-dessus annonçait un cadre contenant « la réglette, le
   * miroir, la crédence, les deux robinets, la pile de serviettes et le retour
   * de la baignoire ». Le sondage du cadre — `CADRE=1 ARRETS=6-bains npm run
   * residence` — donnait autre chose : trente pour cent de miroir sombre,
   * vingt et un et demi pour cent de plateau de marbre nu, et une seule des
   * deux vasques, coupée par le bas de l'image. L'intention était juste, le
   * point de vue ne la servait pas.
   *
   * L'angle de trois quarts est conservé — c'est lui qui avait été choisi
   * après quatre essais — mais l'œil recule vers le seuil. Ce n'est possible
   * que **depuis que les vasques existent** : reculer sur un plateau vide
   * n'aurait fait que montrer plus de vide.
   */
  /*
   * Deux fautes que les tests ont attrapées sur ce seul point de vue, et qui
   * valent d'être écrites : reculer une caméra n'est pas qu'un choix de cadre.
   *
   * L'œil était monté à 25,42 — sept centimètres au-dessus de la hauteur d'œil
   * que **toutes** les étapes partagent. Un vol dont un plan se hausse sur la
   * pointe des pieds se sent au défilement sans qu'on sache le nommer.
   *
   * Et le chemin depuis l'étape précédente franchissait la cloison `z = 2,88`
   * à `x = −1,93`, soit trois centimètres à côté de sa porte : la caméra
   * passait à travers le mur. Ce n'est pas rattrapable à l'œil — le mur défile
   * en une fraction de seconde — et c'est exactement pourquoi le franchissement
   * est vérifié contre les ouvertures du plan.
   */
  { t: 0.79, ancre: '#bains', oeil: [-2.1, 25.35, 2.7], vise: [-3.3, 24.95, 1.2], foyer: 56 },
  /* Et le chemin inverse : la porte, l'entrée, le passage, le séjour. */
  { t: 0.82, oeil: [-2.5, 25.35, 3.7], vise: [-1.0, 25.2, 5.6], foyer: 58 },
  { t: 0.85, oeil: [0.9, 25.35, 5.1], vise: [6.0, 25.2, 6.6], foyer: 54 },
  /* Transit : on retraverse le séjour et on franchit la baie coulissante. */
  { t: 0.88, oeil: [7.0, 25.35, 7.9], vise: [14.0, 25.15, 8.2], foyer: 50 },
  /*
   * Une étape **dans l'ouvrant**, et c'est un test qui l'a réclamée.
   *
   * Le franchissement de la façade était vérifié en interpolant une droite
   * entre l'étape d'avant et celle d'après : elle passait à z = 8,82, bien au
   * milieu de la baie. Mais le vol n'est pas une droite, et une Catmull-Rom
   * déborde derrière ses points : la courbe réelle franchissait la façade à
   * z = 9,40, c'est-à-dire **à travers un vitrage fixe**, vingt centimètres au
   * nord du coulissant. Personne ne pouvait le voir — cela dure une fraction
   * de seconde, et aucune capture d'arrêt ne tombe là.
   *
   * Une étape posée dans l'ouverture épingle la courbe : une spline passe par
   * ses points de contrôle, elle ne fait déborder qu'entre eux.
   */
  { t: 0.9, oeil: [10.9, 25.35, 8.2], vise: [13.6, 25.0, 6.2], foyer: 52 },

  /* La terrasse, et la netteté portée à cent vingt mètres : le sujet de ce
     plan n'est ni le platelage ni la rambarde, c'est la ville. */
  /* Reculée contre la baie et **inclinée vers le bas** : le plan de la section
     « terrasse » ne montrait pas la terrasse. La caméra était posée en son
     milieu, à l'horizontale, et cadrait la ville par-dessus le garde-corps —
     très bien pour un plan de vue, absurde pour un plan dont le sujet est
     cinquante-deux mètres carrés de platelage. Cinq degrés de plongée et deux
     mètres de recul, et le garde-corps, la jardinière et le nez de terrasse
     tiennent le premier plan au lieu de sortir du cadre par le bas. La
     netteté reste portée à cent vingt mètres : on incline le cadre, on ne
     change pas le point — un plan dont le sujet est une vue et dont le
     premier plan est une terrasse doit être net des deux bouts.

     Une plongée plus forte a été essayée — quinze degrés — pour faire entrer
     le platelage lui-même. Elle ne marche pas : à un mètre soixante sous
     l'œil, le platelage n'entre dans le cadre qu'au prix d'un acrotère qui
     mange le tiers bas de l'image, et on échange une terrasse qu'on ne voit
     pas contre un muret qu'on voit trop. */
  /*
   * Troisième essai, et le premier qui montre la terrasse : on la regarde
   * **en long**.
   *
   * Les deux essais racontés ci-dessus partent du même point de vue — debout
   * au milieu, tourné vers le dehors — et ne discutent que de l'inclinaison.
   * De là, le platelage est sous les pieds : aucun angle ne le fait entrer
   * dans le cadre sans faire entrer d'abord l'acrotère. Le sondage a chiffré
   * ce que cela donnait : `CADRE=1 ARRETS=7-terrasse npm run residence`
   * comptait **3,3 % de bois** dans le plan d'une section intitulée
   * « cinquante-deux mètres carrés de plus, dehors », contre 34 % de ciel.
   *
   * Depuis l'extrémité nord, la terrasse n'est plus sous les pieds : elle est
   * devant, sur neuf mètres soixante, avec ses trois usages alignés — le salon
   * bas, la table de six, les bains de soleil — et la ville par-dessus le
   * garde-corps, à gauche. C'est le plan que fait n'importe qui dont le métier
   * est de vendre une terrasse, et il n'avait pas été essayé.
   *
   * La netteté descend de cent vingt mètres à sept, et c'est le sujet qui
   * change, pas un réglage : le chapô et les trois chiffres de cette section
   * parlent tous de la terrasse et aucun de la ville. La ville reste dans le
   * cadre, derrière, adoucie — ce qu'elle doit être quand le sujet est au
   * premier plan.
   */
  { t: 0.93, ancre: '#terrasse', oeil: [12.5, 25.35, 9.3], vise: [12.9, 24.55, 2.6], foyer: 52 },
  /*
   * Le dernier plan : on sort, et on se retourne.
   *
   * Neuf plans sur dix sont pris de l'intérieur, et c'était le bon choix — la
   * page vend un appartement, pas une tour. Mais terminer dedans laissait le
   * visiteur sans **adresse** : il avait traversé cent soixante-dix mètres
   * carrés sans jamais voir dans quoi ils étaient. Le dernier écran recule
   * donc de quatre-vingt-quinze mètres et se retourne sur l'immeuble entier,
   * redan compris — la terrasse qu'on vient de quitter s'y voit, au cinquième,
   * sur la façade est.
   *
   * Le point de vue est au sud-est, et ce n'est pas indifférent : le soleil
   * est à dix-huit degrés d'azimut, donc à l'est-nord-est. En se plaçant à
   * l'opposé on aurait un contre-jour — une silhouette noire sur un ciel
   * clair, spectaculaire une fois et illisible ensuite. D'ici, la façade est
   * est en pleine lumière et la façade sud dans l'ombre : deux valeurs sur un
   * même volume, ce qui est la seule façon de faire lire une masse bâtie.
   *
   * Et il est **bas** — trente mètres, à peine au-dessus du cinquième. Le
   * premier essai regardait de quarante et un mètres, et la tour en sortait
   * noire : un vitrage vertical renvoie ce qui lui fait face en miroir, donc
   * vu de haut il renvoie la ville, qui est sombre. Descendu à hauteur de
   * façade, le même vitrage renvoie la bande claire de l'horizon — et un
   * immeuble de verre redevient un immeuble de verre.
   *
   * La sortie passe par la baie coulissante, qui est ouverte à cet étage-là :
   * l'œil franchit une ouverture, pas un mur.
   */
  { t: 1.0, ancre: '#contact', oeil: [84, 30, -46], vise: [4.5, 26.0, 1.0], foyer: 46 },
];

/*
 * Les deux courbes du vol, et pourquoi elles vivent ici.
 *
 * Elles étaient construites dans le composant de rendu, et le test qui vérifie
 * que la caméra franchit chaque cloison par une ouverture interpolait donc
 * **en droite** entre deux étapes, en se justifiant ainsi : « la spline reste
 * dans l'enveloppe convexe de ses points de contrôle, donc une droite qui
 * passe dans l'ouverture y passe aussi ».
 *
 * C'est faux. Une Catmull-Rom **interpole** ses points et déborde derrière
 * eux ; la variante centripète garantit l'absence de boucle et de rebroussement,
 * pas le confinement. Mesuré : entre l'étape à z = 9,8 et l'étape à z = 7,0, la
 * caméra atteint z = 10,44 — au-delà des deux — et arrive ainsi à vingt et un
 * centimètres du vitrage nord, pour un plan avant de caméra à vingt. Un
 * centimètre de marge, sur une trajectoire qu'une dérive fait respirer.
 *
 * Les courbes remontent donc dans le fichier qui fait autorité sur le vol. Le
 * composant les lit, le test les échantillonne, et c'est le vol réel qui est
 * vérifié et non son ombre rectiligne.
 */
export function courbeOeil(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    VOL.map((e) => new THREE.Vector3(...e.oeil)),
    false,
    'centripetal',
    0.5,
  );
}

export function courbeVise(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    VOL.map((e) => new THREE.Vector3(...e.vise)),
    false,
    'centripetal',
    0.5,
  );
}

/* =============================================================== mesures === */

/** Surface de plancher de l'immeuble, tous niveaux courants confondus. */
export function surfacePlancher(): number {
  let total = 0;
  for (let n = 0; n < NIVEAUX; n += 1) {
    const e = empreinte(n);
    total += e.hx * 2 * (e.hz * 2);
  }
  return total;
}

/** Hauteur hors tout, du parvis à l'arase du couronnement. */
export function hauteurHorsTout(): number {
  return SOCLE + 0.25 + NIVEAUX * ETAGE + 2.1;
}

/** Nombre de terrasses dégagées par les redans. */
export function terrasses(): number {
  let compte = 0;
  for (let n = 0; n + 1 < NIVEAUX; n += 1) {
    if (empreinte(n + 1).hx < empreinte(n).hx) compte += 1;
  }
  return compte;
}

/**
 * Nombre de logements.
 *
 * Deux ratios, et ils ne sont pas décoratifs : dix-huit pour cent de la
 * surface part en circulations, gaines et locaux communs — c'est la fourchette
 * basse d'un immeuble d'habitation à un seul noyau — et le logement moyen fait
 * cent dix mètres carrés, ce qui est la définition même du haut de gamme et
 * ce que la trame de 1,80 m permet de découper proprement.
 */
export function logements(): number {
  const utile = surfacePlancher() * 0.82;
  return Math.round(utile / 110);
}

/* ================================================================= texte === */

/**
 * Tout le texte du projet, en français.
 *
 * Il l'était en anglais, et c'était une erreur d'appréciation : Volume3D vend
 * à des propriétaires et à des conciergeries francophones, et une page de
 * démonstration qui parle une autre langue que ses clients démontre surtout
 * qu'on ne leur parle pas.
 *
 * Sur la forme, le texte a changé de nature autant que de langue. Il tenait en
 * paragraphes ; il tient maintenant en **fiches** — une clé, une valeur — et
 * en phrases courtes. La raison n'est pas typographique : derrière ce texte il
 * y a un bâtiment, et un pavé de six lignes posé au milieu de l'écran le
 * cache. Une fiche de trois lignes en bord de cadre informe autant et ne cache
 * rien.
 */

export interface Fait {
  cle: string;
  valeur: string;
}

/** Un des trois grands chiffres du projet. */
export interface Chiffre {
  valeur: string;
  libelle: string;
  precision: string;
}

export interface Trait {
  numero: string;
  titre: string;
  texte: string;
}

export interface Vue {
  titre: string;
  texte: string;
}

/** Une section de texte : un surtitre, un titre coupé à la main, des fiches. */
export interface Section {
  surtitre: string;
  titre: readonly string[];
  chapeau?: string;
  faits: readonly Fait[];
}

/*
 * La copie affichée, et sa typographie.
 *
 * Les deux-points portent une **espace fine insécable** (U+202F) et non une
 * espace ordinaire. Ce n'est pas une coquetterie : sans elle, le navigateur
 * coupe la ligne devant le deux-points quand la colonne est étroite, et la
 * capture en 390 × 844 de la section « chambre » commençait une ligne par
 * « : on donne le jour du matin ». Un test le vérifie sur toute la copie —
 * `la ponctuation double porte son espace insécable`.
 */
export const PROJET = {
  nom: 'ORIEL',
  lieu: 'Rive gauche — îlot 14 · 5ᵉ étage',
  titre: ['Cent soixante-dix mètres carrés,', 'pièce par pièce.'],
  chapo:
    'Un appartement d’angle au cinquième, deux façades vitrées et cinq mètres quarante de terrasse. Faites défiler : vous le traversez.',
  action: 'Entrer',
} as const;

export const NAVIGATION: { href: string; label: string }[] = [
  { href: '#sejour', label: 'Séjour' },
  { href: '#cuisine', label: 'Cuisine' },
  { href: '#chambre', label: 'Chambre' },
  { href: '#terrasse', label: 'Terrasse' },
];

export const SEJOUR: Section = {
  surtitre: 'Le séjour',
  titre: ['Soixante-seize mètres carrés', 'et deux façades.'],
  chapeau:
    'L’angle prend le jour de l’est et du nord. Rien ne coupe la pièce : la cuisine s’y ouvre sans porte, et la baie file d’un mur à l’autre.',
  faits: [
    { cle: 'Surface', valeur: '76,0 m²' },
    { cle: 'Sous plafond', valeur: '3,00 m' },
    { cle: 'Façades vitrées', valeur: 'deux' },
  ],
};

export const CUISINE: Section = {
  surtitre: 'La cuisine',
  titre: ['Ouverte,', 'mais pas au milieu du salon.'],
  chapeau:
    'Elle occupe la moitié sud de la bande de jour : l’îlot regarde la baie, les rangements sont contre le mur aveugle. On cuisine face à la lumière et on range dans l’ombre.',
  faits: [
    { cle: 'Surface', valeur: '44,0 m²' },
    { cle: 'Îlot', valeur: '3,40 × 1,10 m' },
    { cle: 'Linéaire', valeur: '6,20 m' },
  ],
};

export const CHAMBRE: Section = {
  surtitre: 'La chambre',
  titre: ['Sur la façade nord,', 'loin de la rue.'],
  chapeau:
    'Elle est la seule pièce de la bande de service à toucher une façade vitrée, et c’est délibéré : on donne le jour du matin à la pièce où l’on se réveille.',
  faits: [
    { cle: 'Surface', valeur: '16,8 m²' },
    { cle: 'Lit', valeur: '180 × 200 cm' },
    { cle: 'Dressing', valeur: '2,10 m de front' },
  ],
};

export const BAINS: Section = {
  surtitre: 'La salle de bains',
  titre: ['Baignoire, douche,', 'double vasque.'],
  chapeau:
    'Dix-huit mètres carrés, en pierre claire. Elle n’a pas de fenêtre — c’est le prix d’un séjour de soixante-seize mètres carrés, et c’est le bon arbitrage.',
  faits: [
    { cle: 'Surface', valeur: '18,5 m²' },
    { cle: 'Baignoire', valeur: '1,80 m' },
    { cle: 'Douche', valeur: 'à l’italienne' },
  ],
};

export const GALERIE: { surtitre: string; vues: Vue[] } = {
  surtitre: 'Galerie',
  vues: [
    {
      titre: 'Le coin salon',
      texte: 'Vu depuis l’angle vitré, dos à la ville : le seul plan qui montre l’appartement de dos.',
    },
    {
      titre: 'La baie',
      texte: 'Toute hauteur, coulissante sur deux mètres quatre-vingts. Derrière, la terrasse.',
    },
    {
      titre: 'La diagonale',
      texte: 'Onze mètres de l’angle est jusqu’à l’entrée. C’est ce plan qui dit la surface, mieux qu’un chiffre.',
    },
  ],
};

/*
 * La terrasse a maintenant sa section.
 *
 * Elle n'en avait pas : elle servait de décor au bloc d'appel, dont le
 * surtitre annonçait « La terrasse » avant un titre qui parlait de tout autre
 * chose. Cinquante-deux mètres carrés — le tiers de la surface annoncée en
 * haut de page — passaient ainsi en fond d'un formulaire de contact. Le lien
 * « Terrasse » de la navigation menait au pied de page.
 */
export const TERRASSE_SECTION: Section = {
  surtitre: 'La terrasse',
  titre: ['Cinquante-deux mètres carrés', 'de plus, dehors.'],
  chapeau:
    'Le redan du cinquième la dégage sur toute la façade est. Cinq mètres quarante de profondeur : c’est une pièce, pas un balcon — on y met une table de six et deux bains de soleil sans que rien ne se touche.',
  faits: [
    { cle: 'Surface', valeur: '52 m²' },
    { cle: 'Profondeur', valeur: '5,40 m' },
    { cle: 'Orientation', valeur: 'plein est' },
  ],
};

export const APPEL = {
  surtitre: 'L’adresse',
  titre: ['Votre bien,', 'reconstruit en volume.'],
  texte:
    'Envoyez un plan, une surface, ou rien du tout. On modélise le volume, on l’éclaire, et on rend un lien que vos visiteurs traversent — exactement comme celui-ci.',
  action: 'Nous écrire',
} as const;

/** Les trois chiffres du projet, mesurés sur la géométrie. */
export function chiffres(): Chiffre[] {
  return [
    {
      valeur: surfaceAppartement().toFixed(1).replace('.', ','),
      libelle: 'm² habitables',
      precision: `${Object.keys(PIECES).length} pièces, cloisons non déduites`,
    },
    {
      valeur: String(NIVEAU_APPARTEMENT),
      libelle: 'ᵉ étage',
      precision: `sur ${NIVEAUX}, dans un immeuble de ${hauteurHorsTout().toFixed(1).replace('.', ',')} m`,
    },
    {
      valeur: ((TERRASSE.x1 - TERRASSE.x0) * (TERRASSE.z1 - TERRASSE.z0)).toFixed(0),
      libelle: 'm² de terrasse',
      precision: `${(TERRASSE.x1 - TERRASSE.x0).toFixed(2).replace('.', ',')} m de profondeur, plein est`,
    },
  ];
}
