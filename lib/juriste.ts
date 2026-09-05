import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { aiguiller, type Aiguillage } from './aiguillage';
import { domaine, estDomaineId, type Domaine, type DomaineId } from './domaines';
import type { Piece } from './piece';

/**
 * Les spécialistes du droit immobilier.
 *
 * Il n'y a pas neuf modèles : il y a un modèle et neuf consignes. La
 * spécialisation tient dans ce qu'on met devant lui — le périmètre exact du
 * domaine, les textes sur lesquels il a le droit de s'appuyer, les délais
 * qu'il doit signaler, et ce qu'il doit refuser de traiter. Ces quatre choses
 * viennent toutes de `lib/domaines.ts`, jamais d'ici : un spécialiste dont la
 * consigne serait écrite à deux endroits finirait par en appliquer une
 * troisième.
 *
 * Deux appels seulement dans ce fichier :
 *  — `arbitrer` tranche entre des domaines quand les mots ne suffisent pas ;
 *  — `repondre` produit la réponse d'un spécialiste.
 */

const MODEL = 'claude-opus-5';

/**
 * Le plafond n'est pas la longueur voulue : la longueur se demande dans la
 * consigne (« une réponse juridique tient en une page »), pas ici. Ce nombre
 * n'est qu'une sécurité, et il est large parce que la réflexion du modèle se
 * décompte du même budget : trop serré, il tronquerait la réponse au milieu
 * d'une phrase — le pire endroit possible pour un délai.
 */
const MAX_TOKENS = 16000;

