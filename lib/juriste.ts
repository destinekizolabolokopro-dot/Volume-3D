import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { aiguiller, type Aiguillage } from './aiguillage';
import { cleDuModele } from './reglages';
import { rassemblerLesReferences, type CitationBrute, type Reference } from './citations';
import { corpusDuDomaine, nommerArticle, planDuCorpus, type PlanCorpus } from './corpus';
import { diagnosticsPourLeModele } from './diagnostics';
import { domaine, estDomaineId, type Domaine, type DomaineId } from './domaines';
import { MAX_OPTIONS, lirePrecision, texteDeLaQuestion, type Precision } from './precision';
import { profilPourLeModele, type Profil } from './profils';
import type { Piece } from './piece';

/**
 * Les spécialistes du droit immobilier.
 *
 * Il n'y a pas dix modèles : il y a un modèle et dix consignes. La
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

export const MODEL = 'claude-opus-5';

/**
 * Le plafond n'est pas la longueur voulue : la longueur se demande dans la
 * consigne (« une réponse juridique tient en une page »), pas ici. Ce nombre
 * n'est qu'une sécurité, et il est large parce que la réflexion du modèle se
 * décompte du même budget : trop serré, il tronquerait la réponse au milieu
 * d'une phrase — le pire endroit possible pour un délai.
 */
export const MAX_TOKENS = 16000;

/**
 * La clé vient de `lib/reglages.ts`, pas de l'environnement directement.
 *
 * Le SDK sait lire `ANTHROPIC_API_KEY` tout seul, et c'est précisément ce
 * qu'il ne faut pas laisser faire : la clé peut aussi venir de l'espace de
 * réglages, chiffrée en base. Une seule fonction décide laquelle s'applique,
 * et tout le monde passe par elle — sinon la page afficherait « configuré »
 * pendant que l'appel partirait sans clé.
 */
export async function estJuristeConfigure(): Promise<boolean> {
  return Boolean(await cleDuModele());
}

/**
 * Le client, ou `null` si aucune clé n'est en place.
 *
 * Renvoyer `null` plutôt que de laisser le SDK partir sans clé change la
 * nature de l'échec : une panne d'authentification devient une absence de
 * configuration, que l'appelant sait expliquer en français.
 */
export async function client(): Promise<Anthropic | null> {
  const apiKey = await cleDuModele();
  return apiKey ? new Anthropic({ apiKey }) : null;
}

/* ============================================================== la consigne === */

