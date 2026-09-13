/**
 * Le site, en un seul fichier : `npm run artefact`.
 *
 * Ce que ce fichier est, exactement : les écrans du site, avec SA feuille de
 * style — app/socle.css et app/assistant.css, inlinées sans une retouche — et
 * ses vraies classes. Ce qu'on voit ici est ce qu'on voit en ligne, parce que
 * c'est le même dessin, pas une imitation.
 *
 * Il porte cinq écrans, ceux qu'on montre : l'accueil, l'espace de travail
 * avec ses onglets de branches et son mode mains libres, les dix fiches de
 * spécialité, le catalogue des dix-sept courriers, et la page d'une branche à
 * venir. On passe de l'un à l'autre sans réseau.
 *
 * ── La seule chose qu'il ne sait pas faire ─────────────────────────────────
 * Répondre. Il n'y a pas de modèle derrière un fichier : poser une question
 * affiche un échange ENREGISTRÉ, annoncé comme tel en toutes lettres. Une
 * démonstration qui laisse croire qu'elle répond en direct est un mensonge
 * qu'on découvre à la deuxième question, devant la personne qu'on voulait
 * convaincre.
 *
 * ── Ce qu'il sait faire pour de vrai ───────────────────────────────────────
 * La voix. Dicter et écouter sont des fonctions du navigateur, pas du
 * serveur : le micro et la lecture à voix haute marchent ici comme en ligne,
 * mode mains libres compris.
 *
 * ── La forme attendue par un artefact ──────────────────────────────────────
 * Pas de <!doctype>, pas de <html>, pas de <head>, pas de <body> : la page est
 * enveloppée à la publication. On écrit le <title>, le <style>, puis le corps.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FORMULES, prixLisible, quotaLisible } from '../lib/abonnements.ts';
import { BRANCHES } from '../lib/branches.ts';
import { CALENDRIER_ENERGIE, DIAGNOSTICS } from '../lib/diagnostics.ts';
import { DOMAINES } from '../lib/domaines.ts';
import { FAMILLES, MODELES } from '../lib/documents.ts';
import {
  ACCUEIL,
  APPEL,
  ESPACE,
  ETAPES,
  LIMITES,
  MARQUE,
  MENTION,
  ORIENTATION,
  PIED,
  PREUVE,
  RASSURANCE,
  SPECIALISTE,
  VITRINE_DOCUMENTS,
} from '../lib/copie.ts';
import { dateLisible, nombreLisible } from '../lib/nombres.ts';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(RACINE, 'standalone', 'immolex-artefact.html');

const lire = (chemin) => readFileSync(join(RACINE, chemin), 'utf8');
const lireJson = (chemin) => JSON.parse(lire(chemin));

const e = (v) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const liste = (items, classe = '') =>
  `<ul${classe ? ` class="${classe}"` : ''}>${items.map((i) => `<li>${e(i)}</li>`).join('')}</ul>`;

/**
 * Le sceau, en clair de composants/Sceau.tsx. Ce fichier n'a pas de React :
 * il écrit du HTML. Le dessin est le même, au trait près — un double anneau,
 * le monogramme, deux étoiles — et les couleurs viennent des jetons, si bien
 * qu'il suit le fond sur lequel on le pose.
 */
const sceau = (taille, trait = 'var(--accent)', lettre = 'var(--accent)') =>
  `<svg width="${taille}" height="${taille}" viewBox="0 0 100 100" aria-hidden="true" focusable="false" style="flex:none">
  <circle cx="50" cy="50" r="47" fill="none" stroke="${trait}" stroke-width="2.5"/>
  <circle cx="50" cy="50" r="39.5" fill="none" stroke="${trait}" stroke-width="1"/>
  <text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="Bodoni Moda, Didot, serif" font-size="40" font-weight="500" fill="${lettre}">IM</text>
  <path d="M50 12.5 l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="${trait}"/>
  <path d="M50 72.8 l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="${trait}"/>
</svg>`;

/**
 * Pose l'italique de cire sur les mots accentués du titre d'accueil, comme le
 * fait `accentuer()` dans components/Assistant.tsx.
 */
const accentue = (ligne) => {
  const accent = ACCUEIL.titreAccent;
  const coupe = accent ? ligne.indexOf(accent) : -1;
  if (coupe < 0) return e(ligne);

  return `${e(ligne.slice(0, coupe))}<em>${e(accent)}</em>${e(ligne.slice(coupe + accent.length))}`;
};

const index = lireJson('corpus/index.json');
const articles = index.domaines.reduce((n, d) => n + d.articles, 0);
const parDomaine = Object.fromEntries(index.domaines.map((d) => [d.domaine, d.articles]));

/* ============================================================== l'exemple === */

/**
 * L'échange montré quand on pose une question.
 *
 * La question et la réponse sont écrites ici — c'est une démonstration, elle
 * est assumée. Les ARTICLES, eux, sont lus dans le corpus : leur numéro, leur
 * place dans le plan et leur texte sortent du fonds LEGI. Montrer une citation
 * inventée pour vanter un produit dont l'argument est de ne pas en inventer
 * serait difficile à défendre.
 */
