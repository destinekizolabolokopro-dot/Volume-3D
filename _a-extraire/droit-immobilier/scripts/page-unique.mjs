/**
 * La page unique : `npm run page`.
 *
 * Un seul fichier HTML qui s'ouvre par double-clic, sans serveur, sans réseau,
 * sans installation. Le pendant de ce que le dépôt Volume3D fait pour ses
 * visites 3D.
 *
 * ── À quoi elle sert ────────────────────────────────────────────────────────
 * À montrer. Un site déployé demande une adresse, un hébergeur et une clé
 * d'API ; un fichier se met sur une clé USB, s'envoie par courriel, s'ouvre
 * dans un train sans réseau. C'est ce qu'on tend à un agent immobilier au
 * rendez-vous, ou ce qu'on joint à un dossier.
 *
 * ── Elle emprunte le balisage du site, pas seulement ses données ────────────
 * Première version, cette page avait sa propre mise en page : des sections
 * empilées, des cartes maison, une grille à moi. Résultat, elle était moins
 * dessinée que le produit qu'elle montrait — trames absentes, cartes sans
 * numéro, pas de bande sombre, et de grands vides entre les blocs. Elle
 * reprend maintenant les classes réelles : `jur-accueil` et sa trame de papier
 * millimétré, `jur-card` et ses numéros, `jur-bande`, `jur-limite`. Le site
 * change de dessin, la page change avec lui.
 *
 * ── Ce qu'elle contient, et d'où ça vient ───────────────────────────────────
 * Rien n'est réécrit pour l'occasion : les dix fiches viennent de
 * `lib/domaines.ts`, la copie de `lib/copie.ts`, les diagnostics de
 * `lib/diagnostics.ts`, les chiffres du corpus de `corpus/index.json`, et
 * l'échange donné en exemple cite des articles lus dans `corpus/*.json`. Si le
 * site change, cette page change avec lui — c'est tout l'intérêt de la
 * produire plutôt que de l'écrire.
 *
 * ── Ce qu'elle ne fait pas, et le dit ───────────────────────────────────────
 * Elle ne répond à aucune question : il n'y a pas de modèle derrière un
 * fichier. L'échange qu'elle montre est présenté comme enregistré, en toutes
 * lettres et à l'écran. Une démonstration qui laisse croire qu'elle répond en
 * direct est un mensonge qu'on découvre à la deuxième question, devant la
 * personne qu'on voulait convaincre.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DIAGNOSTICS } from '../lib/diagnostics.ts';
import { dateLisible, nombreLisible } from '../lib/nombres.ts';
import { DOMAINES } from '../lib/domaines.ts';
import { ACCUEIL, LIMITES, MARQUE, MENTION, ORIENTATION, PIED, RASSURANCE, SPECIALISTE } from '../lib/copie.ts';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(RACINE, 'standalone', 'droit-immobilier.html');

const lire = (chemin) => readFileSync(join(RACINE, chemin), 'utf8');
const lireJson = (chemin) => JSON.parse(lire(chemin));

/** Le texte traverse le HTML comme du texte, jamais comme du balisage. */
function e(valeur) {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const liste = (items, classe = '') =>
  `<ul${classe ? ` class="${classe}"` : ''}>${items.map((i) => `<li>${e(i)}</li>`).join('')}</ul>`;

/* ============================================================== l'exemple === */

/**
 * L'échange montré en exemple.
 *
 * La question et la réponse sont écrites ici — c'est une démonstration, elle
 * est assumée comme telle. Les ARTICLES, eux, sont lus dans le corpus : leur
 * numéro, leur place dans le plan et leur texte sortent du fonds LEGI, pas
 * d'ici. Montrer une citation inventée pour vanter un produit dont l'argument
 * est de ne pas en inventer serait difficile à défendre.
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
  /** Les articles à citer, par numéro. Leur texte est lu dans le corpus. */
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
    /* Le premier alinéa suffit : une citation qui dépasse quelques lignes
       cesse d'être une preuve et redevient un paragraphe. */
    const extrait = article.texte.split('\n')[0].slice(0, 340);
    return {
      source: document.nom,
      article: /^(article|annexe)/i.test(article.num) ? article.num : `Article ${article.num}`,
      chemin: article.chemin.join(' › '),
      extrait: extrait.length < article.texte.length ? `${extrait.trimEnd()}…` : extrait,
    };
  });
}