/**
 * Le socle, identique pour les dix spécialistes.
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
export const SOCLE = [
  'Tu es un assistant juridique français spécialisé en DROIT IMMOBILIER, et en rien d’autre.',
  '',
  'Tu t’adresses à deux publics, et tu reconnais lequel te parle dès les premiers mots.',
  '',
  'Des PROPRIÉTAIRES d’abord : bailleurs, loueurs en meublé de tourisme, copropriétaires. Ils n’ont aucune formation en droit, et tu te places de leur côté — non pour leur donner raison, mais parce que « puis-je donner congé ? » et « mon propriétaire peut-il me donner congé ? » appellent la même règle et deux réponses différentes.',
  '',
  'Des PROFESSIONNELS ensuite : agents immobiliers, mandataires, négociateurs, gestionnaires, conciergeries. Avec eux, va droit au fait : ils connaissent le vocabulaire, ils travaillent sous contrainte de temps, et ce qu’ils attendent tient en trois choses — la règle exacte, la pièce à réunir, et le risque qu’ils prennent s’ils passent outre. Épargne-leur les définitions, jamais les conditions de forme.',
  '',
  'Un professionnel engage sa responsabilité là où un particulier ne risque que son affaire : quand la question vient d’un professionnel, dis-lui ce qu’il doit écrire et conserver, pas seulement ce qu’il doit faire.',
  '',
  'Si la personne écrit manifestement depuis l’autre côté — elle est locataire, voisine, acquéreuse —, réponds-lui aussi justement, en disant en une phrase depuis quel point de vue tu réponds. Le droit est le même pour les deux ; ce qui change, c’est ce qu’il y a à faire.',
  '',
  'RÈGLES ABSOLUES',
  '',
  '1. Aucune référence inventée. Tu ne cites un numéro d’article QUE s’il figure dans les textes officiels joints à la conversation. Tout le reste — jurisprudence, doctrine, règlement local, texte non joint —, tu le nommes sans le numéroter : « la loi de 1989 sur les baux d’habitation », « la loi de 1965 sur la copropriété ». Tu n’inventes jamais une date d’arrêt, un nom de décision ni un numéro de pourvoi. Une référence fausse a l’apparence exacte d’une vraie : elle sera recopiée dans un courrier et opposée à un juge. Il vaut mieux écrire « la loi impose un préavis » que d’inventer l’article qui le dit.',
  '',
  'Quand un texte joint répond, cite-le : le passage exact entre guillemets, puis l’article. Quand aucun ne répond, dis-le — les textes joints ne couvrent pas tout, et une lacune annoncée vaut mieux qu’une lacune comblée.',
  '',
  '2. Le délai d’abord. Si la situation est enfermée dans un délai, tu le dis tôt et clairement, avant les explications. Tu précises à partir de quand il court. Si tu n’es pas certain du délai applicable, tu dis qu’il en existe un, qu’il est court, et qu’il faut vérifier la mention des voies de recours portée sur le document lui-même — c’est elle qui fait foi.',
  '',
  '3. Tu CONSEILLES, sans plaider ni promettre. Dis ce que tu ferais à sa place, et dans quel ordre : c’est ce qu’on attend de toi, et une réponse qui se contente d’exposer la règle laisse la personne exactement où elle était. Recommande, hiérarchise, tranche quand les faits le permettent. Mais tu ne promets jamais une issue : ni « vous allez gagner », ni « c’est perdu d’avance ». Le résultat dépend des preuves et du juge, pas de ton avis.',
  '',
  'Et tu ne prends jamais la place d’un avocat. Tu n’analyses pas un dossier que tu n’as pas, tu ne représentes personne, tu ne signes rien, et tu ne dis jamais à quelqu’un de renoncer à un recours. Dès qu’il y a une audience, une procédure engagée, un délai qui court ou une somme importante, tu dis que c’est le moment de voir un avocat — mais tu donnes d’abord ce que tu sais : se défausser sans rien dire n’aide personne.',
  '',
  '4. Tu ne devines pas les faits. Quand la règle applicable dépend d’un élément que la personne n’a pas donné — la date des faits, le type de bail, la commune du bien, la date de réception des travaux, le régime fiscal choisi, ce qui est écrit au règlement de copropriété —, appelle l’outil « preciser » AU LIEU de répondre à moitié. C’est ce qui sépare une réponse d’une devinette bien tournée.',
  '',
  'Trois garde-fous sur cette question. Une seule à la fois, celle qui change le plus la réponse. Jamais deux tours de suite : si la personne ne sait pas, ou répond à côté, tu réponds en distinguant les cas au lieu de redemander. Et jamais pour du confort — une question dont la réponse ne changerait rien fait perdre un tour à tout le monde, et donne l’impression d’un formulaire.',
  '',
  'Quand les réponses possibles s’énumèrent, donne-les : « vide ou meublé », « avant ou après 2023 ». Un bouton se clique, une phrase se retape.',
  '',
  '5. Tu restes dans ta spécialité. Si la question relève d’une autre spécialité immobilière, tu le dis en une phrase et tu nommes celle qui convient, puis tu réponds quand même sur la part qui te concerne, s’il y en a une.',
  '',
  '6. Tu ne sors pas du droit immobilier. Une question de droit du travail, de famille, de succession, de consommation courante ou de droit pénal n’est pas de ton ressort, même si tu crois en connaître la réponse : tu le dis franchement, en une phrase, et tu orientes vers un point-justice ou un avocat. Une exception : quand un autre droit touche directement le bien — la fiscalité des loyers, une succession qui met un immeuble en indivision, un impayé à recouvrer —, tu traites la part immobilière et tu signales le reste.',
  '',
  '7. Tu n’es pas un avocat, et tu le rappelles quand c’est en jeu : dès qu’il y a une audience, un délai en cours, un enjeu financier important ou une procédure engagée, tu indiques vers qui se tourner concrètement — avocat et comment en obtenir un au titre de l’aide juridictionnelle, commissaire de justice, notaire, conciliateur de justice, ADIL, point-justice, expert d’assuré, géomètre-expert, service urbanisme de la mairie.',
  '',
  'URGENCES',
  'Si la situation comporte un danger ou une échéance immédiate — un logement inhabitable, un sinistre en cours, une audience dans les jours qui viennent, un délai de recours qui expire, des personnes en danger dans le bien —, tu commences par ce qu’il faut faire aujourd’hui et par qui appeler. Le reste vient après.',
  '',
  'FORME',
  'Écris en texte simple, sans balises ni Markdown, en paragraphes courts. Pour une question factuelle, réponds en quelques phrases. Pour une vraie situation, structure la réponse avec ces intertitres, chacun seul sur sa ligne et suivi de deux points :',
  'Ce que dit la règle :',
  'Ce que je ferais à votre place :',
  'Le délai :',
  'Quand il faut un avocat :',
  'Les énumérations commencent par un tiret cadratin (—). N’emploie jamais d’astérisques ni de dièses.',
].join('\n');

/**
 * La fiche du spécialiste. Elle est reconstruite à l'identique d'un message à
 * l'autre pour un même domaine : c'est ce qui permet de la mettre en cache et
 * de ne pas la refacturer à chaque question.
 */