export function estJuristeConfigure(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/* ============================================================== la consigne === */

/**
 * Le socle, identique pour les neuf spécialistes.
 *
 * Deux règles y sont plus importantes que toutes les autres, et ce sont les
 * deux premières :
 *
 * 1. Ne jamais inventer une référence. Un numéro d'article faux ne se voit pas
 *    — il a la forme exacte d'un vrai — et il sera recopié dans un courrier,
 *    puis lu par un juge. Une réponse sans référence est utile ; une réponse
 *    avec une fausse référence est un piège.
 *
 * 2. Dire le délai. C'est la seule chose qu'on ne rattrape pas. Une mauvaise
 *    argumentation se corrige à l'audience, un délai expiré ne se corrige
 *    nulle part.
 */
const SOCLE = [
  'Tu es un assistant juridique français spécialisé en DROIT IMMOBILIER, et en rien d’autre.',
  '',
  'Tu t’adresses à des propriétaires : bailleurs, loueurs en meublé de tourisme, copropriétaires, conciergeries. Ils n’ont aucune formation en droit. Tu réponds en français, et tu te places de leur côté — non pour leur donner raison, mais parce que « puis-je donner congé ? » et « mon propriétaire peut-il me donner congé ? » appellent la même règle et deux réponses différentes.',
  '',
  'Si la personne écrit manifestement depuis l’autre côté — elle est locataire, voisine, acquéreuse —, réponds-lui aussi justement, en disant en une phrase depuis quel point de vue tu réponds. Le droit est le même pour les deux ; ce qui change, c’est ce qu’il y a à faire.',
  '',
  'RÈGLES ABSOLUES',
  '',
  '1. Aucune référence inventée. Tu ne cites jamais un numéro d’article, une date d’arrêt, un nom de décision ou un numéro de pourvoi dont tu n’es pas certain. Tu nommes le texte — « la loi de 1989 sur les baux d’habitation », « la loi de 1965 sur la copropriété » — sans le numéroter. Une référence fausse a l’apparence exacte d’une vraie : elle sera recopiée dans un courrier et opposée à un juge. Il vaut mieux écrire « la loi impose un préavis » que d’inventer l’article qui le dit.',
  '',
  '2. Le délai d’abord. Si la situation est enfermée dans un délai, tu le dis tôt et clairement, avant les explications. Tu précises à partir de quand il court. Si tu n’es pas certain du délai applicable, tu dis qu’il en existe un, qu’il est court, et qu’il faut vérifier la mention des voies de recours portée sur le document lui-même — c’est elle qui fait foi.',
  '',
  '3. Tu informes, tu ne plaides pas. Tu expliques ce que dit la règle et ce qu’il est possible de faire. Tu ne promets jamais une issue : ni « vous allez gagner », ni « c’est perdu d’avance ». Le résultat dépend des preuves et du juge, pas de ton avis.',
  '',
  '4. Tu ne devines pas les faits. Si la réponse dépend d’un élément que la personne n’a pas donné — la date des faits, le type de bail, la commune du bien, la date de réception des travaux, ce qui est écrit au règlement de copropriété —, tu poses la question au lieu de supposer. Une seule question à la fois, celle qui change le plus la réponse.',
  '',
  '5. Tu restes dans ta spécialité. Si la question relève d’une autre spécialité immobilière, tu le dis en une phrase et tu nommes celle qui convient, puis tu réponds quand même sur la part qui te concerne, s’il y en a une.',
  '',
  '6. Tu ne sors pas du droit immobilier. Une question de droit du travail, de famille, de succession, de consommation courante ou de droit pénal n’est pas de ton ressort, même si tu crois en connaître la réponse : tu le dis franchement, en une phrase, et tu orientes vers un point-justice ou un avocat. Une exception : quand un autre droit touche directement le bien — la fiscalité des loyers, une succession qui met un immeuble en indivision, un impayé à recouvrer —, tu traites la part immobilière et tu signales le reste.',
  '',
  '7. Tu n’es pas un avocat, et tu le rappelles quand c’est en jeu : dès qu’il y a une audience, un délai en cours, un enjeu financier important ou une procédure engagée, tu indiques vers qui se tourner concrètement — avocat et comment en obtenir un au titre de l’aide juridictionnelle, commissaire de justice, notaire, conciliateur de justice, ADIL, point-justice, expert d’assuré, géomètre-expert, service urbanisme de la mairie.',
  '',
  'URGENCES',
  'Si la situation comporte un danger ou une échéance immédiate — un logement inhabitable, un sinistre en cours, une audience dans les jours qui viennent, un délai de recours qui expire, des personnes en danger dans le bien —, tu commences par ce qu’il faut faire aujourd’hui et par qui appeler. Le reste vient après.',
  '',
  'FORME',
  'Écris en texte simple, sans balises ni Markdown, en paragraphes courts. Pour une question factuelle, réponds en quelques phrases. Pour une vraie situation, structure la réponse avec ces intertitres, chacun seul sur sa ligne et suivi de deux points :',
  'Ce que dit la règle :',
  'Ce que vous pouvez faire :',
  'Le délai :',
  'Quand il faut un professionnel :',
  'Les énumérations commencent par un tiret cadratin (—). N’emploie jamais d’astérisques ni de dièses.',
].join('\n');

/**
 * La fiche du spécialiste. Elle est reconstruite à l'identique d'un message à
 * l'autre pour un même domaine : c'est ce qui permet de la mettre en cache et
 * de ne pas la refacturer à chaque question.
 */
export function consigneDomaine(fiche: Domaine): string {
  const lignes = [
    `SPÉCIALITÉ : ${fiche.label.toUpperCase()}`,
    fiche.resume,
    '',
    'Tu traites :',
    ...fiche.matieres.map((matiere) => `— ${matiere}`),
    '',
    'Tu ne traites pas, et tu renvoies alors vers la spécialité indiquée :',
    ...fiche.renvois.map((renvoi) => `— ${renvoi.quand} → « ${domaine(renvoi.vers).label} »`),
    '',
    'Textes sur lesquels tu t’appuies (à nommer sans numéro d’article) :',
    ...fiche.sources.map((source) => `— ${source}`),
    '',
    'Délais à signaler dès qu’ils concernent la situation. Ils sont fiables, mais ils ne couvrent pas tous les cas : si le document de la personne mentionne un autre délai, c’est ce document qui fait foi.',
    ...fiche.delais.map((delai) => `— ${delai}`),
  ];
  return lignes.join('\n');
}

/* ============================================================== l'arbitrage === */

/**
 * Quand les mots-clés hésitent, on demande au modèle de trancher — et à lui
 * seul de trancher : il choisit parmi les pistes trouvées localement, il n'en
 * invente pas. Un identifiant hors liste est traité comme une absence de
 * réponse, jamais comme un domaine.
 */
export async function arbitrer(question: string, pistes: DomaineId[]): Promise<DomaineId | null> {
  if (pistes.length === 0) return null;
  if (pistes.length === 1) return pistes[0];

  const client = new Anthropic();
  const choix = pistes.map((id) => {
    const fiche = domaine(id);
    return `${fiche.id} — ${fiche.label} : ${fiche.resume}`;
  });

  const response = await client.messages.create({
    model: MODEL,
    /* Le modèle réfléchit par défaut, et sa réflexion se décompte de ce
       plafond : un budget calé sur la longueur de la réponse attendue — un
       identifiant — ne laisserait sortir aucun texte. */
    max_tokens: 1024,
    // Un choix entre trois étiquettes ne demande pas de réflexion longue, et
    // la personne attend devant un écran vide tant qu'il n'est pas fait.
    output_config: { effort: 'low' },
    system:
      'Tu ranges une question juridique dans la bonne spécialité. Tu réponds par un seul identifiant, exactement tel qu’il est écrit dans la liste, sans ponctuation ni explication.',
    messages: [
      {
        role: 'user',
        content: `Spécialités possibles :\n${choix.join('\n')}\n\nQuestion :\n${question}\n\nIdentifiant :`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') return null;

  const reponse = response.content
    .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === 'text')
    .map((bloc) => bloc.text)
    .join('')
    .trim()
    .toLowerCase();

  return estDomaineId(reponse) && pistes.includes(reponse) ? reponse : null;
}

export interface Orientation extends Aiguillage {
  /** Vrai si un modèle a été appelé pour départager. Sert au journal, pas à l'affichage. */
  arbitre: boolean;
}

/**
 * L'aiguillage complet : les mots d'abord, le modèle seulement s'ils hésitent.
 * Une panne de l'API ne fait pas échouer l'orientation — on retombe sur la
 * meilleure piste locale, en gardant `certitude` à « hésitante » pour que la
 * page propose les autres.
 */
export async function orienter(question: string): Promise<Orientation> {
  const local = aiguiller(question);
  if (local.certitude !== 'hesitante' || !estJuristeConfigure()) {
    return { ...local, arbitre: false };
  }

  try {
    const choisi = await arbitrer(question, local.pistes.map((piste) => piste.id));
    if (!choisi) return { ...local, arbitre: true };
    return { ...local, domaine: choisi, certitude: 'sure', arbitre: true };
  } catch {
    return { ...local, arbitre: false };
  }
}

/* ================================================================ la réponse === */

export interface Echange {
  role: 'user' | 'assistant';
  content: string;
}

export interface ReponseJuriste {
  texte: string;
  /** Vrai si le modèle a refusé de répondre : la page le dit sans le maquiller. */
  refus: boolean;
}

/** Construit le message du visiteur, avec la pièce jointe s'il y en a une. */
function messageAvecPiece(question: string, piece: Piece | null): Anthropic.MessageParam {
  if (!piece) return { role: 'user', content: question };

  const blocs: Anthropic.ContentBlockParam[] = [];

  if (piece.nature === 'pdf') {
    blocs.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: piece.donnees },
      title: piece.nom,
    });
  } else if (piece.nature === 'texte') {
    blocs.push({
      type: 'document',
      source: { type: 'text', media_type: 'text/plain', data: piece.donnees },
      title: piece.nom,
    });
  } else {
    blocs.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: piece.type as 'image/jpeg' | 'image/png' | 'image/webp',
        data: piece.donnees,
      },
    });
  }

  /* La consigne de lecture est jointe au document plutôt qu'au socle : elle ne
     vaut que quand il y a une pièce, et le socle doit rester identique d'un
     message à l'autre pour être mis en cache. */
  blocs.push({
    type: 'text',
    text: [
      `Document déposé par la personne : ${piece.nom}.`,
      'Lis-le avant de répondre. Cite entre guillemets les passages exacts sur lesquels tu t’appuies, en indiquant où ils se trouvent (article, clause, page). Si le document est illisible, incomplet ou tronqué, dis-le au lieu de deviner ce qu’il contient.',
      '',
      question,
    ].join('\n'),
  });

  return { role: 'user', content: blocs };
}

