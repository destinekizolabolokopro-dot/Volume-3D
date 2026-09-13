/**
 * L'aide-mémoire hors ligne : `npm run artefact`.
 *
 * Une page unique, publiée comme artefact, qu'on ouvre sur une tablette en
 * visite ou en rendez-vous. Elle ne répond à aucune question — il n'y a pas de
 * modèle derrière une page — et elle le dit. Ce qu'elle porte est tout ce que
 * ce service sait SANS modèle : les délais qui ne se rattrapent pas, ce qu'il
 * faut vérifier avant d'agir, les diagnostics et leurs durées, et les
 * dix-sept courriers avec les mentions sans lesquelles ils sont nuls.
 *
 * ── Rien n'est réécrit pour l'occasion ─────────────────────────────────────
 * Les dix fiches viennent de lib/domaines.ts, les diagnostics de
 * lib/diagnostics.ts, les courriers de lib/documents.ts, les chiffres du fonds
 * de corpus/index.json, la copie de lib/copie.ts. Le site change, cette page
 * change avec lui — c'est tout l'intérêt de la produire plutôt que de
 * l'écrire.
 *
 * ── Pourquoi elle n'a pas le dessin du site ────────────────────────────────
 * Le site est une vitrine qu'on lit ; ceci est un outil qu'on manipule, à bout
 * de bras, souvent debout. D'où les deux différences assumées : un champ de
 * recherche qui filtre TOUT en tête de page, et des blocs dépliables plutôt
 * qu'une lecture continue. Le marine de la marque et les neutres chauds sont
 * les mêmes ; le reste sert la main, pas l'œil.
 *
 * ── La forme attendue par un artefact ──────────────────────────────────────
 * Pas de <!doctype>, pas de <html>, pas de <head>, pas de <body> : la page est
 * enveloppée à la publication. On écrit le <title>, le <style>, puis le corps.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CALENDRIER_ENERGIE, DIAGNOSTICS } from '../lib/diagnostics.ts';
import { DOMAINES } from '../lib/domaines.ts';
import { FAMILLES, MODELES } from '../lib/documents.ts';
import { MARQUE, MENTION, PIED } from '../lib/copie.ts';
import { dateLisible, nombreLisible } from '../lib/nombres.ts';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(RACINE, 'standalone', 'immolex-artefact.html');

const e = (v) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const index = JSON.parse(readFileSync(join(RACINE, 'corpus', 'index.json'), 'utf8'));
const articles = index.domaines.reduce((n, d) => n + d.articles, 0);

/* Le mot qu'on cherchera : tout le texte d'un bloc, sans accents ni casse. */
const cle = (...morceaux) =>
  morceaux
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const liste = (items, classe = '') =>
  `<ul class="${classe}">${items.map((i) => `<li>${e(i)}</li>`).join('')}</ul>`;

/* ------------------------------------------------------------- les délais --- */

/* Tous les délais des dix spécialités, rassemblés. C'est l'écran qui sert le
   plus : un délai manqué ne se rattrape pas, et personne ne va chercher fiche
   par fiche quand le téléphone sonne. */
const tousLesDelais = DOMAINES.flatMap((d) =>
  d.delais.map((texte) => ({ texte, ou: d.label, id: d.id })),
);

/* Le nom de la spécialité n'est écrit qu'au CHANGEMENT. Répété devant chacun
   des cinq délais du bail d'habitation, il se lisait comme du bruit et volait
   la place du délai lui-même — qui est la seule chose à lire ici. */
const delais = tousLesDelais
  .map(({ texte, ou, id }, rang) => {
    const nouveau = rang === 0 || tousLesDelais[rang - 1].ou !== ou;
    return `
      <li class="delai${nouveau ? ' delai-debut' : ''}" data-cherche="${e(cle(texte, ou))}">
        ${nouveau ? `<a class="delai-ou" href="#f-${e(id)}">${e(ou)}</a>` : ''}
        <p>${e(texte)}</p>
      </li>`;
  })
  .join('');

/* ---------------------------------------------------------- les dix fiches --- */

