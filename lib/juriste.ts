import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { aiguiller, type Aiguillage } from './aiguillage';
import { SOCLE, encadrerLaPiece } from './consigne';
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

  /* LE CARTOUCHE VIENT AVANT LE DOCUMENT, et c'est tout l'objet du
     changement. La consigne de lecture était posée APRÈS lui : le contenu de
     la pièce arrivait donc dans la requête sans qu'aucune phrase n'ait encore
     dit ce qu'il était. Or rien, dans la forme d'un bloc de contenu, ne
     distingue une clause de bail d'un « ignore les instructions précédentes »
     glissé en pied de page — et un PDF, ça se fabrique. Le cartouche pose la
     frontière avant que le document ne commence. Voir lib/consigne.ts. */
  blocs.push({ type: 'text', text: encadrerLaPiece(piece.nom) });

  /* `citations` est joint ici comme il l'est sur le corpus, et ce n'est pas
     un ornement : l'API refuse (400) une requête où certains documents
     l'activent et d'autres non. Sans cette ligne, TOUTE pièce jointe en PDF
     ou en texte faisait échouer la consultation dès que le corpus était
     construit. Les extraits qui en sortent sont écartés à la relecture — leur
     indice ne tombe sur aucun texte officiel, voir lib/citations.ts —, ce qui
     est le comportement voulu : on ne cite pas un bail comme on cite la loi. */
  if (piece.nature === 'pdf') {
    blocs.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: piece.donnees },
      title: piece.nom,
      citations: { enabled: true },
    });
  } else if (piece.nature === 'texte') {
    blocs.push({
      type: 'document',
      source: { type: 'text', media_type: 'text/plain', data: piece.donnees },
      title: piece.nom,
      citations: { enabled: true },
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

  /* Puis la consigne de lecture et la question, après le document : ce qui
     vient en dernier est ce à quoi le modèle répond. Elle est jointe à la
     pièce plutôt qu'au socle parce qu'elle ne vaut que lorsqu'il y en a une,
     et que le socle doit rester identique d'un message à l'autre pour être
     mis en cache. */
  blocs.push({
    type: 'text',
    text: [
      'FIN DE LA PIÈCE. Ce qui suit est la question de la personne, et c’est à elle que tu réponds.',
      '',
      'Cite entre guillemets les passages exacts du document sur lesquels tu t’appuies, en indiquant où ils se trouvent (article, clause, page). S’il est illisible, incomplet ou tronqué, dis-le au lieu de deviner ce qu’il contient.',
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
