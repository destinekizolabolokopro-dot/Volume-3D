import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  APPARTEMENT,
  APPEL,
  ATRIUM,
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
  altitudeNiveau,
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

test('la surface de plancher est la somme des niveaux, atrium déduit', () => {
  const vide = (ATRIUM.x1 - ATRIUM.x0) * (ATRIUM.z1 - ATRIUM.z0);
  let total = 0;
  for (let n = 0; n < NIVEAUX; n += 1) {
    const e = empreinte(n);
    total += e.hx * 2 * (e.hz * 2) - vide;
  }
  assert.equal(surfacePlancher(), total);
  assert.ok(logements() > 0);
  /* Le puits coûte huit cent soixante-quatre mètres carrés : la page les
     retire de ce qu'elle annonce, sans quoi elle vendrait une surface qu'elle
     montre en train de ne pas exister. */
  assert.ok(vide * NIVEAUX > 800);
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

/** L'indice de la première étape située à l'intérieur du bâtiment. */
function seuil(): number {
  const k = VOL.findIndex((e) => e.oeil[0] < HALL.hx);
  assert.ok(k > 0, 'le vol n’entre jamais dans le bâtiment');
  return k;
}

test('dehors, le vol ne fait que se rapprocher', () => {
  /* C'est la promesse de la page tant qu'on est dehors : on descend, donc on
     avance. Une étape qui recule — même de deux mètres, même pour mieux
     cadrer — se lit à l'écran comme une hésitation.
     Une fois dedans, la règle n'a plus de sens : le vol traverse le hall,
     revient vers le fond pour prendre le puits, monte, puis repart vers la
     baie. Mesurer sa distance à l'axe du bâtiment ne dirait alors plus rien de
     ce qu'on voit. */
  const k = seuil();
  const rayon = (e: (typeof VOL)[number]) => Math.hypot(e.oeil[0], e.oeil[2]);
  for (let i = 1; i < k; i += 1) {
    assert.ok(
      rayon(VOL[i]) < rayon(VOL[i - 1]),
      `l’étape ${i} est plus loin de l’axe que la précédente`,
    );
  }
});

test('le vol part d’une vue aérienne', () => {
  const debut = VOL[0];
  assert.ok(Math.hypot(debut.oeil[0], debut.oeil[2]) > 120, 'le premier plan n’est pas assez loin');
  assert.ok(debut.oeil[1] > 50, 'le premier plan n’est pas une vue aérienne');
});

test('la montée reste dans le puits', () => {
  /* La vérification qui compte, et qui n'existait pas quand la caméra se
     contentait de tourner autour : entre le pied de l'atrium et la sortie au
     cinquième, l'œil doit rester **entre les joues**. Une étape qui déborde de
     vingt centimètres met l'objectif dans l'épaisseur d'un mur, et l'image se
     remplit de la face arrière d'une paroi. */
  /* Les étapes qui montent sont celles qui sont **dedans** et entre le
     plafond du hall et le plancher du séjour. Sans la condition « dedans », le
     filtre attrapait aussi le plan du parvis, à quatorze mètres d'altitude et
     cinquante-huit mètres de l'axe — et le test accusait la caméra de sortir
     d'un puits dans lequel elle n'était jamais entrée. */
  const montantes = VOL.filter(
    (e) =>
      e.oeil[0] < HALL.hx &&
      e.oeil[1] > HALL.haut &&
      e.oeil[1] < altitudeNiveau(APPARTEMENT.niveau),
  );
  assert.ok(montantes.length >= 1, 'aucune étape ne monte dans le puits');
  for (const e of montantes) {
    const [x, , z] = e.oeil;
    assert.ok(x > ATRIUM.x0 + 0.5 && x < ATRIUM.x1 - 0.5, `la montée sort du puits en x (${x})`);
    assert.ok(z > ATRIUM.z0 + 0.5 && z < ATRIUM.z1 - 0.5, `la montée sort du puits en z (${z})`);
  }
});

test('le vol finit debout dans le séjour', () => {
  const sol = altitudeNiveau(APPARTEMENT.niveau) + 0.12;
  const fin = VOL[VOL.length - 1];
  const [x, y, z] = fin.oeil;
  assert.ok(x > APPARTEMENT.x0 + 0.8 && x < APPARTEMENT.x1 - 0.8, `l’œil final sort du séjour en x (${x})`);
  assert.ok(z > APPARTEMENT.z0 + 0.8 && z < APPARTEMENT.z1 - 0.8, `l’œil final sort du séjour en z (${z})`);
  const oeilSol = y - sol;
  assert.ok(
    oeilSol > 1.3 && oeilSol < APPARTEMENT.haut - 0.8,
    `l’œil final n’est pas à hauteur d’homme (${oeilSol.toFixed(2)} m du sol)`,
  );

  /* Et l'on regarde à l'horizontale, à un degré près. Dans une pièce de trois
     mètres sous plafond, une caméra qui pique du nez remplit le cadre de
     parquet et perd le plafond — et une pièce sans plafond n'est plus une
     pièce. */
  const portee = Math.hypot(fin.vise[0] - x, fin.vise[2] - z);
  const pente = Math.atan2(fin.vise[1] - y, portee) * (180 / Math.PI);
  assert.ok(Math.abs(pente) < 3, `le dernier plan pique de ${pente.toFixed(1)}°`);
});

test('on entre par la porte, pas au travers du vitrage', () => {
  /* Le franchissement se joue entre l'avant-dernière étape, dehors, et celle
     d'après, dedans. La spline coupe le plan de façade quelque part entre les
     deux ; on interpole en ligne droite, ce qui est une approximation
     suffisante puisque la courbe reste dans l'enveloppe de ses points, et on
     vérifie que le passage se fait dans la largeur de la porte. */
  /* La **dernière** étape dehors et la première dedans, et non la première
     de chaque : le test cherchait jusqu'ici la première étape au-delà de la
     façade, c'est-à-dire la vue aérienne à cent vingt-six mètres, et
     interpolait une droite du ciel jusqu'à la porte. Il passait par chance —
     cette droite tombait à deux mètres quatre-vingts de l'axe — et il s'est
     mis à échouer dès que le vol a gagné une étape. Un test qui mesure la
     mauvaise chose et qui passe est plus dangereux qu'un test absent. */
  const k = seuil();
  const dehors = VOL[k - 1];
  const dedans = VOL[k];

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