const fiches = DOMAINES.map((d) => {
  const renvois = d.renvois
    .map((r) => {
      const vers = DOMAINES.find((x) => x.id === r.vers);
      return `<li>${e(r.quand)} — <a href="#f-${e(r.vers)}">${e(vers ? vers.label : r.vers)}</a></li>`;
    })
    .join('');

  return `
    <details class="fiche" id="f-${e(d.id)}" data-cherche="${e(
      cle(d.label, d.resume, d.matieres.join(' '), d.delais.join(' '), d.verifications.join(' '), d.sources.join(' ')),
    )}">
      <summary>
        <span class="fiche-nom">${e(d.label)}</span>
        <span class="fiche-resume">${e(d.resume)}</span>
      </summary>

      <div class="fiche-corps">
        <section class="bloc bloc-delai">
          <h3>Délais à ne pas manquer</h3>
          ${liste(d.delais)}
        </section>

        <section class="bloc">
          <h3>À vérifier avant d’agir</h3>
          ${liste(d.verifications)}
        </section>

        <section class="bloc">
          <h3>Ce que ce spécialiste traite</h3>
          ${liste(d.matieres)}
        </section>

        <section class="bloc">
          <h3>Ce qui relève d’un autre</h3>
          <ul class="renvois">${renvois}</ul>
        </section>

        <section class="bloc">
          <h3>Textes de référence</h3>
          ${liste(d.sources)}
        </section>
      </div>
    </details>`;
}).join('');

/* --------------------------------------------------------- les diagnostics --- */

const diagnostics = DIAGNOSTICS.map(
  (dg) => `
    <tr data-cherche="${e(cle(dg.nom, dg.quand, dg.validite))}">
      <th scope="row">${e(dg.nom)}</th>
      <td>${e(dg.quand)}</td>
      <td class="validite">${e(dg.validite)}</td>
    </tr>`,
).join('');

/* ------------------------------------------------------------ les courriers --- */

const courriers = FAMILLES.map((famille) => {
  const modeles = MODELES.filter((m) => m.famille === famille.id)
    .map(
      (m) => `
      <details class="courrier" data-cherche="${e(
        cle(m.titre, m.resume, m.pourQui, m.mentions.join(' '), m.pieges.join(' '), m.envoi, m.delai ?? ''),
      )}">
        <summary>
          <span class="courrier-nom">${e(m.titre)}</span>
          <span class="courrier-resume">${e(m.resume)}</span>
          ${m.delai ? `<span class="puce-delai">${e(m.delai)}</span>` : ''}
        </summary>

        <div class="courrier-corps">
          <p class="pour-qui">${e(m.pourQui)}</p>

          <section class="bloc">
            <h4>Ce qui doit y figurer</h4>
            ${liste(m.mentions)}
          </section>

          <section class="bloc bloc-piege">
            <h4>Ce qui l’annule</h4>
            ${liste(m.pieges)}
          </section>

          <section class="bloc">
            <h4>Comment l’envoyer</h4>
            <p>${e(m.envoi)}</p>
          </section>
        </div>
      </details>`,
    )
    .join('');

  return `
    <div class="famille" data-cherche="${e(cle(famille.label, famille.resume))}">
      <h3 class="famille-nom">${e(famille.label)}</h3>
      <p class="famille-resume">${e(famille.resume)}</p>
      <div class="courriers">${modeles}</div>
    </div>`;
}).join('');

/* =========================================================== la page === */

