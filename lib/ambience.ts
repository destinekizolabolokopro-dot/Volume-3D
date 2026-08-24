/**
 * Le son de la visite.
 *
 * Il n'y a pas un seul fichier audio dans ce dépôt, et c'est le premier choix
 * du module : tout est synthétisé au moment où on l'entend. Un pas, c'est une
 * bouffée de bruit filtrée sous une enveloppe qui s'éteint en cent
 * millisecondes ; une porte, c'est un déclic et une masse d'air. Trois cents
 * lignes de code contre trois mégaoctets d'échantillons à télécharger avant que
 * la page ne serve à quelque chose — sur un téléphone en 4G, ce n'est même pas
 * un arbitrage.
 *
 * Le principe : **le son suit les mètres, pas le temps.** On ne joue pas une
 * boucle de pas ; on compte la distance réellement parcourue par la caméra et
 * on pose un pas tous les soixante-huit centimètres. Le doigt qui fait défiler
 * commande donc directement la cadence — vite, et l'on marche vite ; on
 * s'arrête pour lire une légende, et le silence se fait. C'est ce lien-là qui
 * fait qu'on croit au déplacement, et aucune boucle ne peut l'imiter.
 *
 * Trois règles, et la première n'est pas négociable :
 *
 *  · **coupé par défaut.** Un son qui démarre seul est hostile : la personne
 *    est peut-être au bureau, dans un train, à côté de quelqu'un qui dort. Les
 *    navigateurs le refusent d'ailleurs, et ils ont raison. Rien n'existe —
 *    pas même l'`AudioContext` — tant que personne n'a cliqué.
 *  · **la pièce s'entend.** Une salle de bain carrelée renvoie ; une chambre
 *    avec un tapis, une couette et des rideaux absorbe. Le même pas y sonne
 *    différemment, et c'est une information sur le volume, pas une décoration.
 *  · **rien ne sonne pendant qu'on lit.** La caméra à l'arrêt ne parcourt aucun
 *    mètre, donc ne pose aucun pas.
 */

/** Distance entre deux pas, en mètres. Une foulée d'intérieur, sans hâte. */
const FOULEE = 0.68;

/** Volume général. Bas : on accompagne une image, on ne la commente pas. */
const VOLUME = 0.5;

/**
 * Ce que renvoie chaque pièce.
 *
 * `brillance` place le filtre du pas : haut pour un sol dur et nu, bas pour un
 * sol habillé. `echo` dose la part réverbérée. Les deux vont ensemble dans la
 * réalité — une pièce qui renvoie est une pièce qui n'absorbe pas les aigus —
 * et les garder liés dans le code éviterait un réglage, mais la salle de bain
 * fait exception : elle renvoie beaucoup *et* elle est petite, donc brillante
 * sans être vaste.
 */
interface Acoustique {
  brillance: number;
  echo: number;
  /** Poids du choc grave, sous le pas. Un parquet sur solives résonne. */
  corps: number;
}

const CARRELAGE: Acoustique = { brillance: 2600, echo: 0.42, corps: 0.5 };
const PARQUET: Acoustique = { brillance: 1500, echo: 0.2, corps: 1 };
const HABILLE: Acoustique = { brillance: 1050, echo: 0.12, corps: 0.8 };

/**
 * L'acoustique d'une pièce, déduite de son identifiant.
 *
 * Déduite, et non déclarée : le décor porte déjà l'information — c'est le même
 * test qui décide, dans le rendu, où poser la faïence. Deux endroits qui
 * décrivent la même pièce finissent toujours par diverger, et l'un des deux est
 * alors faux sans que rien ne le signale.
 */
export function acoustiqueDe(roomId: string): Acoustique {
  if (/eau|bain|wc|douche|cuisine/i.test(roomId)) return CARRELAGE;
  if (/chambre/i.test(roomId)) return HABILLE;
  return PARQUET;
}

export interface Ambience {
  /** Démarre le son. À n'appeler que depuis un geste de l'utilisateur. */
  enable(): Promise<void>;
  disable(): void;
  /** Distance parcourue depuis la dernière image, et pièce traversée. */
  moved(metres: number, roomId: string): void;
  /** Ouverture du battant, de 0 à 1. Le déclic et le souffle en découlent. */
  door(openness: number): void;
  dispose(): void;
}