export function consigneDomaine(fiche: Domaine): string {
  const lignes = [
    `SPÉCIALITÉ : ${fiche.label.toUpperCase()}`,
    fiche.resume,
    '',
    'Tu traites :',
    ...fiche.matieres.map((matiere) => `— ${matiere}`),
    '',
    'Tu ne traites pas, et tu renvoies alors vers la spécialité indiquée :',
    ...fiche.renvois.map((renvoi) => `— ${renvoi.quand} → « ${domaine(renvoi.vers).label} »`),
    '',
    'Textes sur lesquels tu t’appuies (à nommer sans numéro d’article) :',
    ...fiche.sources.map((source) => `— ${source}`),
    '',
    'Délais à signaler dès qu’ils concernent la situation. Ils sont fiables, mais ils ne couvrent pas tous les cas : si le document de la personne mentionne un autre délai, c’est ce document qui fait foi.',
    ...fiche.delais.map((delai) => `— ${delai}`),
    '',
    'Ce qu’il faut avoir sous les yeux avant d’agir. Quand une de ces pièces manque et qu’elle change la réponse, demande-la au lieu de supposer qu’elle existe :',
    ...fiche.verifications.map((verification) => `— ${verification}`),
  ];

  /* Le tableau des diagnostics n'est donné qu'aux spécialités qui le
     manipulent vraiment. Ailleurs il occuperait la fenêtre sans servir, et
     inviterait le modèle à ramener la conversation sur un terrain qui n'est
     pas le sien. */
  if (fiche.diagnostics) lignes.push('', diagnosticsPourLeModele());

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

  const anthropic = await client();
  if (!anthropic) return null;

  const choix = pistes.map((id) => {
    const fiche = domaine(id);
    return `${fiche.id} — ${fiche.label} : ${fiche.resume}`;
  });

  const response = await anthropic.messages.create({
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
        content: `Spécialités possibles :\n${choix.join('\n')}\n\nQuestion :\n${question}\n\nIdentifiant :`,
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
  if (local.certitude !== 'hesitante' || !(await estJuristeConfigure())) {
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
  /**
   * Renseigné quand le spécialiste réclame un fait avant de répondre. La page
   * affiche alors la question et ses boutons ; le fil, lui, n’enregistre que
   * du texte (voir `texteDeLaQuestion`).
   */
  precision?: Precision | null;
  /**
   * Ce qui précède la question, sans elle.
   *
   * `texte` porte les deux, parce que c'est lui qu'on enregistre : rouverte
   * dans six mois, la consultation doit montrer ce qui a été demandé. Mais à
   * l'écran, la question est déjà dans son encadré — l'afficher aussi dans la
   * bulle la ferait lire deux fois.
   */
  preambule?: string;
  /**
   * Les articles sur lesquels la réponse s'appuie réellement, tels que l'API
   * les a rattachés au corpus. Vide quand le corpus n'est pas construit, ou
   * quand la réponse n'a rien cité — ce qui arrive, et qui doit se voir.
   */
  references?: Reference[];
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
      `Document déposé par la personne : ${piece.nom}.`,
      'Lis-le avant de répondre. Cite entre guillemets les passages exacts sur lesquels tu t’appuies, en indiquant où ils se trouvent (article, clause, page). Si le document est illisible, incomplet ou tronqué, dis-le au lieu de deviner ce qu’il contient.',
      '',
      question,
    ].join('\n'),
  });

  return { role: 'user', content: blocs };
}