const EXEMPLE = {
  domaine: 'bail-habitation',
  question:
    'Je veux vendre mon appartement, qui est loué vide depuis 2021. Le bail arrive à échéance en mars. Comment donner congé ?',
  reponse: [
    ['titre', 'Le délai'],
    ['texte',
      'Six mois avant l’échéance, pour un logement vide. Si le bail se termine en mars, le congé doit être reçu par le locataire au plus tard fin septembre. Un jour de retard et il ne vaut rien : le bail se reconduit pour trois ans.'],
    ['titre', 'Ce que dit la règle'],
    ['texte',
      'Le congé pour vendre doit indiquer le motif, le prix et les conditions de la vente. Il vaut offre de vente au profit du locataire, qui dispose de deux mois pour l’accepter. Ce n’est pas une formalité : un congé qui omet le prix est nul, et la nullité se soulève des années plus tard.'],
    ['titre', 'Ce que vous pouvez faire'],
    ['liste', [
      'compter six mois pleins depuis la date d’échéance portée au contrat, pas depuis la signature ;',
      'faire délivrer le congé par commissaire de justice — la preuve de réception est ce qui se conteste le plus ;',
      'y porter le prix et les conditions, faute de quoi il est nul.',
    ]],
    ['titre', 'Quand il faut un professionnel'],
    ['texte',
      'Si le locataire a plus de soixante-cinq ans et des ressources modestes, la protection légale peut vous interdire le congé sauf à lui proposer un relogement. C’est le cas où une erreur coûte trois ans : faites vérifier la situation avant d’envoyer quoi que ce soit.'],
  ],
  citations: [
    { texte: 'loi du 6 juillet 1989', num: '15' },
    { texte: 'code civil', num: '1743' },
  ],
};

function citationsReelles() {
  const corpus = lireJson(`corpus/${EXEMPLE.domaine}.json`);
  return EXEMPLE.citations.map(({ texte, num }) => {
    const document = corpus.documents.find((d) => d.nom === texte);
    if (!document) throw new Error(`corpus : texte « ${texte} » introuvable`);
    const article = document.articles.find((a) => a.num === num);
    if (!article) throw new Error(`corpus : ${texte} n’a pas d’article ${num}`);
    const extrait = article.texte.split('\n')[0].slice(0, 340);
    return {
      source: document.nom,
      article: /^(article|annexe)/i.test(article.num) ? article.num : `Article ${article.num}`,
      chemin: article.chemin.join(' › '),
      extrait: extrait.length < article.texte.length ? `${extrait.trimEnd()}…` : extrait,
    };
  });
}

const citations = citationsReelles();

const reponseRendue = EXEMPLE.reponse
  .map(([type, valeur]) =>
    type === 'titre'
      ? `<p class="jur-intertitre">${e(valeur)}</p>`
      : type === 'liste'
        ? liste(valeur, 'jur-liste')
        : `<p>${e(valeur)}</p>`,
  )
  .join('');

const sources = citations
  .map(
    (c) => `
      <li>
        <p class="jur-source-titre">${e(c.article)}<span class="jur-source-texte"> — ${e(c.source)}</span></p>
        <p class="jur-source-chemin">${e(c.chemin)}</p>
        <blockquote>${e(c.extrait)}</blockquote>
      </li>`,
  )
  .join('');

/* ============================================================ les morceaux === */

/** Le champ de saisie, tel que le site le dessine — micro compris. */
const composeur = (id, action, placeholder, note, grand = true) => `
  <form class="jur-composer${grand ? ' jur-composer-grand' : ''}" data-demo="${e(id)}">
    <label class="sr-only" for="q-${e(id)}">Votre question</label>
    <textarea id="q-${e(id)}" placeholder="${e(placeholder)}" maxlength="6000"></textarea>

    <div class="jur-composer-foot">
      <span class="jur-fichier" aria-disabled="true" title="Le dépôt de document demande le site">
        <span aria-hidden="true">📎</span>Joindre un document
      </span>

      <button type="button" class="jur-micro" data-micro="q-${e(id)}" aria-pressed="false">
        <span class="jur-micro-icone" aria-hidden="true">🎙</span><span data-micro-texte>Dicter</span>
      </button>

      <p class="jur-hint jur-micro-note">
        La reconnaissance vocale est celle de votre navigateur et peut envoyer l’audio à son
        éditeur. Ce que vous dictez reste ici tant que vous n’envoyez pas.
      </p>

      <button class="btn btn-accent" type="submit">${e(action)}</button>
    </div>

    <p class="jur-hint jur-composer-note">${e(note)}</p>
  </form>`;

/** L'échange enregistré, révélé quand on envoie. */
const echange = (id) => `
  <div class="demo-echange" id="echange-${e(id)}" hidden>
    <p class="demo-etiquette"><span aria-hidden="true">●</span> Échange enregistré · cette page ne répond pas</p>
    <div class="jur-fil">
      <div class="jur-tour jur-de-vous"><p>${e(EXEMPLE.question)}</p></div>
      <div class="jur-tour jur-de-lui">
        ${reponseRendue}
        <details class="jur-sources" open>
          <summary>Les ${citations.length} textes cités</summary>
          <ul>${sources}</ul>
        </details>
        <div class="jur-voix">
          <button type="button" class="jur-voix-bouton" data-lire="reponse-${e(id)}">
            <span aria-hidden="true">▶</span><span data-lire-texte>Écouter la réponse</span>
          </button>
        </div>
      </div>
    </div>
    <p class="hint">${e(SPECIALISTE.avertissement)}</p>
  </div>`;

