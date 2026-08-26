/**
 * La profondeur de champ.
 *
 * Un rendu d'architecture net partout est un rendu de synthèse : aucun
 * objectif ne fait cela. C'est même le signe le plus fiable qu'une image est
 * calculée — plus fiable que les matières, plus fiable que la lumière. Une
 * caméra a un plan de netteté, et tout ce qui est loin derrière s'y dissout.
 *
 * L'implémentation est délibérément la plus économe qui donne l'effet, parce
 * que la page doit rester fluide sur un téléphone :
 *
 *  1. la scène est rendue une fois dans une cible, avec sa profondeur ;
 *  2. la couleur est floutée **en demi-résolution**, treize échantillons sur
 *     deux anneaux. Un flou en demi-résolution coûte le quart d'un flou en
 *     pleine résolution et donne, à rayon égal, exactement la même image :
 *     c'est du flou, il n'y a rien à y perdre en finesse ;
 *  3. on mélange net et flou en fonction de la distance.
 *
 * Trois choix qui méritent d'être écrits :
 *
 * **Seul l'arrière-plan est flouté.** Un vrai objectif floute aussi ce qui est
 * devant le plan de netteté. Ici la caméra frôle des colonnes et un montant de
 * porte, et flouter un premier plan qui passe à cinquante centimètres de
 * l'objectif se lit comme un bug, pas comme une intention. On ne floute donc
 * que ce qui est plus loin que le point visé.
 *
 * **Le point de netteté est la cible du vol**, pas un réglage. La caméra fait
 * le point sur ce qu'elle regarde ; c'est ce que fait un cadreur, et cela
 * évite d'avoir un second jeu de nombres à tenir en accord avec le premier.
 *
 * **Tout se passe en linéaire.** Les deux cibles sont en demi-flottant, sans
 * espace colorimétrique : three y écrit la valeur tonemappée sans l'encoder,
 * on mélange des lumières et non des valeurs d'affichage — un flou calculé sur
 * du sRGB assombrit les transitions — et l'encodage final est fait ici, une
 * seule fois, au moment d'écrire à l'écran.
 */

import * as THREE from 'three';

/** Le rapport entre la résolution du flou et celle de l'image. */
const DEMI = 0.5;

const PLAN = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/*
 * Treize échantillons, sur deux anneaux et un centre.
 *
 * Une grille carrée de treize points laisse voir sa grille sur les points
 * lumineux ; deux anneaux tournés l'un par rapport à l'autre donnent un
 * bokeh rond, qui est ce qu'un diaphragme produit. Les rayons sont dans le
 * rapport 1 à 1,8 : plus serré, les deux anneaux se confondent ; plus large,
 * on voit un halo séparé du centre.
 */
/*
 * Les douze directions sont écrites une par une, sans tableau ni boucle.
 *
 * Ce n'est pas de la maladresse : les tableaux à initialiseur constant
 * appartiennent à GLSL ES 3.00, et une page qui doit tourner partout ne peut
 * pas se le permettre. Douze lignes lisibles valent mieux qu'une boucle qui ne
 * compile pas sur la moitié des téléphones.
 */
const FLOU = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tImage;
  uniform vec2 uPas;

  void main() {
    vec3 somme = texture2D(tImage, vUv).rgb;
    somme += texture2D(tImage, vUv + vec2( 1.000,  0.000) * uPas).rgb;
    somme += texture2D(tImage, vUv + vec2( 0.500,  0.866) * uPas).rgb;
    somme += texture2D(tImage, vUv + vec2(-0.500,  0.866) * uPas).rgb;
    somme += texture2D(tImage, vUv + vec2(-1.000,  0.000) * uPas).rgb;
    somme += texture2D(tImage, vUv + vec2(-0.500, -0.866) * uPas).rgb;
    somme += texture2D(tImage, vUv + vec2( 0.500, -0.866) * uPas).rgb;
    somme += texture2D(tImage, vUv + vec2( 1.556,  0.900) * uPas).rgb;
    somme += texture2D(tImage, vUv + vec2( 0.000,  1.800) * uPas).rgb;
    somme += texture2D(tImage, vUv + vec2(-1.556,  0.900) * uPas).rgb;
    somme += texture2D(tImage, vUv + vec2(-1.556, -0.900) * uPas).rgb;
    somme += texture2D(tImage, vUv + vec2( 0.000, -1.800) * uPas).rgb;
    somme += texture2D(tImage, vUv + vec2( 1.556, -0.900) * uPas).rgb;
    gl_FragColor = vec4(somme / 13.0, 1.0);
  }