/* ================================================================== le rendu === */

function fiche(domaine) {
  const bloc = (titre, items, classe = '') =>
    `<section class="jur-bloc${classe ? ` ${classe}` : ''}"><h3>${e(titre)}</h3>${liste(items)}</section>`;

  const renvois = domaine.renvois.map(
    (r) => `${r.quand} — ${DOMAINES.find((d) => d.id === r.vers)?.label ?? r.vers}`,
  );

  return `
<main class="jur-page fiche" id="fiche-${e(domaine.id)}" hidden>
  <button class="jur-retour" data-retour>← Toutes les spécialités</button>
  <h1 class="jur-h1">${e(domaine.label)}</h1>
  <p class="jur-lede">${e(domaine.resume)}</p>

  <section class="jur-bloc jur-delais">
    <h3>Délais à ne pas manquer</h3>
    ${liste(domaine.delais)}
    <p class="hint">${e(SPECIALISTE.delaisNote)}</p>
  </section>

  <div class="fiche-colonnes">
    ${bloc('À vérifier avant d’agir', domaine.verifications)}
    ${bloc('Ce que ce spécialiste traite', domaine.matieres)}
    ${bloc('Ce qui relève d’un autre', renvois)}
    ${bloc('Textes de référence', domaine.sources)}
  </div>

  ${domaine.exemples?.length ? bloc('Des questions qu’on lui pose', domaine.exemples) : ''}
</main>`;
}

function construire() {
  const index = lireJson('corpus/index.json');
  const totalArticles = index.domaines.reduce((n, d) => n + d.articles, 0);
  const parDomaine = Object.fromEntries(index.domaines.map((d) => [d.domaine, d.articles]));
  const citations = citationsReelles();

  const police = readFileSync(join(RACINE, 'public/fonts/inter-400-latin.woff2')).toString('base64');
  const socle = lire('app/socle.css');
  const feuille = lire('app/assistant.css');

  /* Les cartes du site : un lien, un titre, un résumé. Le numéro vient de la
     feuille (`.jur-card::before`), pas d'ici — c'est lui qui transforme dix
     cartes en sommaire plutôt qu'en liste. */
  const cartes = DOMAINES.map((d) => `
      <a class="jur-card" href="#${e(d.id)}" data-ouvre="${e(d.id)}">
        <h3>${e(d.label)}</h3>
        <p>${e(d.resume)}</p>
        <span class="carte-corpus">${parDomaine[d.id] ?? 0} articles joints</span>
      </a>`).join('');

  /* Quatre exemples pris dans quatre spécialités différentes, comme sur le
     site : ils montrent l'étendue du périmètre en même temps que le niveau de
     précision utile. Le dernier vient du métier — c'est le seul moyen qu'un
     agent comprenne que sa propre réglementation est traitée ici. */
  const exemples = ['bail-habitation', 'courte-duree', 'travaux', 'profession']
    .map((id) => DOMAINES.find((d) => d.id === id)?.exemples?.[0])
    .filter(Boolean)
    .map((x) => `<span class="jur-chip jur-chip-fige">${e(x)}</span>`)
    .join('');

  const reponse = EXEMPLE.reponse.map(([type, valeur]) =>
    type === 'titre' ? `<p class="jur-intertitre">${e(valeur)}</p>`
    : type === 'liste' ? liste(valeur, 'jur-liste')
    : `<p>${e(valeur)}</p>`).join('');

  const sources = citations.map((c) => `
          <li>
            <p class="jur-source-titre">${e(c.article)}<span class="jur-source-texte"> — ${e(c.source)}</span></p>
            <p class="jur-source-chemin">${e(c.chemin)}</p>
            <blockquote>${e(c.extrait)}</blockquote>
          </li>`).join('');

  const chiffres = [
    [DOMAINES.length, 'spécialités'],
    [nombreLisible(totalArticles), 'articles en vigueur, joints aux réponses'],
    [index.quotidiennes, 'mises à jour du fonds appliquées'],
    [DIAGNOSTICS.length, 'diagnostics et leurs durées'],
  ].map(([n, l]) => `<div class="chiffre"><strong>${e(n)}</strong><span>${e(l)}</span></div>`).join('');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(MARQUE.nom)} — dix spécialités du droit immobilier</title>