/* Le texte que la lecture à voix haute prononce : la réponse, sans balises. */
const texteReponse = EXEMPLE.reponse
  .map(([type, valeur]) => (type === 'liste' ? valeur.join(' ') : valeur))
  .join('\n');

/* ============================================================== l'accueil === */

const cartes = DOMAINES.map(
  (d) => `
    <a class="jur-card" href="#${e(d.id)}" data-vers="fiche-${e(d.id)}">
      <h3>${e(d.label)}</h3>
      <p>${e(d.resume)}</p>
    </a>`,
).join('');

const suggestions = ['bail-habitation', 'courte-duree', 'travaux', 'profession']
  .map((id) => DOMAINES.find((d) => d.id === id)?.exemples?.[0])
  .filter(Boolean)
  .map((x) => `<button type="button" class="jur-chip" data-demo-envoi="accueil">${e(x)}</button>`)
  .join('');

const etapes = ETAPES.map(
  (etape) => `
    <div class="jur-etape">
      <strong>${e(etape.amorce)}</strong>
      <p>${e(etape.suite)}</p>
    </div>`,
).join('');

const familles = FAMILLES.map(
  (f) => `
    <a class="jur-famille" href="#documents" data-vers="documents">
      <strong>${e(f.label)}</strong>
      <span>${e(f.resume)}</span>
    </a>`,
).join('');

const tarifs = FORMULES.map(
  (f) => `
    <a class="jur-tarif" href="#tarifs" data-vers="documents">
      <span class="jur-tarif-nom">${e(f.nom)}</span>
      <span class="jur-tarif-prix">${e(prixLisible(f))}</span>
      <span class="jur-tarif-quota">${e(quotaLisible(f))}</span>
    </a>`,
).join('');

const limites = LIMITES.map(
  (l) => `<div class="jur-limite"><p><strong>${e(l.amorce)}</strong> ${e(l.suite)}</p></div>`,
).join('');

const accueil = `
<div class="vue" id="vue-accueil">
  <header class="jur-bar">
    <span class="jur-bar-brand">${sceau(30)}<span class="jur-bar-marque">${e(MARQUE.nom)}<small>${e(MARQUE.accroche)}</small></span></span>
    <a class="jur-bar-link" href="#documents" data-vers="documents">Documents</a>
    <a class="jur-bar-link" href="#tarifs" data-vers="documents">Formules</a>
    <a class="jur-bar-link jur-bar-compte" href="#espace" data-vers="espace">Entrer</a>
  </header>

  <main class="jur-page jur-accueil">
    <div class="jur-haut">
      <div class="jur-haut-colonne">
        <p class="jur-oeil">${e(ACCUEIL.oeil)}</p>
        <h1 class="jur-h1">${ACCUEIL.titreLignes.map((l) => `<span>${accentue(l)}</span>`).join('')}</h1>
        <p class="jur-lede">${e(ACCUEIL.lede)}</p>

        ${composeur('accueil', 'Poser la question', ORIENTATION.placeholder, 'Rien n’est conservé : en fermant cet onglet, le fil disparaît.')}
        ${echange('accueil')}

        <p class="jur-invite">${e(ORIENTATION.invite)}</p>
        <div class="jur-suggestions jur-suggestions-accueil">${suggestions}</div>
      </div>

      <aside class="jur-preuve-carte">
        <p class="jur-oeil">${e(RASSURANCE.oeil)}</p>
        <ul>${RASSURANCE.points.map((p) => `<li>${e(p)}</li>`).join('')}</ul>
        <p class="jur-preuve-arrete">${e(RASSURANCE.pied)} <strong>${e(dateLisible(index.arrete))}</strong></p>
      </aside>
    </div>

    <section class="jur-section jur-vitrine">
      <div class="jur-vitrine-tete">
        <p class="jur-oeil">Les dix spécialités</p>
        <h2 class="jur-h2">${e(ACCUEIL.grilleTitre)}</h2>
        <p class="jur-sub">${e(ACCUEIL.grilleSous)}</p>
      </div>
      <div class="jur-grid">${cartes}</div>
    </section>

    <section class="jur-section jur-vitrine">
      <div class="jur-vitrine-tete">
        <p class="jur-oeil">En trois temps</p>
        <h2 class="jur-h2">Comment ça se passe</h2>
      </div>
      <div class="jur-etapes">${etapes}</div>
    </section>

    <section class="jur-section jur-vitrine">
      <div class="jur-vitrine-tete">
        <p class="jur-oeil">${e(PREUVE.oeil)}</p>
        <h2 class="jur-h2">${e(PREUVE.titre)}</h2>
      </div>
      <div class="jur-preuve-texte">
        <p>${e(PREUVE.corps)}</p>
        <p class="jur-preuve-note">${e(PREUVE.note)}</p>
        <dl class="jur-chiffres">
          <div class="jur-chiffre"><dt>${e(index.textes)}</dt><dd>${e(PREUVE.labels.textes)}</dd></div>
          <div class="jur-chiffre"><dt>${e(nombreLisible(articles))}</dt><dd>${e(PREUVE.labels.articles)}</dd></div>
          <div class="jur-chiffre"><dt>${e(DOMAINES.length)}</dt><dd>${e(PREUVE.labels.specialites)}</dd></div>
          <div class="jur-chiffre jur-chiffre-date"><dt>${e(dateLisible(index.arrete))}</dt><dd>${e(PREUVE.labels.arrete)}</dd></div>
        </dl>
      </div>
    </section>

    <section class="jur-section jur-vitrine">
      <div class="jur-vitrine-tete">
        <p class="jur-oeil">${e(VITRINE_DOCUMENTS.oeil)}</p>
        <h2 class="jur-h2">${e(VITRINE_DOCUMENTS.titre)}</h2>
        <p class="jur-sub">${e(VITRINE_DOCUMENTS.corps)}</p>
      </div>
      <div class="jur-familles">${familles}</div>
      <a class="btn btn-ghost" href="#documents" data-vers="documents">${e(VITRINE_DOCUMENTS.action)}</a>
    </section>

    <section class="jur-section jur-vitrine">
      <div class="jur-vitrine-tete">
        <p class="jur-oeil">Formules</p>
        <h2 class="jur-h2">Ce que ça coûte</h2>
        <p class="jur-sub">
          Les fiches, les délais et les aide-mémoire restent lisibles sans compte et sans limite.
          Seules les questions posées à l’assistant sont comptées.
        </p>
      </div>
      <div class="jur-tarifs">${tarifs}</div>
    </section>

    <section class="jur-section jur-vitrine-aplat jur-bande">
      <p class="jur-oeil">Ce qu’il faut savoir</p>
      <h2>${e(ACCUEIL.limitesTitre)}</h2>
      <p class="jur-bande-sous">${e(ACCUEIL.limitesSous)}</p>
      <div class="jur-limites">${limites}</div>
    </section>

    <section class="jur-section jur-vitrine-aplat jur-appel">
      <h2>${e(APPEL.titre)}</h2>
      <p>${e(APPEL.corps)}</p>
      <div class="jur-appel-actions">
        <a class="btn btn-inverse" href="#espace" data-vers="espace">Voir l’espace de travail</a>
      </div>
    </section>
  </main>
</div>`;