/* ================================================================== le corpus === */

/**
 * Les textes officiels joints à la consultation.
 *
 * Un document par texte, un bloc par article. Ce découpage n'est pas
 * cosmétique : il est ce qui permet à l'API de dire QUEL article a servi, et
 * donc à la page d'afficher un numéro qui vient du fonds LEGI et non de la
 * mémoire du modèle.
 *
 * La consigne de lecture ferme la série et porte le point de mise en cache. Le
 * corpus d'un domaine ne change pas d'un message à l'autre : écrit une fois,
 * relu à chaque tour sans être refacturé.
 */
export async function blocsDuCorpus(
  id: DomaineId,
): Promise<{ blocs: Anthropic.ContentBlockParam[]; plan: PlanCorpus | null }> {
  const corpus = await corpusDuDomaine(id);
  if (!corpus || corpus.documents.length === 0) return { blocs: [], plan: null };

  const blocs: Anthropic.ContentBlockParam[] = corpus.documents.map((document) => ({
    type: 'document',
    source: {
      type: 'content',
      content: document.articles.map((article) => ({
        type: 'text' as const,
        text: `${nommerArticle(article.num)}\n${article.texte}`,
      })),
    },
    title: document.titre,
    /* Le contexte n'est pas citable : il situe le document, il n'a pas
       vocation à être recopié dans une réponse. */
    context: `${document.nom} — texte officiel, fonds LEGI arrêté au ${corpus.arrete}.`,
    citations: { enabled: true },
  }));

  blocs.push({
    type: 'text',
    text: [
      `Textes officiels ci-dessus (${corpus.documents.map((d) => d.nom).join(', ')}), en vigueur au ${corpus.arrete}.`,
      'Appuie-toi dessus en priorité, et cite le passage exact quand il répond.',
      'Ils ne contiennent ni jurisprudence, ni doctrine, ni règlement local, ni délibération communale, ni règlement de copropriété : sur ces points-là, nomme la source sans la numéroter.',
      'Ils peuvent aussi ne pas couvrir la question posée. Dis-le alors franchement, au lieu de rapprocher un article qui parle d’autre chose.',
    ].join('\n'),
    /* Le corpus est identique à chaque tour : mis en cache ici, il n'est
       facturé qu'une fois pour toute la consultation. */
    cache_control: { type: 'ephemeral' },
  });

  return { blocs, plan: planDuCorpus(corpus) };
}

/** Pose les textes en tête du premier message, là où ils resteront identiques. */
export function poserLeCorpus(
  messages: Anthropic.MessageParam[],
  blocs: Anthropic.ContentBlockParam[],
): Anthropic.MessageParam[] {
  if (blocs.length === 0 || messages.length === 0) return messages;

  const premier = messages[0];
  const contenu =
    typeof premier.content === 'string'
      ? [{ type: 'text' as const, text: premier.content }]
      : premier.content;

  return [{ ...premier, content: [...blocs, ...contenu] }, ...messages.slice(1)];
}

/* ================================================================== l'outil === */

/**
 * L'outil par lequel le spécialiste réclame ce qui lui manque.
 *
 * Pourquoi un outil plutôt qu'une phrase dans la réponse : parce qu'une
 * question rendue en texte oblige la personne à retaper une réponse que le
 * modèle connaissait déjà — « vide ou meublé ? » appelle deux boutons, pas un
 * paragraphe. Le format structuré permet de les afficher, et rend la question
 * reconnaissable par la page au lieu d'être devinée dans un flot de texte.
 *
 * `strict` garantit que les arguments valident le schéma : sans lui, une
 * réponse mal formée passerait et il faudrait la rattraper à la lecture.
 */
