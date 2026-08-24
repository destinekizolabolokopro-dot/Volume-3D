/**
 * Les couleurs du logement, et pourquoi celles-là.
 *
 * Source unique : la scène 3D lit ce fichier, l'étude (`npm run palette`) le lit
 * aussi, et un test vérifie que la scène n'utilise rien d'autre. Sans ça, la
 * palette étudiée et la palette rendue divergent au premier ajustement.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE L'ÉTUDE A MONTRÉ
 *
 * La première version peignait tout l'intérieur dans une seule famille beige,
 * les surfaces ne se distinguant que par la clarté. Mesuré en ΔE2000, le résultat
 * était sans appel : un battant de porte à 2,4 de son mur, un placard à 2,3 —
 * en dessous de 3, deux surfaces côte à côte forment un aplat. À l'écran, ça se
 * voyait exactement comme ça : le placard du séjour se lisait comme un trou dans
 * le mur, et la porte ouverte disparaissait.
 *
 * Et le remède évident ne marchait pas. Éclaircir la menuiserie dans la même
 * famille chaude plafonne autour de ΔE 2,5 : on peut monter jusqu'à la limite
 * du rendu sans jamais franchir le seuil de perception.
 *
 * Ce qui marche, c'est de **baisser la saturation** plutôt que de monter la
 * clarté. À clarté presque égale, passer de C 6,8 à C 1,6 fait passer l'écart de
 * 2,6 à 4,8. Et c'est exactement ainsi qu'un appartement est peint dans la vraie
 * vie : les murs dans un blanc chaud, les boiseries dans un blanc neutre. L'œil
 * lit la différence de **température**, pas de luminosité.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA STRUCTURE
 *
 * Trois familles, et une seule note de couleur.
 *
 *  · **La coque** — murs, plafond, menuiseries, sols. Blancs chauds et neutres,
 *    plus un chêne. C'est le fond, il ne doit rien réclamer.
 *  · **Le mobilier** — des tons rompus, tous séparés d'au moins 4 de leurs
 *    voisins immédiats.
 *  · **L'extérieur** — palier, façade d'en face, sol lointain. Plus sourds et
 *    plus froids : c'est ce qui fait que l'intérieur paraît chaud.
 *
 * La note de couleur est un pétrole rompu, à six degrés de teinte de l'accent de
 * la marque. Ce n'est pas une coquetterie : c'est la seule couleur franche de la
 * scène, elle tombe donc forcément sur le canapé, c'est-à-dire au centre de la
 * première pièce qu'on voit. Qu'elle rime avec la marque plutôt que de lui
 * répondre au hasard coûte zéro et se remarque. Les coussins, eux, prennent une
 * terre cuite à 139° de là — presque le complémentaire, la seule opposition
 * franche qu'on s'autorise, et sur quarante centimètres de côté.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES BORNES
 *
 * Aucune valeur ne sort de 50–240 en sRGB. Au-dessus, une surface renvoie
 * presque toute la lumière et sa teinte se noie dans le blanc ; en dessous, elle
 * n'en renvoie plus assez pour éclairer ses voisines et l'image s'éteint. C'est
 * la règle admise en rendu physique, et c'est elle qui explique qu'un intérieur
 * peint en « blanc pur » rende systématiquement plat.
 */

/* =================================================================== coque === */

export const SHELL = {
  /** Murs : blanc chaud. L 89,6 · C 6,0 · teinte 92°. */
  mur: 0xe6e1d6,
  /** Plafond : blanc neutre, plus clair et surtout plus froid. ΔE 4,8 du mur. */
  plafond: 0xf0efec,
  /** Menuiseries — plinthes, chambranles, battants, dormants de fenêtre. */
  menuiserie: 0xf0efec,
  /** Parquet de chêne. L 64,4 · C 30,4 · teinte 72°. */
  chene: 0xbd9569,
  /** Lames de parquet : un chêne un rien plus sombre, pour marquer les joints. */
  chene_joint: 0xa9835a,
  /** Carrelage de salle d'eau : gris neutre, il tranche avec le mobilier. */
  carrelage: 0xc5c5c3,
} as const;