/* ================================================================ l'espace === */

const onglets = BRANCHES.map(
  (b) => `
    <li>
      <a href="#${e(b.id)}" data-vers="${b.ouverte ? 'espace' : `branche-${e(b.id)}`}"
         ${b.ouverte ? 'aria-current="page"' : 'class="jur-onglet-attente"'}>
        ${e(b.label)}${b.ouverte ? '' : '<span class="jur-pastille">bientôt</span>'}
      </a>
    </li>`,
).join('');

const barreEspace = `
  <header class="jur-bar jur-bar-espace">
    <a class="jur-bar-brand" href="#accueil" data-vers="accueil">${sceau(30, 'var(--accent-on-dark)', 'var(--ink-on-dark)')}<span class="jur-bar-marque">${e(MARQUE.nom)}<small>votre espace</small></span></a>
    <a class="jur-bar-link" href="#espace" data-vers="espace">Poser une question</a>
    <a class="jur-bar-link" href="#documents" data-vers="documents">Rédiger un courrier</a>
    <a class="jur-bar-link jur-bar-compte" href="#accueil" data-vers="accueil">Camille</a>
  </header>

  <div class="jur-bandeau" role="status">
    <p>
      <strong>Confirmez votre adresse.</strong> Elle vous servira à reprendre la main sur votre
      compte, et il faut l’avoir confirmée pour passer à une formule payante. Tout le reste
      fonctionne sans.
    </p>
  </div>

  <nav class="jur-onglets-branches" aria-label="Branches du droit"><ul>${onglets}</ul></nav>`;

const formule = FORMULES[0];

const espace = `
<div class="vue" id="vue-espace" hidden>
  ${barreEspace}

  <main class="jur-page jur-accueil">
    <div class="jur-haut">
      <div class="jur-haut-colonne">
        <h1 class="jur-h1">${ESPACE.titreLignes.map((l) => `<span>${e(l)}</span>`).join('')}</h1>
        <p class="jur-lede">${e(ESPACE.lede)}</p>

        <div class="jur-mains-libres">
          <button type="button" role="switch" aria-checked="false" class="jur-bascule" id="mains-libres">
            <span class="jur-bascule-piste" aria-hidden="true"><span class="jur-bascule-pastille"></span></span>
            <span class="jur-bascule-texte">
              <strong>Mains libres</strong>
              <span data-bascule-texte>La réponse se lit à voix haute et le micro s’ouvre tout seul : pour les mains prises.</span>
            </span>
          </button>
        </div>

        ${composeur('espace', 'Envoyer', 'Racontez votre situation : les faits, les dates, les montants.', 'Consultation enregistrée dans vos dossiers. Le document joint, lui, n’est jamais conservé.')}
        ${echange('espace')}

        <p class="jur-invite">${e(ESPACE.invite)}</p>
      </div>

      <aside class="jur-preuve-carte">
        <p class="jur-oeil">Votre formule</p>
        <dl class="jur-etat-formule">
          <div><dt>${e(formule.nom)}</dt><dd>${e(quotaLisible(formule))}</dd></div>
          <div><dt>10</dt><dd>questions restantes ce mois-ci</dd></div>
        </dl>
        <div class="jur-recents">
          <p class="jur-recents-titre">Reprendre</p>
          <ul>
            <li><a href="#espace" data-vers="espace">Mon locataire est parti en laissant deux mois de loyer.</a><span>11 septembre</span></li>
          </ul>
        </div>
      </aside>
    </div>
  </main>
</div>`;