<meta name="description" content="${e(ACCUEIL.lede.slice(0, 155))}">
<style>
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(data:font/woff2;base64,${police}) format('woff2');
}
${socle}
${feuille}

/* =========================================================================
   Propre à la page unique.

   Tout ce qui précède vient du site, sans retouche. Ce qui suit ne concerne
   que ce fichier : il n'a ni serveur, ni navigation, ni champ à remplir, et
   il porte deux choses que le site n'a pas — les chiffres du corpus et un
   échange donné en exemple.
   ========================================================================= */

/* Les exemples ont leur propre section : la marge basse prévue pour les
   séparer du reste s'ajouterait à celle de la section suivante, et deux
   espacements empilés font un trou. */
.jur-suggestions-accueil {
  margin-bottom: 0;
}

/* Les puces d'exemples ne sont pas cliquables ici : elles montrent le niveau
   de précision utile, elles ne lancent rien. Elles perdent donc l'affordance
   du bouton — un curseur en main sur ce qui ne réagit pas est une promesse
   qu'on ne tient pas. */
.jur-chip-fige {
  cursor: default;
}

.jur-chip-fige:hover {
  border-color: var(--line);
  background: #fff;
  color: inherit;
}

/* Les chiffres du corpus : l'argument central de ce produit, donc le seul
   endroit de la page où l'on parle en grand. */
.chiffres {
  display: grid;
  /* Deux, puis quatre. Jamais trois : auto-fit en donnait trois et laissait
     le quatrième chiffre seul sur une ligne, ce qui ouvre un trou au milieu de
     la page et fait passer une rangée de chiffres pour un accident. */
  grid-template-columns: repeat(2, 1fr);
  gap: calc(var(--pas) * 3.5) calc(var(--pas) * 3);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: calc(var(--pas) * 3.5) 0;
}

@media (min-width: 760px) {
  .chiffres {
    grid-template-columns: repeat(4, 1fr);
  }
}

.chiffre strong {
  display: block;
  font-size: 34px;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ink-strong);
  font-variant-numeric: tabular-nums;
  margin-bottom: calc(var(--pas) * 1);
}

.chiffre span {
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--ink-soft);
  display: block;
  max-width: 26ch;
}

/* L'échange en exemple. L'étiquette est posée SUR le fil et non à côté :
   quelqu'un qui fait défiler doit rencontrer l'avertissement avant la
   réponse, pas après. */
.exemple {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--bg-alt);
}

.exemple-etiquette {
  display: flex;
  align-items: center;
  gap: calc(var(--pas) * 1.25);
  padding: calc(var(--pas) * 1.5) calc(var(--pas) * 2.5);
  background: var(--dark);
  color: var(--ink-on-dark-soft);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.exemple-etiquette::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-on-dark);
  flex: none;
}

.exemple .jur-fil {
  padding: calc(var(--pas) * 3) calc(var(--pas) * 3) calc(var(--pas) * 2);
}

.exemple .hint {
  margin: 0;
  padding: 0 calc(var(--pas) * 3) calc(var(--pas) * 3);
  max-width: 78ch;
}

/* Le nombre d'articles joints, en pied de carte : c'est ce qui distingue une
   fiche de spécialité d'un simple intitulé. */