`;

/*
 * Le seuil de l'éclat.
 *
 * Un objectif n'est pas parfait : devant une surface très lumineuse, une part
 * de la lumière se disperse dans le verre et déborde sur ce qui l'entoure.
 * C'est ce débordement — et non la netteté, ni le nombre de polygones — qui
 * fait qu'une image de synthèse se met à ressembler à une prise de vue. Un
 * nez de dalle au soleil doit mordre sur le ciel derrière lui.
 *
 * On extrait donc ce qui dépasse un seuil, on le floute très large, et on le
 * rajoute. Trois précisions qui décident du résultat :
 *
 * **Le seuil porte sur la luminance et non sur les canaux.** Seuiller canal
 * par canal fait virer les couleurs : un orange chaud franchit le seuil par
 * le rouge seul et son halo sort rouge vif.
 *
 * **La transition est douce** — `smoothstep` sur un quart de niveau. Un seuil
 * franc dessine dans le ciel le contour exact de l'iso-luminance, et cette
 * ligne-là se voit comme un défaut de compression.
 *
 * **Tout se passe en quart de résolution.** Un halo n'a aucun détail à
 * perdre : c'est la définition d'un halo. Les trois passes coûtent ensemble
 * moins d'un dixième d'une passe pleine résolution.
 */
const SEUIL = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tImage;
  uniform float uSeuil;

  void main() {
    vec3 couleur = texture2D(tImage, vUv).rgb;
    float clarte = dot(couleur, vec3(0.2126, 0.7152, 0.0722));
    float part = smoothstep(uSeuil, uSeuil + 0.25, clarte);
    gl_FragColor = vec4(couleur * part, 1.0);
  }
`;

/*
 * L'occlusion ambiante, calculée à partir du tampon de profondeur.
 *
 * C'est ce que tous les moteurs de jeu ont et que cette scène n'avait pas. Elle
 * porte déjà une occlusion **cuite** — dans les sommets, à la construction —
 * mais celle-là ne sait que ce que le code lui a dit : un mur est sombre au ras
 * du sol parce qu'on a écrit qu'il devait l'être. Elle ignore tout du reste :
 * l'angle entre deux meubles, le dessous d'un plateau, le creux entre deux
 * coussins, la jonction d'un pied et d'un tapis. Or c'est précisément là que
 * l'œil cherche la profondeur — une image sans ces ombres-là paraît lavée,
 * quelles que soient ses matières.
 *
 * Le principe est le plus économe qui marche, et il n'a besoin d'aucune
 * matrice : pour chaque point, on regarde autour de lui dans le tampon de
 * profondeur, et on compte **ce qui est devant**. Un point au fond d'un angle a
 * beaucoup de voisins plus proches de la caméra que lui ; un point au milieu
 * d'un mur n'en a aucun. C'est de l'occlusion d'horizon, la plus ancienne des
 * méthodes en espace écran, et elle donne quatre-vingts pour cent de l'effet
 * pour un dixième du travail d'une méthode à hémisphère orientée.
 *
 * Trois précautions, et chacune corrige un défaut classique :
 *
 * **Le rayon est en mètres, pas en pixels.** On le divise par la distance, donc
 * un angle de mur occlut sur la même largeur réelle qu'on soit à deux mètres ou
 * à dix. Sans cela, l'occlusion grossit quand on recule, ce qui se lit comme un
 * halo sale qui suit la caméra.
 *
 * **Une différence trop grande ne compte pas.** Un objet à trois mètres devant
 * un mur n'assombrit pas le mur : il le cache. Sans ce plafond, chaque
 * silhouette traîne une ombre noire dans le vide autour d'elle.
 *
 * **On échantillonne en anneaux tournés**, comme le flou : une grille laisse
 * voir sa grille sur les grandes surfaces lisses.
 */