/* ====================================================== les branches à venir === */

const branches = BRANCHES.filter((b) => !b.ouverte)
  .map(
    (b) => `
<div class="vue" id="vue-branche-${e(b.id)}" hidden>
  ${barreEspace.replace(`href="#${e(b.id)}" data-vers="branche-${e(b.id)}"\n         class="jur-onglet-attente"`, `href="#${e(b.id)}" data-vers="branche-${e(b.id)}" aria-current="page" class="jur-onglet-attente"`)}

  <main class="jur-page jur-espace-page">
    <p class="jur-oeil">Branche à venir</p>
    <h1 class="jur-h1">${e(b.label)}</h1>
    <p class="jur-lede">${e(b.resume)}</p>

    <div class="jur-branche-attente">
      <div>
        <h2 class="jur-h2">Cette branche n’est pas encore ouverte</h2>
        <p>
          Ouvrir une branche, c’est construire son fonds : choisir les textes officiels, les
          découper en articles citables, relever les délais qui ne se rattrapent pas. Tant que ce
          n’est pas fait, elle ne répond pas — plutôt que de répondre sans citer.
        </p>
      </div>
      <span class="btn btn-accent" aria-disabled="true">Prévenez-moi à l’ouverture</span>
    </div>

    <section class="jur-section">
      <h2 class="jur-h2">Pour qui</h2>
      <p class="jur-sub">${e(b.pour)}</p>
    </section>

    <div class="jur-fiche-annonce">
      <section class="jur-bloc"><h3>Ce qu’elle traitera</h3>${liste(b.specialites)}</section>
      <section class="jur-bloc"><h3>Les textes qui lui serviront</h3>${liste(b.textes)}</section>
    </div>
  </main>
</div>`,
  )
  .join('');

/* ============================================================== les fiches === */

const fiches = DOMAINES.map((d) => {
  const bloc = (titre, items, classe = '') =>
    `<section class="jur-bloc${classe ? ` ${classe}` : ''}"><h3>${e(titre)}</h3>${liste(items)}</section>`;
  const renvois = d.renvois.map(
    (r) => `${r.quand} — ${DOMAINES.find((x) => x.id === r.vers)?.label ?? r.vers}`,
  );

  return `
<div class="vue" id="vue-fiche-${e(d.id)}" hidden>
  <header class="jur-bar">
    <a class="jur-bar-brand" href="#accueil" data-vers="accueil">${sceau(30)}<span class="jur-bar-marque">${e(MARQUE.nom)}<small>${e(MARQUE.accroche)}</small></span></a>
    <a class="jur-bar-link" href="#accueil" data-vers="accueil">← Toutes les spécialités</a>
    <a class="jur-bar-link" href="#documents" data-vers="documents">Documents</a>
    <a class="jur-bar-link jur-bar-compte" href="#espace" data-vers="espace">Entrer</a>
  </header>

  <main class="jur-page">
    <h1 class="jur-h1">${e(d.label)}</h1>
    <p class="jur-lede">${e(d.resume)} <span class="corpus-note">${e(parDomaine[d.id] ?? 0)} articles joints aux réponses.</span></p>

    <div class="jur-fiche">
      <div>
        ${bloc('Ce que ce spécialiste traite', d.matieres)}
        ${bloc('Ce qui relève d’un autre', renvois)}
        ${bloc('Des questions qu’on lui pose', d.exemples ?? [])}
      </div>

      <aside class="jur-aside">
        <section class="jur-bloc jur-delais">
          <h3>Délais à ne pas manquer</h3>
          ${liste(d.delais)}
          <p class="hint">${e(SPECIALISTE.delaisNote)}</p>
        </section>
        ${bloc('À vérifier avant d’agir', d.verifications)}
        ${bloc('Textes de référence', d.sources)}
      </aside>
    </div>
  </main>
</div>`;
}).join('');

/* =========================================================== les documents === */

const diagnostics = DIAGNOSTICS.map(
  (dg) => `<tr><th scope="row">${e(dg.nom)}</th><td>${e(dg.quand)}</td><td>${e(dg.validite)}</td></tr>`,
).join('');

const catalogue = FAMILLES.map((famille) => {
  const modeles = MODELES.filter((m) => m.famille === famille.id)
    .map(
      (m) => `
      <details class="doc-modele">
        <summary>
          <span class="doc-nom">${e(m.titre)}</span>
          <span class="doc-resume">${e(m.resume)}</span>
          ${m.delai ? `<span class="jur-card-delai">${e(m.delai)}</span>` : ''}
        </summary>
        <div class="doc-corps">
          <section class="jur-bloc"><h3>Ce qui doit y figurer</h3>${liste(m.mentions)}</section>
          <section class="jur-bloc doc-piege"><h3>Ce qui l’annule</h3>${liste(m.pieges)}</section>
          <section class="jur-bloc"><h3>Comment l’envoyer</h3><p>${e(m.envoi)}</p></section>
        </div>
      </details>`,
    )
    .join('');

  return `
    <section class="jur-section">
      <h2 class="jur-h2">${e(famille.label)}</h2>
      <p class="jur-sub">${e(famille.resume)}</p>
      <div class="doc-modeles">${modeles}</div>
    </section>`;
}).join('');