const OUTIL_PRECISER: Anthropic.Tool = {
  name: 'preciser',
  description: [
    'Réclame LA information manquante qui change la réponse, au lieu de répondre à moitié.',
    '',
    'À utiliser quand la règle applicable dépend d’un fait que la personne n’a pas donné :',
    'le type de bail, la date des faits, la commune, le régime fiscal choisi, la nature du',
    'congé, la date de réception des travaux. N’appelle pas cet outil pour du confort — une',
    'question qui ne changerait pas la réponse fait perdre un tour à tout le monde.',
    '',
    'Une seule question à la fois, et jamais deux tours de suite : si la personne ne sait pas,',
    'réponds en distinguant les cas plutôt qu’en redemandant.',
  ].join('\n'),
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['question', 'pourquoi', 'options'],
    properties: {
      question: {
        type: 'string',
        description: 'La question, en une phrase, sans jargon. Exemple : « Le bail est-il vide ou meublé ? »',
      },
      pourquoi: {
        type: 'string',
        description:
          'En une phrase : ce que la réponse change. Exemple : « Le préavis du bailleur est de six mois pour un vide, trois pour un meublé. »',
      },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: `Les réponses possibles, de deux à ${MAX_OPTIONS}, quand elles s’énumèrent. Tableau vide pour une date, un montant ou une adresse.`,
      },
    },
  },
};

/**
 * Pose la question au spécialiste. L'historique est renvoyé entier : l'API est
 * sans état, et une consultation tient largement dans la fenêtre.
 */
export async function repondre(
  id: DomaineId,
  historique: Echange[],
  piece: Piece | null = null,
  profil: Partial<Profil> | null = null,
): Promise<ReponseJuriste> {
  const fiche = domaine(id);
  const anthropic = await client();
  if (!anthropic) throw new Error('Aucune clé d’API n’est configurée.');
  const { blocs, plan } = await blocsDuCorpus(id);

  const precedents = historique.slice(0, -1).map<Anthropic.MessageParam>((echange) => ({
    role: echange.role,
    content: echange.content,
  }));
  const derniere = historique[historique.length - 1];

  const response = await anthropic.messages.create({
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
           consultation : mis en cache, ils ne sont facturés qu'une fois. */
        cache_control: { type: 'ephemeral' },
      },
      /* Le profil vient APRÈS le point de mise en cache, et c'est tout
         l'intérêt : il change d'une personne à l'autre, quand la consigne du
         spécialiste ne change jamais. Placé avant, il ferait refacturer la
         fiche à chaque utilisateur. */
      ...(profil && profilPourLeModele(profil)
        ? [{ type: 'text' as const, text: profilPourLeModele(profil) }]
        : []),
    ],
    /* L'outil est déclaré à chaque tour, jamais imposé : c'est au spécialiste
       de juger s'il lui manque un fait, et le forcer produirait des questions
       de formulaire. */
    tools: [OUTIL_PRECISER],
    tool_choice: { type: 'auto' },
    messages: poserLeCorpus([...precedents, messageAvecPiece(derniere?.content ?? '', piece)], blocs),
  });

  if (response.stop_reason === 'refusal') {
    return {
      texte:
        'Je ne peux pas traiter cette demande. Si elle concerne une situation réelle, un avocat ou un point-justice pourra vous recevoir : la consultation y est gratuite et sans condition de ressources pour un premier conseil.',
      refus: true,
    };
  }

  const texte = response.content
    .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === 'text')
    .map((bloc) => bloc.text)
    .join('\n')
    .trim();

  /* Les citations viennent de l'API, pas du texte : on ne relit pas la réponse
     pour y deviner des numéros d'article, on prend ceux que le modèle a
     réellement rattachés au corpus. Une réponse qui ne cite rien affiche zéro
     référence — c'est une information, pas un défaut à masquer. */
  const references = plan
    ? rassemblerLesReferences(
        response.content
          .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === 'text')
          .flatMap((bloc) => (bloc.citations ?? []) as CitationBrute[]),
        plan,
      )
    : [];

  /* La question passe par l'outil ; le reste du tour, s'il y en a un, reste du
     texte. Les deux peuvent coexister — le spécialiste commence parfois par
     situer le sujet avant de réclamer la pièce qui lui manque. */
  const appel = response.content.find(
    (bloc): bloc is Anthropic.ToolUseBlock => bloc.type === 'tool_use' && bloc.name === 'preciser',
  );
  const precision = appel ? lirePrecision(appel.input) : null;

  if (precision) {
    return {
      texte: texte ? `${texte}\n\n${texteDeLaQuestion(precision)}` : texteDeLaQuestion(precision),
      refus: false,
      precision,
      preambule: texte,
      references,
    };
  }

  return {
    texte:
      texte ||
      'Je n’ai pas réussi à formuler de réponse. Reformulez votre question en précisant votre situation : la date des faits, ce que vous avez reçu, et ce que vous cherchez à obtenir.',
    refus: false,
    references,
  };
}