/**
 * Une réponse impulsionnelle fabriquée à la volée.
 *
 * Du bruit qui décroît en exponentielle, avec les aigus qui s'éteignent plus
 * vite que les graves — c'est ce que fait une pièce réelle, et c'est ce qui
 * distingue une réverbération d'un simple écho métallique. Deux canaux
 * décorrélés : sans cela, la queue de réverbération se colle au milieu du
 * casque, à l'endroit exact où se trouve déjà le pas.
 */
function impulsion(ctx: BaseAudioContext, duree: number, decroissance: number): AudioBuffer {
  const longueur = Math.max(1, Math.floor(ctx.sampleRate * duree));
  const buffer = ctx.createBuffer(2, longueur, ctx.sampleRate);
  for (let canal = 0; canal < 2; canal += 1) {
    const data = buffer.getChannelData(canal);
    let grave = 0;
    for (let i = 0; i < longueur; i += 1) {
      const u = i / longueur;
      const enveloppe = Math.pow(1 - u, decroissance);
      const blanc = Math.random() * 2 - 1;
      // Un passe-bas d'ordre un qui se referme avec le temps.
      grave += (blanc - grave) * (0.35 - 0.28 * u);
      data[i] = (blanc * 0.35 + grave * 0.65) * enveloppe;
    }
  }
  return buffer;
}