const documents = `
<div class="vue" id="vue-documents" hidden>
  <header class="jur-bar">
    <a class="jur-bar-brand" href="#accueil" data-vers="accueil">${sceau(30)}<span class="jur-bar-marque">${e(MARQUE.nom)}<small>${e(MARQUE.accroche)}</small></span></a>
    <a class="jur-bar-link" href="#accueil" data-vers="accueil">← L’assistant</a>
    <a class="jur-bar-link jur-bar-compte" href="#espace" data-vers="espace">Entrer</a>
  </header>

  <main class="jur-page">
    <h1 class="jur-h1">Rédiger un document</h1>
    <p class="jur-lede">
      Dix-sept courriers et actes, écrits pour votre situation et non remplis dans un modèle type.
      Chacun porte les mentions sans lesquelles il serait nul, et la liste de ce qu’il vous reste à
      compléter avant de l’envoyer.
    </p>

    ${catalogue}

    <section class="jur-section" id="diagnostics">
      <h2 class="jur-h2">Diagnostics et durées de validité</h2>
      <p class="jur-sub">
        Le rapport porte sa propre date de réalisation et de fin de validité : c’est elle qui fait
        foi. Ce tableau dit ce qu’il faut et quand le chercher.
      </p>
      <div class="jur-tableau">
        <table>
          <thead><tr><th scope="col">Diagnostic</th><th scope="col">Quand il est exigé</th><th scope="col">Validité</th></tr></thead>
          <tbody>${diagnostics}</tbody>
        </table>
      </div>
      <ul class="jur-liste-calendrier">${CALENDRIER_ENERGIE.map((l) => `<li>${e(l)}</li>`).join('')}</ul>
    </section>
  </main>
</div>`;

/* ================================================================= la page === */

/* Les trois fontes du fichier, embarquées en base64 : le Bodoni romain des
   titres, son italique — qui porte les deux mots accentués du titre d'accueil,
   et sans lequel l'accent se perdrait — et le Spectral du texte courant. Les
   graisses hautes du Spectral et le latin étendu ne sont pas embarqués : ils
   pèseraient quatre-vingts kilo-octets de plus dans un fichier qu'on ouvre
   hors ligne, pour des caractères qu'aucun de ces écrans n'emploie. */
const enBase64 = (nom) =>
  readFileSync(join(RACINE, 'public/fonts', nom)).toString('base64');

const bodoni = enBase64('bodoni-normal-400-700-latin.woff2');
const bodoniItalique = enBase64('bodoni-italic-400-700-latin.woff2');
const spectral = enBase64('spectral-normal-400-latin.woff2');
const spectralGras = enBase64('spectral-normal-600-latin.woff2');
const socle = lire('app/socle.css');
const feuille = lire('app/assistant.css');

const pied = `
<footer class="jur-pied">
  <div class="jur-pied-corps">
    <div class="jur-pied-marque">
      ${sceau(34)}
      <p class="jur-pied-nom">${e(MARQUE.nom)}</p>
      <p class="jur-pied-accroche">${e(MARQUE.accroche)}</p>
    </div>
    <div class="jur-pied-colonne jur-pied-recours">
      <p class="jur-pied-titre">${e(PIED.recoursTitre)}</p>
      <p>${e(PIED.recours)}</p>
    </div>
  </div>
  <div class="jur-pied-mention">
    <p class="jur-mention"><strong>${e(MENTION.court)}</strong> ${e(MENTION.long)}</p>
  </div>
</footer>`;

