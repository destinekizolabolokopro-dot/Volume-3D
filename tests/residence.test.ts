import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  APPEL,
  BAINS,
  BAIE,
  CHAMBRE,
  CUISINE,
  ETAGE,
  GALERIE,
  NAVIGATION,
  NIVEAUX,
  NIVEAU_APPARTEMENT,
  PIECES,
  PROJET,
  SEJOUR,
  SOCLE,
  SOL,
  SOUS_PLAFOND,
  TERRASSE,
  VOL,
  altitudeNiveau,
  chiffres,
  empreinte,
  hauteurHorsTout,
  logements,
  surfaceAppartement,
  surfacePiece,
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



/* ================================================================ le texte === */

test('les chiffres de la page sortent tous de la géométrie', () => {
  const trois = chiffres();
  assert.equal(trois.length, 3);
  /* Le seul qui ne soit pas une mesure est l'année de livraison, qui n'en est
     pas une. Les deux autres doivent suivre le bâtiment. */
  assert.equal(trois[0].valeur, surfaceAppartement().toFixed(1).replace('.', ','));
  assert.equal(trois[1].valeur, String(NIVEAU_APPARTEMENT));
  for (const chiffre of trois) {
    assert.notEqual(chiffre.valeur.trim(), '');
    assert.notEqual(chiffre.libelle.trim(), '');
    assert.notEqual(chiffre.precision.trim(), '');
  }
});

/* ========================================================= appartement === */

test('les pièces ne se chevauchent pas et forment un rectangle plein', () => {
  /* Deux pièces qui se recouvrent posent deux sols au même endroit — deux
     plans coplanaires, donc le moutonnement caractéristique du z-fighting, et
     il ne se voit qu'à la capture. */
  const liste = Object.values(PIECES);
  for (let i = 0; i < liste.length; i += 1) {
    for (let j = i + 1; j < liste.length; j += 1) {
      const a = liste[i];
      const b = liste[j];
      const croise = a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
      assert.ok(!croise, `${a.nom} et ${b.nom} se chevauchent`);
    }
  }
  /* Et la somme des pièces doit remplir exactement l'enveloppe : une pièce qui
     manque laisse un trou dans le plancher, par lequel on voit le vide. */
  const x0 = Math.min(...liste.map((p) => p.x0));
  const x1 = Math.max(...liste.map((p) => p.x1));
  const z0 = Math.min(...liste.map((p) => p.z0));
  const z1 = Math.max(...liste.map((p) => p.z1));
  assert.equal(surfaceAppartement().toFixed(2), ((x1 - x0) * (z1 - z0)).toFixed(2));
});

test('chaque pièce est plus grande que le meuble qu’elle contient', () => {
  /* Un garde-fou grossier mais utile : aucune pièce sous huit mètres carrés,
     et aucune dimension sous deux mètres. En dessous, ce n'est plus une pièce,
     c'est un placard — et la caméra, qui s'y arrête à hauteur d'œil, aurait le
     nez contre un mur. */
  for (const p of Object.values(PIECES)) {
    assert.ok(surfacePiece(p) >= 8, `${p.nom} ne fait que ${surfacePiece(p)} m²`);
    assert.ok(p.x1 - p.x0 >= 2 && p.z1 - p.z0 >= 2, `${p.nom} est trop étroite`);
  }
});

test('la visite ne quitte jamais l’appartement, sauf pour la terrasse', () => {
  /* C'est la promesse de la page depuis qu'elle ne montre plus qu'un logement.
     Une étape qui s'échappe dans le plateau voisin — non modélisé — cadrerait
     le vide. */
  const liste = Object.values(PIECES);
  const x0 = Math.min(...liste.map((p) => p.x0));
  const z0 = Math.min(...liste.map((p) => p.z0));
  const z1 = Math.max(...liste.map((p) => p.z1));
  for (const [i, e] of VOL.entries()) {
    const [x, y, z] = e.oeil;
    const dehors = x > TERRASSE.x0;
    if (dehors) {
      assert.ok(x < TERRASSE.x1 - 0.4, `l’étape ${i} déborde la terrasse (${x})`);
      assert.ok(z > TERRASSE.z0 && z < TERRASSE.z1, `l’étape ${i} sort de la terrasse en z`);
    } else {
      assert.ok(x > x0 + 0.4, `l’étape ${i} traverse le mur ouest (${x})`);
      assert.ok(z > z0 + 0.4 && z < z1 - 0.4, `l’étape ${i} traverse une façade (${z})`);
    }
    assert.equal(y.toFixed(2), (SOL + 1.55).toFixed(2), `l’étape ${i} n’est pas à hauteur d’œil`);
  }
});

