import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONSIGNE_VEILLE,
  DOMAINES_VEILLE,
  SOURCES_VEILLE,
  rassemblerLaVeille,
  sourceDuLien,
  type CitationWeb,
} from '../lib/veille.ts';

/**
 * La veille ouvre la seule porte de ce produit qui donne sur l'extérieur.
 *
 * Tout le reste — les articles, les délais, les refus — se décide dans des
 * fichiers qu'on relit. Ici, du texte écrit par quelqu'un d'autre entre dans
 * la réponse, et la seule chose qui sépare « l'INSEE dit » de « un site dit »
 * est la liste. Ces tests décrivent donc d'abord ce qu'elle REFUSE.
 */

/* ------------------------------------------------------------- la liste --- */

test('la liste ne porte que des noms d’hôtes, jamais d’adresses', () => {
  for (const source of SOURCES_VEILLE) {
    assert.ok(!source.hote.includes('/'), `${source.hote} porte un chemin`);
    assert.ok(!source.hote.includes(':'), `${source.hote} porte un protocole`);
    assert.equal(source.hote, source.hote.toLowerCase());
  }
});

test('la liste ne contient pas deux fois le même site', () => {
  assert.equal(new Set(DOMAINES_VEILLE).size, DOMAINES_VEILLE.length);
});

test('les deux familles sont peuplées', () => {
  const officielles = SOURCES_VEILLE.filter((s) => s.nature === 'officielle');
  const professionnelles = SOURCES_VEILLE.filter((s) => s.nature === 'professionnelle');
  assert.ok(officielles.length >= 5);
  assert.ok(professionnelles.length >= 3);
});

test('la consigne nomme chacun des sites autorisés', () => {
  /* La consigne est construite depuis le tableau, et ce test dit pourquoi :
     une source ajoutée à `allowed_domains` sans être annoncée au modèle
     serait ouverte sans être jamais consultée. */
  for (const source of SOURCES_VEILLE) {
    assert.ok(CONSIGNE_VEILLE.includes(source.hote), `${source.hote} manque à la consigne`);
    assert.ok(CONSIGNE_VEILLE.includes(source.nom), `${source.nom} manque à la consigne`);
  }
});

test('la consigne maintient la règle des numéros d’article', () => {
  /* La règle 1 du socle interdit de citer un article qui ne vient pas des
     textes joints. Ouvrir le web sans le redire ici reviendrait à la lever
     sans le vouloir : une page de Légifrance porte des numéros, et ils ont
     l'air aussi vrais que les autres. */
  assert.match(CONSIGNE_VEILLE, /JAMAIS un numéro d’article trouvé sur le web/);
});

/* --------------------------------------------------------------- le lien --- */

test('un site de la liste est reconnu, sous-domaines compris', () => {
  assert.equal(sourceDuLien('https://www.insee.fr/fr/statistiques/1234')?.nom, 'INSEE');
  assert.equal(sourceDuLien('https://bofip.impots.gouv.fr/bofip/1234-PGP')?.nom, 'BOFiP');
  assert.equal(sourceDuLien('https://fnaim.fr/actualites')?.nature, 'professionnelle');
});

test('un site qui se termine par les mêmes lettres n’est pas le site', () => {
  /* Le point avant le suffixe est tout ce qui sépare une source officielle
     d'un domaine acheté pour lui ressembler. */
  assert.equal(sourceDuLien('https://faux-insee.fr/irl'), null);
  assert.equal(sourceDuLien('https://insee.fr.exemple.com/irl'), null);
  assert.equal(sourceDuLien('https://notinsee.fr'), null);
});

test('ce qui n’est pas dans la liste est refusé', () => {
  assert.equal(sourceDuLien('https://fr.wikipedia.org/wiki/Bail'), null);
  assert.equal(sourceDuLien('https://un-blog-immobilier.fr/irl-2026'), null);
});

test('une adresse illisible ou d’un autre protocole est refusée', () => {
  assert.equal(sourceDuLien('pas une adresse'), null);
  assert.equal(sourceDuLien(''), null);
  assert.equal(sourceDuLien('javascript:alert(1)'), null);
  assert.equal(sourceDuLien('file:///etc/passwd'), null);
});

test('la casse de l’hôte ne change rien', () => {
  assert.equal(sourceDuLien('https://WWW.INSEE.FR/fr/')?.nom, 'INSEE');
});

/* ----------------------------------------------------------- la relecture --- */

function citation(url: string, extra: Partial<CitationWeb> = {}): CitationWeb {
  return {
    type: 'web_search_result_location',
    url,
    title: 'Indice de référence des loyers',
    cited_text: 'L’indice de référence des loyers du 2ᵉ trimestre 2026 s’établit à 146,12.',
    ...extra,
  };
}

test('une citation web de la liste ressort avec son nom et son extrait', () => {
  const [source] = rassemblerLaVeille([citation('https://www.insee.fr/fr/statistiques/1')]);
  assert.equal(source.nom, 'INSEE');
  assert.equal(source.nature, 'officielle');
  assert.equal(source.titre, 'Indice de référence des loyers');
  assert.match(source.extrait, /146,12/);
});

test('une citation hors liste est jetée', () => {
  assert.deepEqual(rassemblerLaVeille([citation('https://un-blog-immobilier.fr/irl')]), []);
});

test('les citations du corpus ne sont pas de la veille', () => {
  /* Les deux familles de citations arrivent dans le même tableau : celles qui
     rattachent un passage à un article joint n'ont ni type web ni adresse, et
     ne doivent pas se retrouver affichées comme des pages consultées. */
  const duCorpus: CitationWeb = { type: 'char_location', cited_text: 'Le bailleur est obligé…' };
  assert.deepEqual(rassemblerLaVeille([duCorpus]), []);
});

test('une page citée trois fois reste une page', () => {
  const url = 'https://www.service-public.fr/particuliers/vosdroits/F1311';
  const sources = rassemblerLaVeille([citation(url), citation(url), citation(url)]);
  assert.equal(sources.length, 1);
});

test('une page sans titre prend le nom de sa source', () => {
  const [source] = rassemblerLaVeille([
    citation('https://www.anil.org/plafonds', { title: null }),
  ]);
  assert.equal(source.titre, 'ANIL');
});

test('la liste affichée ne s’allonge pas indéfiniment', () => {
  const beaucoup = Array.from({ length: 30 }, (_, rang) =>
    citation(`https://www.legifrance.gouv.fr/page/${rang}`),
  );
  assert.ok(rassemblerLaVeille(beaucoup).length <= 8);
});

test('un extrait interminable est coupé', () => {
  const [source] = rassemblerLaVeille([
    citation('https://www.insee.fr/fr/statistiques/2', { cited_text: 'mot '.repeat(300) }),
  ]);
  assert.ok(source.extrait.length <= 401, source.extrait.length.toString());
});