const page = `<title>${e(MARQUE.nom)}</title>

<style>
@font-face {
  font-family: 'Bodoni Moda';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url(data:font/woff2;base64,${bodoni}) format('woff2');
}

@font-face {
  font-family: 'Bodoni Moda';
  font-style: italic;
  font-weight: 400 700;
  font-display: swap;
  src: url(data:font/woff2;base64,${bodoniItalique}) format('woff2');
}

@font-face {
  font-family: 'Spectral';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(data:font/woff2;base64,${spectral}) format('woff2');
}

@font-face {
  font-family: 'Spectral';
  font-style: normal;
  font-weight: 500 600;
  font-display: swap;
  src: url(data:font/woff2;base64,${spectralGras}) format('woff2');
}
${socle}
${feuille}

/* =========================================================================
   Propre à ce fichier.

   Tout ce qui précède vient du site, sans retouche : c'est ce qui fait que la
   page a exactement son dessin. Ce qui suit ne concerne que le fichier, qui
   n'a ni serveur ni navigation — il porte à la place des écrans qu'on montre
   l'un après l'autre, et un échange enregistré.
   ========================================================================= */

/* Tout vit dans le conteneur .jur, et ce n'est pas décoratif : c'est LUI qui
   porte le pas d'espacement du site — les variables --pas, --section et
   --bloc — ainsi que ses deux ombres. Sans ce conteneur, chaque calc() de la
   feuille devient invalide, toutes les marges tombent à zéro et la page se
   colle aux bords de l'écran. Le gabarit du site enveloppe de la même façon,
   voir app/layout.tsx.
   
   Pas d'accent grave dans ce commentaire : il vit à l'intérieur d'un gabarit
   JavaScript, et un accent grave y ferme la chaîne. */
body {
  background: var(--bg-alt);
}

.jur {
  min-height: 100vh;
}

.vue {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.vue > main {
  flex: 1;
}

.vue[hidden] {
  display: none;
}

/* L'échange enregistré. L'étiquette sombre dit ce qu'il est AVANT qu'on le
   lise : une démonstration qui laisse croire qu'elle répond en direct est un
   mensonge qu'on découvre à la deuxième question. */
.demo-echange {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: #fff;
  overflow: hidden;
  margin-top: calc(var(--pas) * 2);
}

.demo-echange[hidden] {
  display: none;
}

.demo-etiquette {
  margin: 0;
  background: var(--dark);
  color: var(--ink-on-dark-soft);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: calc(var(--pas) * 1.25) calc(var(--pas) * 2.25);
}

.demo-etiquette span {
  color: var(--accent-on-dark);
  margin-right: 6px;
}

.demo-echange .jur-fil {
  padding: calc(var(--pas) * 2.5);
  margin: 0;
}

.demo-echange > .hint {
  padding: 0 calc(var(--pas) * 2.5) calc(var(--pas) * 2.5);
  margin: 0;
}

/* Le dépôt de document demande le site : le bouton reste visible, éteint, et
   le dit au survol. Le cacher ferait croire qu'il n'existe pas. */
.jur-fichier[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
}

.corpus-note {
  color: var(--ink-faint);
}

/* Le catalogue des courriers, dépliable : dix-sept fiches déroulées font
   quatre mètres de défilement sur une tablette. */
.doc-modeles {
  display: grid;
  gap: calc(var(--pas) * 1);
}

.doc-modele {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: #fff;
  overflow: hidden;
}

.doc-modele summary {
  list-style: none;
  cursor: pointer;
  padding: calc(var(--pas) * 2) var(--bloc);
  display: grid;
  gap: 3px;
  min-height: 48px;
  align-content: center;
}

.doc-modele summary::-webkit-details-marker {
  display: none;
}

.doc-modele summary:hover {
  background: var(--bg-alt);
}

.doc-nom {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ink-strong);
}

.doc-modele[open] .doc-nom {
  color: var(--accent);
}

.doc-resume {
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--ink-soft);
}

.doc-corps {
  padding: calc(var(--pas) * 0.5) var(--bloc) calc(var(--pas) * 2.5);
  border-top: 1px solid var(--line);
  display: grid;
  gap: calc(var(--pas) * 2.5);
}

.doc-corps .jur-bloc {
  background: none;
  border: 0;
  padding: 0;
}

.doc-piege h3 {
  color: var(--danger);
}

.jur-liste-calendrier {
  margin: calc(var(--pas) * 3) 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: calc(var(--pas) * 1.25);
}

.jur-liste-calendrier li {
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--ink-muted);
  padding-left: calc(var(--pas) * 2);
  position: relative;
}

.jur-liste-calendrier li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.62em;
  width: 10px;
  height: 2px;
  background: var(--accent);
}
</style>

<div class="jur">
${accueil}
${espace}
${branches}
${fiches}
${documents}
${pied}
</div>

<script>
(function () {
  /* ----------------------------------------------------------- navigation */

  var vues = Array.prototype.slice.call(document.querySelectorAll('.vue'));

  function montrer(nom) {
    var cible = document.getElementById('vue-' + nom);
    if (!cible) return;
    vues.forEach(function (v) { v.hidden = v !== cible; });
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (ev) {
    var lien = ev.target.closest('[data-vers]');
    if (!lien) return;
    ev.preventDefault();
    montrer(lien.getAttribute('data-vers'));
  });

  /* ------------------------------------------------- l'échange enregistré */

  function reveler(id) {
    var bloc = document.getElementById('echange-' + id);
    if (!bloc) return;
    bloc.hidden = false;
    bloc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (mainsLibres) lire(id);
  }

  document.addEventListener('submit', function (ev) {
    var form = ev.target.closest('[data-demo]');
    if (!form) return;
    ev.preventDefault();
    reveler(form.getAttribute('data-demo'));
  });

  document.addEventListener('click', function (ev) {
    var puce = ev.target.closest('[data-demo-envoi]');
    if (!puce) return;
    reveler(puce.getAttribute('data-demo-envoi'));
  });

  /* ------------------------------------------------------------- la voix
     Elle, elle marche pour de vrai : dicter et écouter sont des fonctions du
     navigateur, pas du serveur. */

  var REPONSE = ${JSON.stringify(texteReponse)};
  var mainsLibres = false;

  function synthese() {
    return 'speechSynthesis' in window ? window.speechSynthesis : null;
  }

  function Micro() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  /* Morceaux courts : au-delà de quelques centaines de caractères, plusieurs
     navigateurs s'arrêtent en cours de phrase sans prévenir. */
  function morceaux(texte) {
    return texte
      .split(/\\n+/)
      .flatMap(function (ligne) { return ligne.split(/(?<=[.!?;:])\\s+/); })
      .map(function (m) { return m.trim(); })
      .filter(Boolean);
  }

  var enLecture = null;

  function lire(id) {
    var moteur = synthese();
    if (!moteur) return;
    var bouton = document.querySelector('[data-lire="reponse-' + id + '"]');
    var etiquette = bouton && bouton.querySelector('[data-lire-texte]');

    moteur.cancel();
    var parts = morceaux(REPONSE);
    var rang = 0;
    enLecture = id;
    if (etiquette) etiquette.textContent = 'Arrêter';

    function dire() {
      if (enLecture !== id || rang >= parts.length) {
        if (etiquette) etiquette.textContent = 'Écouter la réponse';
        if (enLecture === id && mainsLibres) armer(id);
        enLecture = null;
        return;
      }
      var enonce = new SpeechSynthesisUtterance(parts[rang]);
      enonce.lang = 'fr-FR';
      rang += 1;
      enonce.onend = dire;
      enonce.onerror = function () {
        if (etiquette) etiquette.textContent = 'Écouter la réponse';
        enLecture = null;
      };
      moteur.speak(enonce);
    }
    dire();
  }

  document.addEventListener('click', function (ev) {
    var bouton = ev.target.closest('[data-lire]');
    if (!bouton) return;
    var id = bouton.getAttribute('data-lire').replace('reponse-', '');
    if (enLecture === id) {
      enLecture = null;
      synthese() && synthese().cancel();
      var et = bouton.querySelector('[data-lire-texte]');
      if (et) et.textContent = 'Écouter la réponse';
      return;
    }
    lire(id);
  });

  /* ------------------------------------------------------------ la dictée */

  var session = null;
  var boutonActif = null;

  function etatMicro(bouton, ecoute) {
    if (!bouton) return;
    bouton.classList.toggle('jur-micro-actif', ecoute);
    bouton.setAttribute('aria-pressed', ecoute ? 'true' : 'false');
    var t = bouton.querySelector('[data-micro-texte]');
    if (t) t.textContent = ecoute ? 'J’écoute…' : 'Dicter';
  }

  function armer(id) {
    var bouton = document.querySelector('[data-micro="q-' + id + '"]');
    if (bouton) demarrer(bouton);
  }

  function demarrer(bouton) {
    var Moteur = Micro();
    if (!Moteur) return;

    if (session) {
      session.onresult = null;
      session.onend = null;
      session.onerror = null;
      session.abort();
      session = null;
    }

    var champ = document.getElementById(bouton.getAttribute('data-micro'));
    if (!champ) return;

    var s = new Moteur();
    s.lang = 'fr-FR';
    s.continuous = true;
    s.interimResults = true;

    var acquis = '';
    var socle = null;

    s.onresult = function (ev) {
      var provisoire = '';
      for (var i = ev.resultIndex; i < ev.results.length; i += 1) {
        if (ev.results[i].isFinal) acquis += ev.results[i][0].transcript;
        else provisoire += ev.results[i][0].transcript;
      }
      if (socle === null) socle = champ.value.replace(/\\s+$/, '');
      var dicte = (acquis + provisoire).trim();
      champ.value = socle ? socle + ' ' + dicte : dicte;
    };

    s.onerror = function () { etatMicro(boutonActif, false); };
    s.onend = function () {
      session = null;
      etatMicro(boutonActif, false);
      boutonActif = null;
    };

    session = s;
    boutonActif = bouton;
    try {
      s.start();
      etatMicro(bouton, true);
    } catch (erreur) {
      /* Une session tourne déjà : le micro est ouvert, c'est ce qu'on voulait. */
    }
  }

  document.addEventListener('click', function (ev) {
    var bouton = ev.target.closest('[data-micro]');
    if (!bouton) return;
    if (session && boutonActif === bouton) { session.stop(); return; }
    demarrer(bouton);
  });

  /* Sans reconnaissance vocale — Firefox —, le bouton ne fait rien : on le
     retire plutôt que de le laisser mentir. */
  if (!Micro()) {
    document.querySelectorAll('[data-micro], .jur-micro-note').forEach(function (n) { n.remove(); });
  }
  if (!synthese()) {
    document.querySelectorAll('.jur-voix').forEach(function (n) { n.remove(); });
  }

  /* --------------------------------------------------------- mains libres */

  var bascule = document.getElementById('mains-libres');
  if (bascule && synthese() && Micro()) {
    bascule.addEventListener('click', function () {
      mainsLibres = !mainsLibres;
      bascule.classList.toggle('jur-bascule-active', mainsLibres);
      bascule.setAttribute('aria-checked', mainsLibres ? 'true' : 'false');
      var t = bascule.querySelector('[data-bascule-texte]');
      if (t) {
        t.textContent = mainsLibres
          ? 'La réponse est lue à voix haute, puis le micro s’ouvre. Vous relisez avant d’envoyer.'
          : 'La réponse se lit à voix haute et le micro s’ouvre tout seul : pour les mains prises.';
      }
      if (!mainsLibres && synthese()) synthese().cancel();
    });
  } else if (bascule) {
    bascule.closest('.jur-mains-libres').remove();
  }
})();
</script>
`;

mkdirSync(dirname(DEST), { recursive: true });
writeFileSync(DEST, page);
console.log(`${DEST} — ${Math.round(Buffer.byteLength(page) / 1024)} Ko`);