.carte-corpus {
  margin-top: auto;
  padding-top: calc(var(--pas) * 1.5);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.jur-card:hover .carte-corpus {
  color: var(--accent);
}

/* La fiche : les blocs du site, en deux colonnes dès qu'il y a la place. */
.fiche-colonnes {
  display: grid;
  gap: calc(var(--pas) * 2);
  margin-top: calc(var(--pas) * 2);
}

@media (min-width: 820px) {
  .fiche-colonnes {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}

.jur-retour {
  background: none;
  border: 0;
  font: inherit;
  font-size: 14px;
  color: var(--accent);
  cursor: pointer;
  padding: 0;
  margin: 0 0 calc(var(--pas) * 3);
}

.jur-retour:hover {
  color: var(--accent-strong);
  text-decoration: underline;
}

.fiche .jur-bloc h3 {
  margin-top: 0;
}
</style>
</head>
<body>
<div class="jur">

<header class="jur-bar">
  <span class="jur-bar-brand">${e(MARQUE.nom)}<small>${e(MARQUE.accroche)}</small></span>
  <span class="jur-bar-link" style="margin-left:auto">Fichier de démonstration</span>
</header>

<main class="jur-page jur-accueil" id="accueil">
  <div class="jur-haut">
    <div class="jur-haut-colonne">
      <p class="jur-oeil">${e(ACCUEIL.oeil)}</p>
      <h1 class="jur-h1">${ACCUEIL.titreLignes.map((l) => `<span>${e(l)}</span>`).join('')}</h1>
      <p class="jur-lede">${e(ACCUEIL.lede)}</p>
      <div class="chiffres">${chiffres}</div>
    </div>

    <aside class="jur-preuve-carte">
      <p class="jur-oeil">${e(RASSURANCE.oeil)}</p>
      <ul>${RASSURANCE.points.map((pt) => `<li>${e(pt)}</li>`).join('')}</ul>
      <p class="jur-preuve-arrete">${e(RASSURANCE.pied)} <strong>${e(dateLisible(index.arrete))}</strong></p>
    </aside>
  </div>

  <section class="jur-section jur-vitrine">
    <h2 class="jur-h2">Ce qu’une réponse donne</h2>
    <p class="jur-sub">Le délai d’abord, puis la règle, puis ce qu’il y a à faire — et les articles sur lesquels tout cela s’appuie, cités à la fin.</p>

    <div class="exemple">
      <p class="exemple-etiquette">Échange enregistré · ce fichier ne répond pas</p>
      <div class="jur-fil">
        <div class="jur-tour jur-de-vous"><p>${e(EXEMPLE.question)}</p></div>
        <div class="jur-tour jur-de-lui">
          ${reponse}
          <details class="jur-sources" open>
            <summary>Les ${citations.length} textes cités</summary>
            <ul>${sources}</ul>
          </details>
        </div>
      </div>
      <p class="hint">${e(SPECIALISTE.avertissement)}</p>
    </div>
  </section>

  <section class="jur-section jur-vitrine">
    <h2 class="jur-h2">Des questions qu’on lui pose</h2>
    <p class="jur-sub">Prises dans quatre spécialités différentes. Elles montrent l’étendue du périmètre autant que le niveau de précision utile.</p>
    <div class="jur-suggestions jur-suggestions-accueil">${exemples}</div>
  </section>

  <section class="jur-section jur-vitrine">
    <h2 class="jur-h2">${e(ACCUEIL.grilleTitre)}</h2>
    <p class="jur-sub">${e(ACCUEIL.grilleSous)}</p>
    <div class="jur-grid">${cartes}</div>
  </section>

  <section class="jur-section jur-vitrine-aplat jur-bande">
    <p class="jur-oeil">Ce qu’il faut savoir</p>
    <h2>${e(ACCUEIL.limitesTitre)}</h2>
    <p class="jur-bande-sous">${e(ACCUEIL.limitesSous)}</p>
    <div class="jur-limites">
      ${LIMITES.map((l) => `<div class="jur-limite"><p><strong>${e(l.amorce)}</strong> ${e(l.suite)}</p></div>`).join('')}
    </div>
  </section>
</main>

<div id="fiches">${DOMAINES.map(fiche).join('')}</div>

<footer class="jur-pied">
  <div class="jur-pied-corps">
    <div class="jur-pied-marque">
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
</footer>

</div>

<script>
/* Toute la navigation de ce fichier : montrer une fiche, revenir. Il n'y a
   rien d'autre à faire ici — pas de réseau, pas de compte, pas de modèle. */
(function () {
  var accueil = document.getElementById('accueil');
  var fiches = document.getElementById('fiches');

  function montrer(id) {
    accueil.hidden = Boolean(id);
    Array.prototype.forEach.call(fiches.children, function (f) {
      f.hidden = f.id !== 'fiche-' + id;
    });
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (ev) {
    var ouvre = ev.target.closest('[data-ouvre]');
    if (ouvre) { ev.preventDefault(); location.hash = ouvre.getAttribute('data-ouvre'); return; }
    if (ev.target.closest('[data-retour]')) { ev.preventDefault(); location.hash = ''; }
  });

  window.addEventListener('hashchange', function () { montrer(location.hash.slice(1)); });
  if (location.hash) montrer(location.hash.slice(1));
})();
</script>
</body>
</html>
`;
}

mkdirSync(join(RACINE, 'standalone'), { recursive: true });
const html = construire();
writeFileSync(DEST, html);
console.log(`${DEST} — ${(Buffer.byteLength(html) / 1024).toFixed(0)} Ko`);