const page = `<title>${e(MARQUE.nom)}</title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Spectral:wght@500;600&display=swap">

<style>
/* ── Les jetons ───────────────────────────────────────────────────────────
   Neutres CHAUDS et marine profond : ceux du produit, pas ceux d'un tableur.
   Le thème sombre les redéfinit tous, et rien n'est défini ailleurs qu'ici —
   une couleur qui n'existe que derrière un [data-theme] ne s'applique jamais
   à qui laisse son système décider. */
:root {
  --papier: #fffdfa;
  --papier-2: #f5f1ea;
  --papier-3: #ebe5da;
  --trait: #ddd5c7;
  --trait-fort: #b9ae9b;
  --encre: #211d18;
  --encre-2: #5d554a;
  --encre-3: #7d7466;
  --marine: #173d73;
  --marine-fort: #102b52;
  --marine-lavis: #e7edf7;
  --ambre: #7d4e0d;
  --ambre-lavis: #f8efdf;
  --sang: #9d3427;
  --sang-lavis: #fbeeeb;
  --ombre: 0 1px 2px rgba(33, 29, 24, 0.04), 0 12px 28px -18px rgba(33, 29, 24, 0.2);

  --sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --serif: 'Spectral', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
}

:root:not([data-theme='light']) {
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;
    --papier: #15181d;
    --papier-2: #1b1f26;
    --papier-3: #222832;
    --trait: #313845;
    --trait-fort: #4a5464;
    --encre: #e9ecf1;
    --encre-2: #aab4c2;
    --encre-3: #8d98a8;
    --marine: #8ab0e6;
    --marine-fort: #aecbf3;
    --marine-lavis: #1c2941;
    --ambre: #e0b878;
    --ambre-lavis: #2b2317;
    --sang: #f09480;
    --sang-lavis: #2e1d1a;
    --ombre: 0 1px 2px rgba(0, 0, 0, 0.3), 0 12px 28px -18px rgba(0, 0, 0, 0.6);
  }
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --papier: #15181d;
  --papier-2: #1b1f26;
  --papier-3: #222832;
  --trait: #313845;
  --trait-fort: #4a5464;
  --encre: #e9ecf1;
  --encre-2: #aab4c2;
  --encre-3: #8d98a8;
  --marine: #8ab0e6;
  --marine-fort: #aecbf3;
  --marine-lavis: #1c2941;
  --ambre: #e0b878;
  --ambre-lavis: #2b2317;
  --sang: #f09480;
  --sang-lavis: #2e1d1a;
  --ombre: 0 1px 2px rgba(0, 0, 0, 0.3), 0 12px 28px -18px rgba(0, 0, 0, 0.6);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--papier);
  color: var(--encre);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
}

/* ── La barre, collée en haut ─────────────────────────────────────────────
   Elle porte le nom et le champ de recherche, et rien d'autre. Sur une
   tablette tenue d'une main, c'est la seule chose qui doit rester joignable. */
.barre {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--papier);
  border-bottom: 1px solid var(--trait);
  padding: 12px max(16px, calc(50vw - 480px));
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}

.marque {
  font-family: var(--serif);
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--encre);
  flex: none;
}

.marque span {
  font-family: var(--sans);
  font-size: 12.5px;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--encre-3);
  margin-left: 8px;
}

.recherche {
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--papier-2);
  border: 1px solid var(--trait);
  border-radius: 999px;
  padding: 0 14px;
}

.recherche svg { flex: none; color: var(--encre-3); }

.recherche input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 16px;
  color: var(--encre);
  /* 44 px : la cible qu'un doigt atteint sans viser. */
  padding: 11px 0;
  outline: none;
}

.recherche input::placeholder { color: var(--encre-3); }

.recherche:focus-within {
  border-color: var(--marine);
  box-shadow: 0 0 0 3px var(--marine-lavis);
}

.vider {
  flex: none;
  border: 0;
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--encre-2);
  cursor: pointer;
  padding: 6px 2px;
}

.vider[hidden] { display: none; }

/* ── Le corps ─────────────────────────────────────────────────────────── */

.page {
  max-width: 960px;
  margin: 0 auto;
  padding-inline: 16px;
  padding-block: 0 64px;
}

.intro {
  padding-block: 36px 8px;
  border-bottom: 1px solid var(--trait);
  margin-bottom: 36px;
}

h1 {
  font-family: var(--serif);
  font-size: clamp(28px, 4.2vw, 40px);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.02em;
  margin: 0 0 12px;
  text-wrap: balance;
  max-width: 20ch;
}

.lede {
  margin: 0 0 24px;
  font-size: 16.5px;
  line-height: 1.6;
  color: var(--encre-2);
  max-width: 62ch;
  text-wrap: pretty;
}

/* Le fonds, en chiffres. Ils viennent de l'index du corpus : le jour où une
   spécialité gagne un texte, cette ligne le dit sans qu'on y pense. */
.fonds {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  margin: 0 0 28px;
  padding: 0;
  list-style: none;
  font-size: 13.5px;
  color: var(--encre-2);
}

.fonds b {
  color: var(--marine);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.avis {
  background: var(--papier-2);
  border: 1px solid var(--trait);
  border-left: 3px solid var(--trait-fort);
  border-radius: 4px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--encre-2);
  margin: 0 0 8px;
  max-width: 72ch;
}

.avis b { color: var(--encre); font-weight: 600; }

section.zone { margin-top: 52px; scroll-margin-top: 80px; }

.oeil {
  display: block;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--encre-3);
  margin: 0 0 8px;
}

h2 {
  font-family: var(--serif);
  font-size: clamp(22px, 2.8vw, 29px);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.015em;
  margin: 0 0 10px;
  text-wrap: balance;
}

.sous {
  margin: 0 0 24px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--encre-2);
  max-width: 62ch;
  text-wrap: pretty;
}

/* ── Les délais ───────────────────────────────────────────────────────────
   Le seul endroit de la page qui élève la voix, et il le mérite : un délai
   manqué ne se rattrape pas. Filet ambre à gauche, rien d'autre — un fond
   plein sur trente entrées ferait un mur. */
.delais { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; }

.delai {
  border-left: 3px solid var(--ambre);
  background: var(--ambre-lavis);
  padding: 11px 16px;
}

/* Un peu d'air et un filet au changement de spécialité : les délais d'un même
   métier se lisent en bloc, et l'œil sait où commence le suivant. */
.delai-debut {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--trait);
}

.delais .delai:first-child { margin-top: 0; border-top: 0; }

.delai-ou {
  display: inline-block;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ambre);
  text-decoration: none;
  margin-bottom: 4px;
}

.delai-ou:hover { text-decoration: underline; }

.delai p { margin: 0; font-size: 14.5px; line-height: 1.55; max-width: 78ch; }

/* ── Les fiches et les courriers ─────────────────────────────────────────
   Dépliables : sur une tablette, dix fiches déroulées font quatre mètres de
   défilement, et on cherche une chose à la fois. */
.fiche,
.courrier {
  border: 1px solid var(--trait);
  border-radius: 8px;
  background: var(--papier);
  margin-bottom: 8px;
  overflow: hidden;
}

.fiche[open],
.courrier[open] { box-shadow: var(--ombre); }

summary {
  list-style: none;
  cursor: pointer;
  padding: 15px 18px;
  display: grid;
  gap: 3px;
  /* 48 px de haut au minimum : c'est une cible tactile, pas un lien. */
  min-height: 48px;
  align-content: center;
}

summary::-webkit-details-marker { display: none; }

summary:hover { background: var(--papier-2); }

summary:focus-visible {
  outline: 2px solid var(--marine);
  outline-offset: -2px;
}

.fiche-nom,
.courrier-nom {
  font-size: 16.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--encre);
}

.fiche[open] .fiche-nom,
.courrier[open] .courrier-nom { color: var(--marine); }

.fiche-resume,
.courrier-resume { font-size: 13.5px; line-height: 1.45; color: var(--encre-2); }

.puce-delai {
  justify-self: start;
  margin-top: 4px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--ambre);
  background: var(--ambre-lavis);
  border-radius: 999px;
  padding: 3px 10px;
}

.fiche-corps,
.courrier-corps {
  padding: 4px 18px 20px;
  border-top: 1px solid var(--trait);
  display: grid;
  gap: 22px;
}

.bloc h3,
.bloc h4 {
  margin: 0 0 10px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--encre-3);
}

.bloc ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 9px; }

.bloc li {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--encre-2);
  padding-left: 15px;
  position: relative;
  max-width: 80ch;
}

.bloc li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.62em;
  width: 7px;
  height: 1px;
  background: var(--trait-fort);
}

.bloc p { margin: 0; font-size: 14.5px; line-height: 1.55; color: var(--encre-2); max-width: 80ch; }

/* Les délais dans une fiche gardent leur ambre : même information, même
   couleur, où qu'elle soit. */
.bloc-delai h3 { color: var(--ambre); }
.bloc-delai li::before { background: var(--ambre); width: 9px; height: 2px; }

.bloc-piege h4 { color: var(--sang); }
.bloc-piege li::before { background: var(--sang); width: 9px; height: 2px; }

.renvois li { padding-left: 15px; }
.renvois a { color: var(--marine); }

a { color: var(--marine); }

.pour-qui {
  margin: 0;
  font-size: 14px;
  color: var(--encre-3);
  font-style: italic;
}

.famille { margin-bottom: 32px; }

.famille-nom {
  font-family: var(--serif);
  font-size: 19px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--encre);
  letter-spacing: -0.01em;
}

.famille-resume { margin: 0 0 14px; font-size: 14px; color: var(--encre-2); }

/* ── Le tableau des diagnostics ─────────────────────────────────────────── */

.tableau {
  overflow-x: auto;
  border: 1px solid var(--trait);
  border-radius: 8px;
  background: var(--papier);
}

table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 620px; }

thead th {
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--encre-3);
  padding: 12px 16px;
  border-bottom: 1px solid var(--trait);
  background: var(--papier-2);
}

tbody th {
  text-align: left;
  font-weight: 600;
  color: var(--encre);
  padding: 13px 16px;
  vertical-align: top;
  width: 30%;
}

tbody td { padding: 13px 16px; color: var(--encre-2); vertical-align: top; line-height: 1.5; }

tbody tr + tr th,
tbody tr + tr td { border-top: 1px solid var(--trait); }

.validite { color: var(--encre); font-variant-numeric: tabular-nums; }

.calendrier { margin: 22px 0 0; padding: 0; list-style: none; display: grid; gap: 9px; }

.calendrier li {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--encre-2);
  padding-left: 15px;
  position: relative;
}

.calendrier li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.62em;
  width: 9px;
  height: 2px;
  background: var(--marine);
}

/* ── Ce que la recherche ne trouve pas ─────────────────────────────────── */

.rien {
  margin-top: 40px;
  padding: 28px 20px;
  border: 1px dashed var(--trait-fort);
  border-radius: 8px;
  text-align: center;
  color: var(--encre-2);
  font-size: 15px;
}

.rien[hidden] { display: none; }

[hidden] { display: none !important; }

/* ── Le pied ─────────────────────────────────────────────────────────── */

footer {
  margin-top: 64px;
  border-top: 1px solid var(--trait);
  padding-top: 28px;
  display: grid;
  gap: 20px;
}

footer h3 {
  margin: 0 0 6px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--encre-3);
}

footer p { margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--encre-2); max-width: 80ch; }

footer .mention b { color: var(--encre); font-weight: 600; }

.provenance { color: var(--encre-3); font-size: 12.5px; }

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
</style>

<header class="barre">
  <div class="marque">${e(MARQUE.nom)}<span>aide-mémoire hors ligne</span></div>

  <label class="recherche">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5"></circle>
      <path d="M10.5 10.5L14 14" stroke-linecap="round"></path>
    </svg>
    <span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Chercher</span>
    <input id="q" type="search" placeholder="amiante, congé, dépôt de garantie, syndic…" autocomplete="off" spellcheck="false">
    <button class="vider" id="vider" type="button" hidden>Effacer</button>
  </label>
</header>

<main class="page">
  <div class="intro">
    <h1>Ce qu’il ne faut pas rater, quand on ne peut pas vérifier</h1>
    <p class="lede">
      Les délais qui ne se rattrapent pas, ce qu’il faut réunir avant d’agir, les diagnostics et
      leurs durées, et les dix-sept courriers avec les mentions sans lesquelles ils sont nuls.
      Tout tient dans cette page, et elle fonctionne sans réseau.
    </p>

    <ul class="fonds">
      <li><b>${e(DOMAINES.length)}</b> spécialités</li>
      <li><b>${e(index.textes)}</b> textes officiels</li>
      <li><b>${e(nombreLisible(articles))}</b> articles au fonds</li>
      <li>arrêté au <b>${e(dateLisible(index.arrete))}</b></li>
    </ul>

    <p class="avis">
      <b>Cette page ne répond à aucune question.</b> Il n’y a pas de modèle derrière un fichier :
      elle ne contient que ce que ${e(MARQUE.nom)} sait sans en consulter un — des délais, des
      listes, des mentions obligatoires. Pour poser une question et recevoir une réponse qui cite
      l’article, il faut le site.
    </p>
  </div>

  <section class="zone" id="delais">
    <span class="oeil">Le plus urgent</span>
    <h2>Les délais qui ne se rattrapent pas</h2>
    <p class="sous">
      ${e(tousLesDelais.length)} délais, rassemblés des dix spécialités. Un congé tardif d’un seul
      jour ne vaut rien ; une révision de loyer oubliée est perdue pour l’année. C’est la seule
      partie de ce métier où le retard ne se corrige pas.
    </p>
    <ul class="delais">${delais}</ul>
  </section>

  <section class="zone" id="fiches">
    <span class="oeil">Par spécialité</span>
    <h2>Les dix périmètres</h2>
    <p class="sous">
      Ce que chacun traite, ce qu’il ne traite pas, ce qu’il faut avoir en main avant d’agir, et
      les textes sur lesquels il s’appuie.
    </p>
    ${fiches}
  </section>

  <section class="zone" id="diagnostics">
    <span class="oeil">Le dossier technique</span>
    <h2>Diagnostics et durées de validité</h2>
    <p class="sous">
      Le rapport porte sa propre date de réalisation et de fin de validité : c’est elle qui fait
      foi. Ce tableau dit ce qu’il faut et quand le chercher.
    </p>
    <div class="tableau">
      <table>
        <thead>
          <tr><th scope="col">Diagnostic</th><th scope="col">Quand il est exigé</th><th scope="col">Validité</th></tr>
        </thead>
        <tbody>${diagnostics}</tbody>
      </table>
    </div>
    <ul class="calendrier">${CALENDRIER_ENERGIE.map((l) => `<li>${e(l)}</li>`).join('')}</ul>
  </section>

  <section class="zone" id="courriers">
    <span class="oeil">Avant d’envoyer</span>
    <h2>Dix-sept courriers, et ce qui les annule</h2>
    <p class="sous">
      Un congé pour vente auquel il manque le prix est nul, et ce n’est pas rattrapable : le délai
      a couru. Pour chacun, ce qui doit y figurer, ce qui l’annule, et comment l’envoyer pour que
      l’envoi se prouve.
    </p>
    ${courriers}
  </section>

  <p class="rien" id="rien" hidden>Rien ne correspond à cette recherche.</p>

  <footer>
    <div>
      <h3>Ce que ce service n’est pas</h3>
      <p class="mention"><b>${e(MENTION.court)}</b> ${e(MENTION.long)}</p>
    </div>
    <div>
      <h3>${e(PIED.recoursTitre)}</h3>
      <p>${e(PIED.recours)}</p>
    </div>
    <p class="provenance">
      Délais, aide-mémoire et courriers tirés du catalogue de ${e(MARQUE.nom)}. Les chiffres du
      fonds viennent de l’index du corpus LEGI, arrêté au ${e(dateLisible(index.arrete))} après
      ${e(index.quotidiennes)} mises à jour quotidiennes.
    </p>
  </footer>
</main>

<script>
(function () {
  var champ = document.getElementById('q');
  var vider = document.getElementById('vider');
  var rien = document.getElementById('rien');
  var zones = Array.prototype.slice.call(document.querySelectorAll('.zone'));
  var cherchables = Array.prototype.slice.call(document.querySelectorAll('[data-cherche]'));

  function sansAccents(texte) {
    return texte.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
  }

  function filtrer() {
    var mot = sansAccents(champ.value);
    vider.hidden = mot === '';

    if (!mot) {
      cherchables.forEach(function (bloc) {
        bloc.hidden = false;
        if (bloc.tagName === 'DETAILS') bloc.open = false;
      });
      zones.forEach(function (zone) { zone.hidden = false; });
      rien.hidden = true;
      return;
    }

    var trouves = 0;
    cherchables.forEach(function (bloc) {
      var correspond = bloc.getAttribute('data-cherche').indexOf(mot) !== -1;
      bloc.hidden = !correspond;
      /* Ce qui correspond s'ouvre : chercher « amiante » et devoir encore
         déplier trois fiches n'est pas une recherche. */
      if (bloc.tagName === 'DETAILS') bloc.open = correspond;
      if (correspond) trouves += 1;
    });

    /* Une section dont plus rien ne dépasse disparaît avec son titre : un
       intertitre seul au-dessus du vide fait croire à une page cassée. */
    zones.forEach(function (zone) {
      var restants = zone.querySelectorAll('[data-cherche]:not([hidden])').length;
      zone.hidden = restants === 0;
    });

    rien.hidden = trouves > 0;
  }

  champ.addEventListener('input', filtrer);
  vider.addEventListener('click', function () {
    champ.value = '';
    champ.focus();
    filtrer();
  });
  /* Le navigateur restaure parfois la valeur d'un champ au rechargement. */
  if (champ.value) filtrer();
})();
</script>
`;

mkdirSync(dirname(DEST), { recursive: true });
writeFileSync(DEST, page);
const ko = Math.round(Buffer.byteLength(page) / 1024);
console.log(`${DEST} — ${ko} Ko`);
