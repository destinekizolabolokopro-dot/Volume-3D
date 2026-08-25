import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  APPEL,
  ARCHITECTURE,
  ETAGE,
  GALERIE,
  HALL,
  NAVIGATION,
  NIVEAUX,
  PRESENTATION,
  PROJET,
  SOCLE,
  VOL,
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

test('la galerie a autant de légendes que le vol a d’étapes en galerie', () => {
  /* Les trois écrans de la galerie occupent le curseur de 0,43 à 0,84, et le
     vol y pose une étape par écran. Ajouter une vue sans ajouter son étape
     donnerait un écran de plus sur la même image. */
  const dedans = VOL.filter((e) => e.t >= 0.43 && e.t < 0.85);
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

test('le vol ne fait que se rapprocher', () => {
  /* C'est la promesse de la page : on descend, donc on avance. Une étape qui
     recule — même de deux mètres, même pour mieux cadrer — se lit à l'écran
     comme une hésitation, et c'est le seul défaut qu'un travelling ne pardonne
     pas. Le dernier plan est le seul qui recule un peu du mur qu'il vise, et
     c'est un recul par rapport à sa **cible**, pas par rapport au bâtiment :
     on mesure donc la distance à l'axe. */
  const rayon = (e: (typeof VOL)[number]) => Math.hypot(e.oeil[0], e.oeil[2]);
  for (let i = 1; i < VOL.length; i += 1) {
    assert.ok(
      rayon(VOL[i]) < rayon(VOL[i - 1]),
      `l’étape ${i} est plus loin de l’axe que la précédente`,
    );
  }
});

test('le vol part dehors et finit dans le hall', () => {
  const debut = VOL[0];
  assert.ok(Math.hypot(debut.oeil[0], debut.oeil[2]) > 120, 'le premier plan n’est pas assez loin');
  assert.ok(debut.oeil[1] > 50, 'le premier plan n’est pas une vue aérienne');

  /* La vérification qui compte, et qui n'existait pas quand la caméra se
     contentait de tourner autour : la dernière étape doit être **entre les
     murs**, au-dessus du sol et sous le plafond. Une étape qui déborde de
     vingt centimètres met l'œil dans l'épaisseur d'une paroi, et l'image se
     remplit de la face arrière d'un mur. */
  const fin = VOL[VOL.length - 1];
  const [x, y, z] = fin.oeil;
  assert.ok(Math.abs(x) < HALL.hx - 0.6, `l’œil final sort du hall en x (${x})`);
  assert.ok(Math.abs(z) < HALL.hz - 0.6, `l’œil final sort du hall en z (${z})`);
  assert.ok(y > 1.4 && y < HALL.haut - 0.8, `l’œil final n’est pas à hauteur d’homme (${y})`);
});

test('on entre par la porte, pas au travers du vitrage', () => {
  /* Le franchissement se joue entre l'avant-dernière étape, dehors, et celle
     d'après, dedans. La spline coupe le plan de façade quelque part entre les
     deux ; on interpole en ligne droite, ce qui est une approximation
     suffisante puisque la courbe reste dans l'enveloppe de ses points, et on
     vérifie que le passage se fait dans la largeur de la porte. */
  const dehors = VOL.find((e) => e.oeil[0] > HALL.hx);
  const dedans = VOL.find((e) => e.t > (dehors?.t ?? 0) && e.oeil[0] < HALL.hx);
  assert.ok(dehors && dedans, 'aucune étape ne franchit la façade');

  const f = (dehors.oeil[0] - HALL.hx) / (dehors.oeil[0] - dedans.oeil[0]);
  const zSeuil = dehors.oeil[2] + (dedans.oeil[2] - dehors.oeil[2]) * f;
  const ySeuil = dehors.oeil[1] + (dedans.oeil[1] - dehors.oeil[1]) * f;
  assert.ok(
    Math.abs(zSeuil) < HALL.porte - 0.5,
    `on traverse la façade à ${zSeuil.toFixed(2)} m de l’axe, hors de la porte`,
  );
  assert.ok(ySeuil > 0.5 && ySeuil < 3.6, `on franchit le seuil à ${ySeuil.toFixed(2)} m`);
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