/* ================================================================ mobilier === */

export const FURNITURE = {
  /** Le plâtre d'une moulure — rosace, cimaise. Peint avec le plafond, donc
   *  presque blanc, mais assez en dessous pour que le relief se lise. */
  platre: 0xeae7e0,
  /** Placards, cuisine, douche : un grège franchement sous le mur. */
  cabinet: 0xcfc8b6,
  /** Plateaux, chevets, tête de lit : un bois plus foncé que le sol. */
  bois: 0x8e7860,
  /** Literie et tapisserie neutre. */
  lin: 0xaba393,
  /** La note de couleur : pétrole rompu, à 6° de l'accent de la marque. */
  petrole: 0x68847e,
  /** La contre-note : terre cuite, à 139° du pétrole. Coussins et jeté. */
  terre: 0xa86a52,
  /** Assises et piètements sombres. */
  sombre: 0x635a4e,
  /** Tapis : le sol tranquille sous la note de couleur. */
  tapis: 0x8b8271,
  /** Poignées, potence de luminaire. */
  laiton: 0xb08d4a,
} as const;

/* ============================================================== extérieur === */

export const OUTSIDE = {
  /** Pierre de la cage d'escalier. */
  palier: 0x8f8577,
  /** Tomettes du palier. */
  palier_sol: 0x655d53,
  /** Porte palière : peinte foncé, comme dans tout immeuble ancien. */
  porte: 0x33413b,
  /** Le sol de la rue, sept mètres plus bas. */
  rue: 0x6b675e,
  /** La façade d'en face, et celle de derrière — plus claire car plus loin. */
  vis_a_vis: 0xb2a898,
  vis_a_vis_loin: 0xc6bfb2,

  /* --- Le dehors d'une maison. Rien de tout cela ne sert à l'appartement. ---
   *
   * Les verts sont franchement désaturés, et c'est la seule chose à savoir sur
   * eux. L'herbe et le feuillage réels le sont : un vert de nuancier, posé
   * derrière une baie de trois mètres soixante, fait basculer toute la balance
   * de l'image et le séjour prend une teinte d'aquarium. Ils descendent aussi
   * en clarté à mesure qu'ils s'éloignent de l'œil — pelouse, haie — puis
   * remontent au loin, parce que c'est ce que fait l'atmosphère. */

  /** La pelouse, autour de la maison. */
  pelouse: 0x7d8f63,
  /** La haie qui borne le jardin : plus sombre, elle pose l'horizon. */
  haie: 0x5d7050,
  /** Les masses d'arbres du fond, éclaircies par la distance. */
  lointain: 0x8fa07f,
  /** Dalles du perron et de l'allée. */
  dalle: 0xa8a49a,
  /** L'enduit de la maison, vu du dehors : auvent, jambages, bandeau. */
  enduit: 0xd6cfc0,
  /** L'ardoise du toit. Sombre, mais dans la plage utile du rendu. */
  toit: 0x5c5f63,
} as const;

/** Tous les matériaux du logement, à plat. Sert à l'étude et au contrôle. */
export const MATERIALS = { ...SHELL, ...FURNITURE, ...OUTSIDE } as const;

export type MaterialName = keyof typeof MATERIALS;
export type FurnitureTone = keyof typeof FURNITURE;

/**
 * Les surfaces qui se touchent réellement à l'écran.
 *
 * On ne compare pas tout avec tout : deux couleurs qui ne se côtoient jamais
 * peuvent être identiques sans que personne ne s'en aperçoive. Ce qui se mesure,
 * c'est l'arête entre deux surfaces.
 */