const OCCLUSION = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tProfondeur;
  uniform vec2 uTaille;
  uniform float uPres;
  uniform float uLoin;
  uniform float uRayon;

  float metres(vec2 uv) {
    float d = texture2D(tProfondeur, uv).x;
    return (uPres * uLoin) / (uLoin - d * (uLoin - uPres));
  }

  float part(vec2 uv, float centre, float portee) {
    float voisin = metres(uv);
    float ecart = centre - voisin;
    // Devant, et pas trop loin devant.
    return step(0.02, ecart) * smoothstep(portee * 1.6, portee * 0.1, ecart)
         * smoothstep(0.02, portee * 0.35, ecart);
  }

  void main() {
    float centre = metres(vUv);
    // Au-delà de quarante mètres, l'occlusion de contact n'a plus de sens.
    if (centre > 40.0) { gl_FragColor = vec4(1.0); return; }

    float portee = uRayon;
    // Le rayon en pixels décroît avec la distance : rayon réel constant.
    vec2 pas = vec2(portee / centre) * uTaille;

    float somme = 0.0;
    somme += part(vUv + vec2( 1.000,  0.000) * pas, centre, portee);
    somme += part(vUv + vec2( 0.500,  0.866) * pas, centre, portee);
    somme += part(vUv + vec2(-0.500,  0.866) * pas, centre, portee);
    somme += part(vUv + vec2(-1.000,  0.000) * pas, centre, portee);
    somme += part(vUv + vec2(-0.500, -0.866) * pas, centre, portee);
    somme += part(vUv + vec2( 0.500, -0.866) * pas, centre, portee);
    somme += part(vUv + vec2( 1.732,  1.000) * pas, centre, portee);
    somme += part(vUv + vec2( 0.000,  2.000) * pas, centre, portee);
    somme += part(vUv + vec2(-1.732,  1.000) * pas, centre, portee);
    somme += part(vUv + vec2(-1.732, -1.000) * pas, centre, portee);
    somme += part(vUv + vec2( 0.000, -2.000) * pas, centre, portee);
    somme += part(vUv + vec2( 1.732, -1.000) * pas, centre, portee);

    float occlusion = 1.0 - somme / 12.0;
    gl_FragColor = vec4(vec3(occlusion), 1.0);
  }