test('on sort sur la terrasse par la baie coulissante', () => {
  /* Le franchissement se joue entre la dernière étape dedans et la première
     dehors. On interpole en droite, ce qui suffit puisque la spline reste dans
     l'enveloppe de ses points, et on vérifie qu'on passe dans l'ouvrant — pas
     au travers d'un vitrage fixe. */
  const k = VOL.findIndex((e) => e.oeil[0] > TERRASSE.x0);
  assert.ok(k > 0, 'la visite ne sort jamais sur la terrasse');
  const dedans = VOL[k - 1];
  const dehors = VOL[k];
  const facade = PIECES.sejour.x1;
  const f = (facade - dedans.oeil[0]) / (dehors.oeil[0] - dedans.oeil[0]);
  const z = dedans.oeil[2] + (dehors.oeil[2] - dedans.oeil[2]) * f;
  assert.ok(
    z > BAIE.z0 + 0.3 && z < BAIE.z1 - 0.3,
    `on franchit la façade à z = ${z.toFixed(2)}, hors de la baie [${BAIE.z0} ; ${BAIE.z1}]`,
  );
});

test('chaque pièce du plan a son arrêt de caméra', () => {
  /* Une pièce sans arrêt est une pièce modélisée et meublée que personne ne
     verra jamais — le contraire exact de ce que cette page promet. */
  const dedans = (p: (typeof PIECES)[string], e: (typeof VOL)[number]) =>
    e.oeil[0] > p.x0 && e.oeil[0] < p.x1 && e.oeil[2] > p.z0 && e.oeil[2] < p.z1;
  for (const p of Object.values(PIECES)) {
    assert.ok(
      VOL.some((e) => dedans(p, e)),
      `aucun arrêt dans ${p.nom}`,
    );
  }
});

test('la hauteur sous plafond laisse passer une personne debout', () => {
  assert.ok(SOUS_PLAFOND >= 2.5, 'le plafond est trop bas');
  assert.equal(SOL, SOCLE + 0.25 + NIVEAU_APPARTEMENT * ETAGE + 0.12);
});

test('aucune ligne de titre n’est vide', () => {
  /* `Mots` découpe chaque ligne sur l'espace et pose un `span` par mot. Une
     ligne vide produit un `span` vide qui occupe quand même sa marge : un trou
     dans le titre, invisible dans le source et bien visible à l'écran. */
  for (const [nom, lignes] of [
    ['le titre du premier écran', PROJET.titre],
    ['le titre du séjour', SEJOUR.titre],
    ['le titre de la cuisine', CUISINE.titre],
    ['le titre de la chambre', CHAMBRE.titre],
    ['le titre de la salle de bains', BAINS.titre],
    ['le titre de l’appel final', APPEL.titre],
  ] as const) {
    assert.ok(lignes.length >= 1, `${nom} n’a aucune ligne`);
    for (const ligne of lignes) {
      assert.notEqual(ligne.trim(), '', `${nom} contient une ligne vide`);
      assert.ok(!/ {2}/.test(ligne), `${nom} contient une double espace`);
    }
  }
});



test('la galerie a autant de légendes que le vol a d’étapes en galerie', () => {
  /* On compte les étapes **ancrées** sur la galerie, et non celles qui tombent
     dans une plage de curseur : les fractions bougent dès qu'une section
     change de longueur, l'ancrage non. La première version comptait par
     plage, et ajouter deux sections a suffi pour qu'elle mente. */
  const dedans = VOL.filter((e) => e.ancre === '#galerie');
  assert.equal(GALERIE.vues.length, dedans.length);
});

/* ================================================================== vol === */

test('le vol avance toujours, et sur tout le défilement', () => {
  assert.equal(VOL[0].t, 0);
  assert.equal(VOL[VOL.length - 1].t, 1);
  for (let i = 1; i < VOL.length; i += 1) {
    assert.ok(VOL[i].t > VOL[i - 1].t, `l’étape ${i} ne vient pas après la précédente`);
  }
});











test('le foyer ne fait pas de bond d’une étape à l’autre', () => {
  /* Le champ s'ouvre en chemin, c'est voulu. Mais un saut brutal se voit comme
     un zoom, et un zoom au milieu d'un travelling est exactement l'effet que
     le brief demandait d'éviter. */
  for (let i = 1; i < VOL.length; i += 1) {
    const bond = Math.abs(VOL[i].foyer - VOL[i - 1].foyer);
    assert.ok(bond <= 10, `le foyer bondit de ${bond}° à l’étape ${i}`);
  }
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