export const ADJACENT: [MaterialName, MaterialName][] = [
  ['mur', 'menuiserie'],
  ['mur', 'plafond'],
  ['mur', 'chene'],
  ['mur', 'carrelage'],
  ['mur', 'cabinet'],
  ['mur', 'lin'],
  ['mur', 'petrole'],
  ['menuiserie', 'chene'],
  ['menuiserie', 'carrelage'],
  ['chene', 'chene_joint'],
  ['chene', 'tapis'],
  ['chene', 'bois'],
  ['chene', 'sombre'],
  ['chene', 'petrole'],
  ['tapis', 'petrole'],
  ['petrole', 'terre'],
  ['cabinet', 'lin'],
  ['cabinet', 'menuiserie'],
  ['cabinet', 'carrelage'],
  ['bois', 'lin'],
  ['bois', 'sombre'],
  ['bois', 'laiton'],
  ['bois', 'terre'],
  ['lin', 'tapis'],
  ['palier', 'palier_sol'],
  ['palier', 'porte'],
  ['porte', 'laiton'],
  ['vis_a_vis', 'vis_a_vis_loin'],
];

/**
 * Le joint de parquet fait exception, et c'est voulu.
 *
 * Deux lames voisines d'un même parquet ne doivent surtout **pas** être
 * séparées de 4 : ce sont des lames, pas deux matériaux. Le seuil y est
 * inversé — il faut que l'écart reste petit, sinon le sol se lit comme un
 * damier.
 */
export const SUBTLE: [MaterialName, MaterialName][] = [['chene', 'chene_joint']];

/** Écart minimal exigé entre deux surfaces voisines. */
export const MIN_SEPARATION = 4;
/** Écart maximal toléré pour une nuance interne à un même matériau. */
export const MAX_SUBTLETY = 12;

/* ============================================================== matière === */

/*
 * La rugosité des surfaces.
 *
 * La couleur ne fait pas la matière. Deux surfaces du même beige — un mur
 * peint et un plan de travail — se distinguent d'abord par la façon dont elles
 * renvoient la lumière : le mur la diffuse entièrement, le plan de travail en
 * garde une trace directionnelle. Un moteur qui ignore cette différence rend
 * tout en papier, quelle que soit la justesse du nuancier.
 *
 * Les valeurs suivent la convention habituelle : 0 est un miroir, 1 est un
 * diffuseur parfait. Les repères viennent des relevés de matériaux publiés pour
 * les moteurs temps réel, ramenés à ce qu'on trouve dans un logement parisien.
 *
 *  · peinture mate murale        0,90 – 0,95
 *  · peinture satinée boiserie   0,50 – 0,60
 *  · parquet chêne vitrifié      0,35 – 0,45
 *  · carrelage émaillé           0,20 – 0,30
 *  · tissu, laine                0,90 – 1,00
 *  · laiton brossé               0,30 – 0,40, métal
 *
 * Ce qui se voit, concrètement : la plinthe et la corniche prennent un reflet
 * que le mur n'a pas, donc elles se détachent sans qu'on ait eu à les peindre
 * d'une autre couleur — et c'est exactement ce que fait la peinture satinée
 * dans un vrai appartement.
 */
export const ROUGHNESS = {
  mur: 0.93,
  plafond: 0.95,
  menuiserie: 0.55,
  parquet: 0.42,
  carrelage: 0.26,
  verre: 0.06,
  /* Dehors : la pierre et l'enrobé ne renvoient rien de directionnel à cette
     distance, et un reflet sur un immeuble à trente mètres ne ferait que
     attirer l'œil hors de la fenêtre. */
  dehors: 0.95,
} as const;

/** Rugosité du mobilier, par teinte du nuancier. */
export const FURNITURE_ROUGHNESS: Record<keyof typeof FURNITURE, number> = {
  /* Le plâtre d'une moulure : mat comme le mur, mais pas tout à fait — il est
     peint avec le plafond, donc un rien plus lisse que l'enduit brut. */
  platre: 0.9,
  cabinet: 0.5,
  bois: 0.55,
  lin: 0.95,
  petrole: 0.88,
  terre: 0.88,
  sombre: 0.62,
  tapis: 0.98,
  laiton: 0.35,
};

/** Ce qui est métallique. Le laiton, et rien d'autre : un métal mal placé se
 *  voit immédiatement, parce qu'il devient noir là où rien ne se reflète. */
export const FURNITURE_METAL: Partial<Record<keyof typeof FURNITURE, number>> = {
  laiton: 0.85,
};
