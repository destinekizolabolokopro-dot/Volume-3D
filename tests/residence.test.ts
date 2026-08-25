import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  APPEL,
  ARCHITECTURE,
  ETAGE,
  GALERIE,
  NAVIGATION,
  NIVEAUX,
  PRESENTATION,
  PROJET,
  SOCLE,
  chiffres,
  empreinte,
  hauteurHorsTout,
  logements,
  surfacePlancher,
  terrasses,
} from '../lib/residence.ts';

const page = readFileSync(new URL('../app/residence/page.tsx', import.meta.url), 'utf8');

/* =============================================================== la masse === */

test('la masse ne fait que se retirer en montant', () => {
  /* C'est le sujet du bâtiment, et c'est aussi ce qui rend `terrasses()`
     calculable : une terrasse est un redan. Si un niveau redevenait plus large
     que celui du dessous, le compte des terrasses deviendrait faux sans que
     rien ne se plaigne. */
  for (let n = 1; n < NIVEAUX; n += 1) {
    const bas = empreinte(n - 1);
    const haut = empreinte(n);
    assert.ok(haut.hx <= bas.hx, `le niveau ${n} est plus large que le ${n - 1}`);
    assert.ok(haut.hz <= bas.hz, `le niveau ${n} est plus profond que le ${n - 1}`);
  }
});

test('chaque redan dégage une terrasse, et pas une de plus', () => {
  let redans = 0;
  for (let n = 0; n + 1 < NIVEAUX; n += 1) {
    if (empreinte(n + 1).hx < empreinte(n).hx) redans += 1;
  }
  assert.equal(terrasses(), redans);
  assert.ok(redans >= 1, 'un bâtiment sans redan n’est plus le même bâtiment');
});

test('la hauteur annoncée est celle de l’empilement', () => {
  /* La page affiche « 50,6 m ». Ce chiffre doit rester la somme du socle, des
     douze étages et du couronnement — c'est aussi ce que `edifice.ts` mesure
     sur la géométrie qu'il vient de monter. */
  assert.equal(hauteurHorsTout(), SOCLE + 0.25 + NIVEAUX * ETAGE + 2.1);
});

test('la surface de plancher est la somme des niveaux', () => {
  let total = 0;
  for (let n = 0; n < NIVEAUX; n += 1) {
    const e = empreinte(n);
    total += e.hx * 2 * (e.hz * 2);
  }
  assert.equal(surfacePlancher(), total);
  assert.ok(logements() > 0);
});

/* ================================================================ le texte === */

test('les chiffres de la page sortent tous de la géométrie', () => {
  const trois = chiffres();
  assert.equal(trois.length, 3);
  /* Le seul qui ne soit pas une mesure est l'année de livraison, qui n'en est
     pas une. Les deux autres doivent suivre le bâtiment. */
  assert.equal(trois[0].valeur, String(logements()));
  assert.equal(trois[1].valeur, String(NIVEAUX));
  for (const chiffre of trois) {
    assert.notEqual(chiffre.valeur.trim(), '');
    assert.notEqual(chiffre.libelle.trim(), '');
    assert.notEqual(chiffre.precision.trim(), '');
  }
});

test('aucune ligne de titre n’est vide', () => {
  /* `Mots` découpe chaque ligne sur l'espace et pose un `span` par mot. Une
     ligne vide produit un `span` vide qui occupe quand même sa marge : un trou
     dans le titre, invisible dans le source et bien visible à l'écran. */
  for (const [nom, lignes] of [
    ['le titre du premier écran', PROJET.titre],
    ['le titre de la présentation', PRESENTATION.titre],
    ['le titre de la section architecture', ARCHITECTURE.titre],
    ['le titre de l’appel final', APPEL.titre],
  ] as const) {
    assert.ok(lignes.length >= 1, `${nom} n’a aucune ligne`);
    for (const ligne of lignes) {
      assert.notEqual(ligne.trim(), '', `${nom} contient une ligne vide`);
      assert.ok(!/ {2}/.test(ligne), `${nom} contient une double espace`);
    }
  }
});

test('les quatre traits d’architecture sont numérotés dans l’ordre', () => {
  ARCHITECTURE.traits.forEach((trait, i) => {
    assert.equal(trait.numero, String(i + 1).padStart(2, '0'));
    assert.notEqual(trait.titre.trim(), '');
    assert.notEqual(trait.texte.trim(), '');
  });
});

test('la galerie a autant de légendes que la caméra a de plans', () => {
  /* Trois plans de galerie sont keyframés dans `components/premium/Edifice.tsx`
     et chacun porte sa légende. Ajouter une vue sans ajouter son plan donnerait
     un écran de plus sur la même image. */
  assert.equal(GALERIE.vues.length, 3);
});

/* ============================================================ la navigation === */

test('chaque lien de la barre vise une section qui existe', () => {
  /* La faute que ce test attrape a réellement été commise : « About » pointait
     sur `#gallery`. Rien ne casse — le lien défile jusqu'à la mauvaise section,
     et le surlignage de la barre désigne autre chose que ce qu'on lit. */
  for (const lien of NAVIGATION) {
    assert.ok(lien.href.startsWith('#'), `${lien.label} ne vise pas une ancre`);
    const id = lien.href.slice(1);
    assert.ok(
      page.includes(`id="${id}"`),
      `la section « ${id} », visée par « ${lien.label} », n’existe pas dans la page`,
    );
  }
  const vus = new Set(NAVIGATION.map((lien) => lien.href));
  assert.equal(vus.size, NAVIGATION.length, 'deux liens visent la même section');
});