`;

const MELANGE = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tNet;
  uniform sampler2D tFlou;
  uniform sampler2D tProfondeur;
  uniform sampler2D tEclat;
  uniform sampler2D tOcclusion;
  uniform float uOcclusion;
  uniform float uPres;
  uniform float uLoin;
  uniform float uMise;
  uniform float uForce;
  uniform float uEclat;
  uniform float uVignette;
  uniform float uGrain;

  float distanceVue(float d) {
    // La profondeur du tampon est non linéaire : on revient en mètres.
    return (uPres * uLoin) / (uLoin - d * (uLoin - uPres));
  }

  void main() {
    vec3 net = texture2D(tNet, vUv).rgb;
    vec3 flou = texture2D(tFlou, vUv).rgb;
    float d = texture2D(tProfondeur, vUv).x;
    float metres = distanceVue(d);

    /*
     * Le fondu commence à un tiers derrière le point de netteté et sature à
     * quatre fois cette distance.
     *
     * Il était deux fois plus serré, et cela marchait dehors : à cent trente
     * mètres du bâtiment, tout ce qui est plus loin est du paysage. Dedans,
     * c'était intenable — dans un puits de quarante-trois mètres pris en
     * diagonale, la surface la plus proche est déjà à dix-sept mètres, donc
     * *tout* tombait au-delà du seuil. Le plan de la montée ne montrait qu'un
     * dégradé, et j'ai cherché la faute dans la géométrie avant de la trouver
     * ici.
     *
     * La leçon est générale : une profondeur de champ réglée en fractions du
     * point de netteté doit l'être sur la scène la plus **profonde**, pas sur
     * la plus lointaine.
     */
    float part = smoothstep(uMise * 1.35, uMise * 4.2, metres) * uForce;
    vec3 couleur = mix(net, flou, part);

    /*
     * L'occlusion multiplie, et elle multiplie **avant** l'éclat.
     *
     * Avant, parce que l'éclat est de la lumière en trop qui déborde d'une
     * source : elle ne se fait pas manger par un coin de mur. Assombrir après
     * reviendrait à éteindre un halo au motif qu'il passe devant un angle, ce
     * qu'aucun objectif ne fait.
     *
     * Elle est appliquée à toute la couleur, ce qui est l'approximation
     * assumée de la méthode : une occlusion ambiante ne devrait éteindre que
     * l'indirect, et une passe de composition n'a plus les deux séparés. Le
     * remède est de rester **discret** — quarante-cinq pour cent au fond d'un
     * angle, jamais plus. Une occlusion qu'on remarque est une occlusion
     * fausse.
     */
    float ao = texture2D(tOcclusion, vUv).r;
    couleur *= mix(1.0, ao, uOcclusion);

    /* L'éclat s'**ajoute**, il ne se mélange pas : c'est de la lumière en
       trop, pas une autre version de l'image. Un mélange l'aurait fait payer
       par un assombrissement de ce qui l'entoure, ce qui est exactement le
       contraire de ce que fait un objectif. */
    couleur += texture2D(tEclat, vUv).rgb * uEclat;

    /*
     * La vignette.
     *
     * Douze pour cent aux angles, et rien au centre. C'est peu, et c'est
     * voulu : une vignette qu'on remarque est une vignette ratée. Son rôle
     * n'est pas d'être vue, il est de retenir l'œil au milieu du cadre — un
     * objectif en donne toujours un peu, et son absence totale participe à
     * l'impression de « rendu » qu'on cherche à effacer.
     *
     * Elle est calculée sur des coordonnées **recentrées**, pas sur la
     * distance au coin : sinon elle s'écrase sur un écran large et devient un
     * bandeau latéral.
     */
    /*
     * L'étalonnage.
     *
     * Deux gestes, et pas un de plus. Les ombres partent vers le bleu et les
     * hautes lumières vers l'ambre : c'est la séparation de tons que fait
     * n'importe quel étalonneur devant une scène de fin de journée, parce que
     * l'ombre y est éclairée par le ciel et la lumière par le soleil. Puis une
     * courbe en S très douce, qui creuse les noirs d'un rien et retient les
     * blancs — la courbe de tonalité filmique en a déjà une, on ne fait que
     * l'appuyer.
     *
     * C'est le dernier pour cent, et c'est celui qui manque le plus quand il
     * n'est pas là : une image techniquement juste et non étalonnée se
     * reconnaît à ce qu'elle est **neutre partout**.
     */
    /*
     * On borne **avant** d'étalonner, et ce n'est pas une précaution : c'est
     * une correction.
     *
     * La courbe en S est un polynôme de degré trois valable sur zéro-un.
     * Au-dessus de un — et l'éclat en produit, c'est son métier — le terme
     * « 3 − 2c » devient négatif et la courbe plonge. Le canal le plus lumineux
     * passe sous zéro en premier, donc un point blanc éclatant sortait
     * **cyan** : le rouge tombait, le bleu restait. La lampe sur pied et les
     * foyers de la plaque en étaient constellés.
     *
     * Rien n'est perdu à borner ici : la sortie est écrite en huit bits, et
     * tout ce qui dépasse un y serait écrêté quelques lignes plus bas de toute
     * façon.
     */
    couleur = clamp(couleur, 0.0, 1.0);

    float clarte = dot(couleur, vec3(0.2126, 0.7152, 0.0722));
    vec3 froid = vec3(0.94, 0.98, 1.06);
    vec3 chaud = vec3(1.05, 1.00, 0.93);
    couleur *= mix(froid, chaud, smoothstep(0.12, 0.72, clarte));
    couleur = couleur * couleur * (3.0 - 2.0 * couleur) * 0.22 + couleur * 0.78;

    vec2 hors = (vUv - 0.5) * 2.0;
    float bord = dot(hors, hors);
    couleur *= 1.0 - uVignette * bord * bord;

    // L'encodage d'affichage, une seule fois, ici.
    couleur = max(couleur, vec3(0.0));
    vec3 bas = couleur * 12.92;
    vec3 haut = 1.055 * pow(couleur, vec3(0.41666)) - 0.055;
    vec3 sortie = mix(haut, bas, step(couleur, vec3(0.0031308)));

    /*
     * Un grain d'un niveau, juste avant d'écrire.
     *
     * Le rendu travaille en virgule flottante ; l'écran prend huit bits. Sur
     * une surface où la lumière varie très lentement — un plafond, un mur, un
     * ciel — les paliers de quantification deviennent visibles, et comme les
     * trois canaux ne franchissent pas leur palier au même endroit, ces
     * paliers sont colorés. Un bruit de la taille d'un niveau ajouté avant
     * l'arrondi les disperse : le palier ne disparaît pas, il se répartit, et
     * un dégradé bruité se lit comme continu là où un dégradé en escalier se
     * lit comme un défaut.
     *
     * Une note, parce qu'elle a coûté une capture et une mesure. L'auréole
     * froide qu'on voit au plafond du séjour n'est **pas** cela : le relevé
     * des pixels donne quarante niveaux d'écart entre le rouge et le bleu sur
     * la largeur de la tache, quand une marche de quantification en vaut un.
     * C'est une vraie lumière — le bleu du ciel qui entre par la baie et
     * rencontre la flaque chaude de la suspension. Le tramage reste, sur ses
     * propres mérites ; il ne fallait pas lui attribuer un mérite qui n'est
     * pas le sien.
     */
    float a = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float b = fract(sin(dot(gl_FragCoord.yx, vec2(39.3468, 11.135))) * 24634.6345);
    /* Deux tirages et non un : la somme de deux lois uniformes donne une loi
       triangulaire, qui est celle que demande un tramage d'un niveau. */
    sortie += (a + b - 1.0) / 255.0;

    /*
     * Le grain argentique, par-dessus le tramage.
     *
     * Le tramage vaut un niveau et sert à casser les paliers ; le grain, lui,
     * est un parti pris d'image. Il est **modulé par la luminance** — fort
     * dans les demi-teintes, presque nul dans les noirs et dans les blancs —
     * parce que c'est ainsi que se comporte une émulsion, et parce qu'un
     * grain uniforme salit les ombres au lieu de les habiller.
     *
     * Il est fixe à l'écran et non recalculé à chaque image. Un grain animé
     * scintille, oblige à redessiner une scène qui n'a pas bougé, et se lit
     * comme du bruit vidéo. Fixe, il se lit comme la texture du capteur — et
     * comme l'image bouge en permanence sous lui, il ne se fige jamais.
     */
    float milieu = 1.0 - abs(dot(sortie, vec3(0.2126, 0.7152, 0.0722)) * 2.0 - 1.0);
    sortie += (a - 0.5) * uGrain * milieu;

    gl_FragColor = vec4(sortie, 1.0);
  }
`;