/** Une source de bruit blanc réutilisable, d'une seconde, lue en boucle. */
function bruit(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function createAmbience(): Ambience {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let sec: GainNode | null = null;
  let mouille: GainNode | null = null;
  let blanc: AudioBuffer | null = null;
  let salle: Acoustique = PARQUET;
  let reste = 0;
  let gauche = false;
  let ouvert = 0;
  let vivant = false;

  const monte = () => {
    const AudioCtor: typeof AudioContext | undefined =
      typeof window === 'undefined'
        ? undefined
        : window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return false;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    /* Deux chemins en parallèle : le son direct et le son réverbéré. Doser
       l'un contre l'autre coûte un `gain.value` par pièce, là où changer le
       tampon d'un convolueur en pleine queue produirait un claquement. */
    sec = ctx.createGain();
    sec.gain.value = 1;
    sec.connect(master);

    const convolueur = ctx.createConvolver();
    convolueur.buffer = impulsion(ctx, 1.1, 2.4);
    mouille = ctx.createGain();
    mouille.gain.value = salle.echo;
    mouille.connect(convolueur);
    convolueur.connect(master);

    blanc = bruit(ctx);
    return true;
  };

  /** Un pas : une bouffée de bruit filtrée, et un choc grave sous elle. */
  const pas = (force: number) => {
    if (!ctx || !sec || !mouille || !blanc) return;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = blanc;
    source.loop = true;
    // Un point de départ au hasard : deux pas identiques s'entendent comme une
    // boucle, ce qui est exactement l'impression qu'on veut éviter.
    source.loopStart = Math.random() * 0.9;
    source.loopEnd = source.loopStart + 0.05;

    /* Le pied gauche et le pied droit ne sonnent pas pareil. Un demi-ton
       d'écart et deux décibels suffisent à ce que l'oreille cesse d'entendre
       une répétition mécanique. */
    gauche = !gauche;
    const teinte = gauche ? 1 : 0.92;

    const filtre = ctx.createBiquadFilter();
    filtre.type = 'bandpass';
    filtre.frequency.value = salle.brillance * teinte;
    filtre.Q.value = 0.9;

    const enveloppe = ctx.createGain();
    const pic = 0.19 * force * (gauche ? 1 : 0.86);
    enveloppe.gain.setValueAtTime(0.0001, t);
    enveloppe.gain.exponentialRampToValueAtTime(pic, t + 0.006);
    enveloppe.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);

    source.connect(filtre);
    filtre.connect(enveloppe);
    enveloppe.connect(sec);
    enveloppe.connect(mouille);
    source.start(t);
    source.stop(t + 0.2);

    // Le choc : ce qu'on sent plus qu'on ne l'entend.
    const corps = ctx.createOscillator();
    corps.type = 'sine';
    corps.frequency.setValueAtTime(96 * teinte, t);
    corps.frequency.exponentialRampToValueAtTime(52, t + 0.09);
    const poids = ctx.createGain();
    poids.gain.setValueAtTime(0.0001, t);
    poids.gain.exponentialRampToValueAtTime(0.075 * force * salle.corps, t + 0.008);
    poids.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    corps.connect(poids);
    poids.connect(sec);
    corps.start(t);
    corps.stop(t + 0.15);
  };

  /** Le pêne qui lâche, puis la masse d'air que le battant pousse. */
  const battant = () => {
    if (!ctx || !sec || !mouille || !blanc) return;
    const t = ctx.currentTime;

    const declic = ctx.createBufferSource();
    declic.buffer = blanc;
    declic.loop = true;
    declic.loopStart = Math.random() * 0.9;
    declic.loopEnd = declic.loopStart + 0.02;
    const aigu = ctx.createBiquadFilter();
    aigu.type = 'highpass';
    aigu.frequency.value = 2400;
    const claque = ctx.createGain();
    claque.gain.setValueAtTime(0.0001, t);
    claque.gain.exponentialRampToValueAtTime(0.16, t + 0.003);
    claque.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    declic.connect(aigu);
    aigu.connect(claque);
    claque.connect(sec);
    claque.connect(mouille);
    declic.start(t);
    declic.stop(t + 0.08);

    /* Le souffle du battant. Il dure sept dixièmes de seconde, c'est-à-dire à
       peu près le temps que met une porte à s'ouvrir en grand — et c'est aussi
       le temps que dure l'ouverture à l'écran. Les deux ne sont pas synchronisés
       image par image ; ils n'ont pas besoin de l'être, l'oreille accepte un
       geste dont elle reconnaît la durée. */
    const air = ctx.createBufferSource();
    air.buffer = blanc;
    air.loop = true;
    const grave = ctx.createBiquadFilter();
    grave.type = 'lowpass';
    grave.frequency.setValueAtTime(240, t + 0.04);
    grave.frequency.linearRampToValueAtTime(620, t + 0.4);
    grave.frequency.linearRampToValueAtTime(180, t + 0.75);
    const souffle = ctx.createGain();
    souffle.gain.setValueAtTime(0.0001, t + 0.04);
    souffle.gain.linearRampToValueAtTime(0.05, t + 0.28);
    souffle.gain.linearRampToValueAtTime(0.0001, t + 0.78);
    air.connect(grave);
    grave.connect(souffle);
    souffle.connect(sec);
    souffle.connect(mouille);
    air.start(t + 0.04);
    air.stop(t + 0.85);
  };

  return {
    async enable() {
      if (!ctx && !monte()) return;
      if (!ctx || !master) return;
      // Un contexte créé hors geste naît suspendu ; le geste le réveille.
      if (ctx.state === 'suspended') await ctx.resume();
      vivant = true;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + 0.25);
    },

    disable() {
      vivant = false;
      if (!ctx || !master) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
    },

    moved(metres, roomId) {
      if (!vivant || !ctx || !mouille) return;
      const acoustique = acoustiqueDe(roomId);
      if (acoustique !== salle) {
        salle = acoustique;
        /* Un dixième de seconde de fondu sur la part réverbérée : posée d'un
           coup au franchissement d'une porte, la salle de bain s'ouvrait sur un
           claquement. */
        mouille.gain.setTargetAtTime(salle.echo, ctx.currentTime, 0.1);
      }

      reste += Math.abs(metres);
      /* Un coup de molette lancé peut avaler cinq mètres entre deux images. On
         ne rattrape pas les huit pas correspondants : on en pose un, plus fort,
         et on repart. Une rafale de pas ne s'entend pas comme de la marche —
         elle s'entend comme un défaut. */
      if (reste > FOULEE * 3) {
        reste = 0;
        pas(1.15);
        return;
      }
      while (reste >= FOULEE) {
        reste -= FOULEE;
        pas(1);
      }
    },

    door(openness) {
      if (!vivant) return;
      // Le déclic tombe au moment où le battant commence à bouger, une fois.
      if (ouvert < 0.02 && openness >= 0.02) battant();
      ouvert = openness;
    },

    dispose() {
      vivant = false;
      const mourant = ctx;
      ctx = null;
      master = null;
      sec = null;
      mouille = null;
      blanc = null;
      void mourant?.close().catch(() => {});
    },
  };
}