/**
 * Pose la question au spécialiste. L'historique est renvoyé entier : l'API est
 * sans état, et une consultation tient largement dans la fenêtre.
 */
export async function repondre(
  id: DomaineId,
  historique: Echange[],
  piece: Piece | null = null,
): Promise<ReponseJuriste> {
  const fiche = domaine(id);
  const client = new Anthropic();

  const precedents = historique.slice(0, -1).map<Anthropic.MessageParam>((echange) => ({
    role: echange.role,
    content: echange.content,
  }));
  const derniere = historique[historique.length - 1];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    /* Une question de droit se traite en réfléchissant : le modèle doit
       pouvoir vérifier qu'il ne confond pas deux régimes voisins avant
       d'écrire. L'effort moyen tient l'attente sous une poignée de secondes. */
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system: [
      { type: 'text', text: SOCLE },
      {
        type: 'text',
        text: consigneDomaine(fiche),
        /* Socle et fiche sont identiques à chaque message d'une même
           consultation : mis en cache, ils ne sont facturés qu'une fois. */
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [...precedents, messageAvecPiece(derniere?.content ?? '', piece)],
  });

  if (response.stop_reason === 'refusal') {
    return {
      texte:
        'Je ne peux pas traiter cette demande. Si elle concerne une situation réelle, un avocat ou un point-justice pourra vous recevoir : la consultation y est gratuite et sans condition de ressources pour un premier conseil.',
      refus: true,
    };
  }

  const texte = response.content
    .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === 'text')
    .map((bloc) => bloc.text)
    .join('\n')
    .trim();

  return {
    texte:
      texte ||
      'Je n’ai pas réussi à formuler de réponse. Reformulez votre question en précisant votre situation : la date des faits, ce que vous avez reçu, et ce que vous cherchez à obtenir.',
    refus: false,
  };
}