/** Le rapport entre la résolution de l'éclat et celle de l'image. */
const QUART = 0.25;

export interface Profondeur {
  /** À appeler quand le canevas change de taille. */
  setSize(largeur: number, hauteur: number): void;
  /** Rend la scène avec le point de netteté à `mise` mètres. */
  rendre(scene: THREE.Scene, camera: THREE.PerspectiveCamera, mise: number): void;
  /**
   * Coupe ou rallume l'occlusion ambiante.
   *
   * Elle part en même temps que l'éclat, au premier palier : ce sont les deux
   * passes qui coûtent sans que leur absence rende l'image fausse.
   */
  occlusion(actif: boolean): void;
  /**
   * Coupe ou rallume l'éclat.
   *
   * C'est le premier effet que la machine cède quand elle ne suit plus : trois
   * passes en moins, et l'image reste juste — seulement moins lumineuse sur
   * les arêtes. Voir les paliers dans `quality.ts`.
   */
  eclat(actif: boolean): void;
  dispose(): void;
}

/**
 * Monte la chaîne de rendu. Rend `null` si la machine ne sait pas faire —
 * auquel cas l'appelant rend la scène directement, ce qui est exactement le
 * repli qu'on veut : une image nette partout vaut mieux qu'une page noire.
 */
export function creerProfondeur(
  renderer: THREE.WebGLRenderer,
  force = 1,
): Profondeur | null {
  const contexte = renderer.getContext();
  const flottant =
    renderer.capabilities.isWebGL2 ||
    Boolean(contexte.getExtension('EXT_color_buffer_half_float'));
  if (!flottant) return null;

  const options = {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    stencilBuffer: false,
  } as const;

  const net = new THREE.WebGLRenderTarget(2, 2, options);
  net.depthTexture = new THREE.DepthTexture(2, 2);
  net.depthTexture.format = THREE.DepthFormat;
  net.depthTexture.type = THREE.UnsignedIntType;
  const flou = new THREE.WebGLRenderTarget(2, 2, { ...options, depthBuffer: false });
  /* Deux cibles en quart de résolution pour l'éclat : on extrait dans la
     première, on floute vers la seconde, on refloute vers la première avec un
     pas plus large. Deux passes de treize points donnent un halo bien plus
     doux qu'une seule à rayon double, pour le même prix — c'est le principe
     de tous les flous en cascade. */
  const vif = new THREE.WebGLRenderTarget(2, 2, { ...options, depthBuffer: false });
  const halo = new THREE.WebGLRenderTarget(2, 2, { ...options, depthBuffer: false });
  /* L'occlusion est calculée en demi-résolution puis floutée : c'est une
     quantité basse fréquence, elle n'a aucun détail à perdre, et le flou lui
     enlève le grain d'échantillonnage qui, sinon, fourmille sur les aplats. */
  const brut = new THREE.WebGLRenderTarget(2, 2, { ...options, depthBuffer: false });
  const doux = new THREE.WebGLRenderTarget(2, 2, { ...options, depthBuffer: false });

  const quad = new THREE.BufferGeometry();
  quad.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  quad.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));

  /* `ShaderMaterial` et non `RawShaderMaterial` : c'est three qui déclare
     alors les attributs, les matrices et la précision. Avec la version brute,
     il faut tout écrire soi-même, et l'oubli d'une ligne de précision se
     manifeste par une page noire sur les seules machines qu'on n'a pas sous la
     main. */
  const matFlou = new THREE.ShaderMaterial({
    vertexShader: PLAN,
    fragmentShader: FLOU,
    uniforms: {
      tImage: { value: net.texture },
      uPas: { value: new THREE.Vector2() },
    },
    depthTest: false,
    depthWrite: false,
  });
  const matOcclusion = new THREE.ShaderMaterial({
    vertexShader: PLAN,
    fragmentShader: OCCLUSION,
    uniforms: {
      tProfondeur: { value: net.depthTexture },
      uTaille: { value: new THREE.Vector2() },
      uPres: { value: 0.2 },
      uLoin: { value: 1200 },
      /* Trente-cinq centimètres : c'est la portée d'une ombre de contact, pas
         celle d'une ombre portée. Au-delà d'un demi-mètre, l'occlusion cesse
         de coller aux objets et devient un voile gris qui suit la caméra. */
      uRayon: { value: 0.35 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const matAdoucir = new THREE.ShaderMaterial({
    vertexShader: PLAN,
    fragmentShader: FLOU,
    uniforms: {
      tImage: { value: null as THREE.Texture | null },
      uPas: { value: new THREE.Vector2() },
    },
    depthTest: false,
    depthWrite: false,
  });
  const matSeuil = new THREE.ShaderMaterial({
    vertexShader: PLAN,
    fragmentShader: SEUIL,
    uniforms: {
      tImage: { value: net.texture },
      /*
       * Le seuil, et l'erreur qu'il faut faire une fois.
       *
       * Il était à 0,72, sur le raisonnement suivant : l'image écrite dans la
       * cible est déjà passée par la courbe de tonalité, donc il n'y a plus de
       * valeurs très au-dessus de un, donc il faut seuiller bas. Le
       * raisonnement est juste et la conclusion est fausse — parce qu'un mur
       * beige éclairé se tient précisément vers 0,7. À ce seuil, ce n'est plus
       * un éclat qu'on ajoute, c'est **un voile sur toute l'image** : le
       * séjour est ressorti plus clair, plus plat, et la table basse s'est
       * remise à luire comme si elle était allumée.
       *
       * Un éclat ne doit trouver que ce qui est franchement plus lumineux que
       * la scène. À 0,88, il ne reste que le ciel, la tache de soleil au sol
       * et les vitres qui le renvoient — c'est-à-dire exactement ce qui, dans
       * un objectif, déborde vraiment.
       */
      uSeuil: { value: 0.88 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const matHalo = new THREE.ShaderMaterial({
    vertexShader: PLAN,
    fragmentShader: FLOU,
    uniforms: {
      tImage: { value: vif.texture },
      uPas: { value: new THREE.Vector2() },
    },
    depthTest: false,
    depthWrite: false,
  });
  const matMelange = new THREE.ShaderMaterial({
    vertexShader: PLAN,
    fragmentShader: MELANGE,
    uniforms: {
      tNet: { value: net.texture },
      tFlou: { value: flou.texture },
      tProfondeur: { value: net.depthTexture },
      tEclat: { value: halo.texture },
      tOcclusion: { value: doux.texture },
      /* Quarante-cinq pour cent au plus sombre. Poussée à soixante, elle
         dessine un liseré noir au pied de chaque meuble — le défaut le plus
         reconnaissable des occlusions en espace écran, et celui qui les fait
         passer pour un filtre. */
      uOcclusion: { value: 0.45 },
      uPres: { value: 0.2 },
      uLoin: { value: 1200 },
      uMise: { value: 40 },
      uForce: { value: force },
      /* Cinquante-cinq pour cent, mais sur bien moins de pixels qu'avant : un
         seuil haut et un gain franc valent mieux qu'un seuil bas et un gain
         timide. Le premier fait déborder les quelques surfaces qui doivent
         déborder ; le second lave l'image entière. */
      uEclat: { value: 0.55 },
      uVignette: { value: 0.12 },
      /* Un peu plus de trois niveaux dans les demi-teintes. Assez pour que
         l'image cesse d'être lisse, trop peu pour qu'on puisse le nommer. */
      uGrain: { value: 3.2 / 255 },
    },
    depthTest: false,
    depthWrite: false,
  });

  const plan = new THREE.Scene();
  const oeil = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const maille = new THREE.Mesh(quad, matFlou);
  maille.frustumCulled = false;
  plan.add(maille);

  /* L'éclat peut être coupé à chaud par les paliers de qualité. Quand il
     l'est, la composition lit une cible noire : c'est une texture de plus à
     échantillonner, ce qui est négligeable, et cela évite de recompiler le
     nuanceur de composition à chaque changement de palier — une recompilation
     de programme provoque une saccade d'une bonne dizaine d'images, ce qui
     est précisément ce qu'on essayait d'éviter en baissant le palier. */
  let avecEclat = true;
  let avecOcclusion = true;
  const noir = new THREE.WebGLRenderTarget(2, 2, { ...options, depthBuffer: false });
  /* Une cible blanche, pour quand l'occlusion est coupée : la composition
     continue de multiplier par elle sans qu'on ait à recompiler le nuanceur.
     Une recompilation de programme provoque une saccade d'une dizaine
     d'images, ce qui est précisément ce qu'on cherche à éviter en baissant un
     palier. */
  const blanc = new THREE.WebGLRenderTarget(2, 2, { ...options, depthBuffer: false });

  return {
    setSize(largeur, hauteur) {
      const l = Math.max(2, Math.round(largeur));
      const h = Math.max(2, Math.round(hauteur));
      net.setSize(l, h);
      flou.setSize(Math.max(2, Math.round(l * DEMI)), Math.max(2, Math.round(h * DEMI)));
      const ld = Math.max(2, Math.round(l * DEMI));
      const hd = Math.max(2, Math.round(h * DEMI));
      brut.setSize(ld, hd);
      doux.setSize(ld, hd);
      matOcclusion.uniforms.uTaille.value.set(1 / ld, 1 / hd);
      matAdoucir.uniforms.uPas.value.set(1.4 / ld, 1.4 / hd);
      const lq = Math.max(2, Math.round(l * QUART));
      const hq = Math.max(2, Math.round(h * QUART));
      vif.setSize(lq, hq);
      halo.setSize(lq, hq);
      /* Un pas bien plus large que celui de la profondeur de champ : un halo
         d'objectif s'étale sur des dizaines de pixels de l'image finale, soit
         quelques-uns seulement en quart de résolution. */
      matHalo.uniforms.uPas.value.set(2.6 / lq, 2.6 / hq);
      /* Le pas est exprimé en fraction de la cible de flou, donc en texels de
         demi-résolution : c'est ce qui rend le rayon indépendant de la taille
         de la fenêtre. */
      matFlou.uniforms.uPas.value.set(1.9 / (l * DEMI), 1.9 / (h * DEMI));
    },

    rendre(scene, camera, mise) {
      renderer.setRenderTarget(net);
      renderer.clear();
      renderer.render(scene, camera);

      maille.material = matFlou;
      renderer.setRenderTarget(flou);
      renderer.render(plan, oeil);

      if (avecOcclusion) {
        matOcclusion.uniforms.uPres.value = camera.near;
        matOcclusion.uniforms.uLoin.value = camera.far;
        maille.material = matOcclusion;
        renderer.setRenderTarget(brut);
        renderer.render(plan, oeil);

        matAdoucir.uniforms.tImage.value = brut.texture;
        maille.material = matAdoucir;
        renderer.setRenderTarget(doux);
        renderer.render(plan, oeil);

        matMelange.uniforms.tOcclusion.value = doux.texture;
      }

      if (avecEclat) {
        maille.material = matSeuil;
        renderer.setRenderTarget(vif);
        renderer.render(plan, oeil);

        /* Deux passes de flou en aller-retour. La seconde repart de la
           première : c'est ce qui donne au halo sa décroissance douce plutôt
           qu'un disque net. */
        matHalo.uniforms.tImage.value = vif.texture;
        maille.material = matHalo;
        renderer.setRenderTarget(halo);
        renderer.render(plan, oeil);

        matHalo.uniforms.tImage.value = halo.texture;
        renderer.setRenderTarget(vif);
        renderer.render(plan, oeil);

        matMelange.uniforms.tEclat.value = vif.texture;
      }

      matMelange.uniforms.uPres.value = camera.near;
      matMelange.uniforms.uLoin.value = camera.far;
      matMelange.uniforms.uMise.value = Math.max(1, mise);
      maille.material = matMelange;
      renderer.setRenderTarget(null);
      renderer.render(plan, oeil);
    },

    occlusion(actif) {
      if (actif === avecOcclusion) return;
      avecOcclusion = actif;
      if (!actif) {
        const precedent = renderer.getRenderTarget();
        renderer.setRenderTarget(blanc);
        renderer.setClearColor(0xffffff, 1);
        renderer.clear(true, false, false);
        renderer.setClearColor(0x0d1014, 1);
        renderer.setRenderTarget(precedent);
        matMelange.uniforms.tOcclusion.value = blanc.texture;
      }
    },

    eclat(actif) {
      if (actif === avecEclat) return;
      avecEclat = actif;
      if (!actif) {
        /* On efface la cible d'éclat une fois, au moment de la coupure : sans
           cela, la composition continuerait d'ajouter le dernier halo calculé,
           figé sur l'image d'avant. */
        const precedent = renderer.getRenderTarget();
        renderer.setRenderTarget(noir);
        renderer.setClearColor(0x000000, 1);
        renderer.clear(true, false, false);
        renderer.setClearColor(0x0d1014, 1);
        renderer.setRenderTarget(precedent);
        matMelange.uniforms.tEclat.value = noir.texture;
      }
    },

    dispose() {
      net.depthTexture?.dispose();
      net.dispose();
      flou.dispose();
      vif.dispose();
      halo.dispose();
      brut.dispose();
      doux.dispose();
      noir.dispose();
      blanc.dispose();
      quad.dispose();
      matFlou.dispose();
      matOcclusion.dispose();
      matAdoucir.dispose();
      matSeuil.dispose();
      matHalo.dispose();
      matMelange.dispose();
    },
  };
}
