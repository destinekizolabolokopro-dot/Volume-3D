import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  APPEL,
  BAINS,
  BAIE,
  CHAMBRE,
  CLOISON,
  CLOISONS,
  courbeOeil,
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
  TERRASSE_SECTION,
  VOL,
  type Section,
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
     le vide.
     La dernière est exemptée, et elle seule : c'est le recul final sur
     l'immeuble, qui est vérifié par son propre test juste en dessous. */
  const liste = Object.values(PIECES);
  const x0 = Math.min(...liste.map((p) => p.x0));
  const z0 = Math.min(...liste.map((p) => p.z0));
  const z1 = Math.max(...liste.map((p) => p.z1));
  for (const [i, e] of VOL.slice(0, -1).entries()) {
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

test('la courbe du vol ne frôle aucune façade', () => {
  /*
   * Les étapes sont dans le logement ; **la courbe qui les relie ne l'est pas
   * forcément.**
   *
   * Le test au-dessus vérifie les points de contrôle, un par un, avec quarante
   * centimètres de marge. Il ne dit rien de ce qui se passe entre eux, et une
   * Catmull-Rom déborde derrière ses points : elle ne reste pas dans leur
   * enveloppe convexe, contrairement à ce qu'affirmait un commentaire de ce
   * fichier. Le sondage du rendu l'a chiffré — entre deux étapes posées à
   * z = 9,8 et z = 7,0, la caméra atteint z = 10,44, et arrive à vingt et un
   * centimètres du vitrage nord pour un plan avant de caméra à vingt.
   *
   * Trente centimètres de marge, et non quarante : une spline respire un peu
   * plus que ses points, et l'exiger aussi strict qu'eux reviendrait à
   * interdire la courbure. Mais elle doit rester au large du plan avant, sans
   * quoi la façade se fait trancher pendant le défilement — ce que personne ne
   * voit sur une capture d'arrêt.
   *
   * La dernière étape est exemptée : c'est le recul final sur l'immeuble.
   */
  const MARGE = 0.3;
  const liste = Object.values(PIECES);
  const x0 = Math.min(...liste.map((p) => p.x0));
  const x1 = Math.max(...liste.map((p) => p.x1));
  const z0 = Math.min(...liste.map((p) => p.z0));
  const z1 = Math.max(...liste.map((p) => p.z1));
  const courbe = courbeOeil();
  const PAS = 2000;
  /* On s'arrête au dernier point de contrôle intérieur : au-delà, le vol sort
     pour de bon et c'est son propre test qui s'en charge. */
  const fin = (VOL.length - 2) / (VOL.length - 1);
  let pire = { marge: Infinity, u: 0, ou: '' };
  for (let k = 0; k <= PAS; k += 1) {
    const u = (k / PAS) * fin;
    const p = courbe.getPoint(u);
    /*
     * Trois régimes, et on garde le meilleur.
     *
     * Choisir le régime d'après la seule abscisse ne marche pas : entre la
     * façade (x = 10,6) et le nez de terrasse (x = 10,8) il y a vingt
     * centimètres qui n'appartiennent ni au logement ni à la terrasse, et la
     * caméra les traverse forcément en sortant. Sur le seuil de la baie, la
     * seule contrainte qui ait un sens est de rester **dans l'ouvrant**.
     */
    const dansLogement = Math.min(p.x - x0, x1 - p.x, p.z - z0, z1 - p.z);
    const surTerrasse = Math.min(
      TERRASSE.x1 - p.x,
      p.x - TERRASSE.x0,
      p.z - TERRASSE.z0,
      TERRASSE.z1 - p.z,
    );
    const dansBaie =
      p.x > x1 - 0.6 && p.x < TERRASSE.x0 + 0.6
        ? Math.min(p.z - BAIE.z0, BAIE.z1 - p.z)
        : -Infinity;
    const m = Math.max(dansLogement, surTerrasse, dansBaie);
    if (m < pire.marge) pire = { marge: m, u, ou: `${p.x.toFixed(2)}, ${p.z.toFixed(2)}` };
  }
  assert.ok(
    pire.marge >= MARGE,
    `au point ${pire.u.toFixed(3)} du vol, la caméra passe à ${pire.marge.toFixed(
      2,
    )} m d’une façade (${pire.ou})`,
  );
});

test('le dernier plan recule dehors et se retourne sur l’immeuble', () => {
  /*
   * Le seul plan pris de l'extérieur, et le seul dont les règles de la visite
   * ne disent rien : il faut donc les écrire ici, sans quoi une valeur mal
   * recopiée poserait la caméra à l'intérieur d'une dalle et personne ne le
   * verrait avant la capture.
   *
   * Trois conditions, et elles suffisent. L'œil doit être **hors de
   * l'enveloppe** du bâtiment — il n'y a pas d'étage à quarante et un mètres
   * du côté où il se trouve, mais l'emprise du socle, elle, va loin. Il doit
   * être **assez loin** pour que la hauteur hors tout tienne dans le cadre.
   * Et il doit **regarder l'immeuble**, ce qui n'a rien d'automatique : un
   * point visé recopié de l'étape précédente laisserait la caméra tournée
   * vers la ville, dos au sujet.
   */
  const dernier = VOL[VOL.length - 1];
  const [x, y, z] = dernier.oeil;
  const socle = empreinte(0);

  assert.ok(
    Math.abs(x - socle.dx) > socle.hx + 20 || Math.abs(z) > socle.hz + 20,
    `le dernier œil (${x} ; ${z}) est dans l’emprise du bâtiment`,
  );
  assert.ok(y > SOL, `le dernier plan est sous l’appartement (${y} m)`);

  /* Assez loin pour cadrer : à `foyer` degrés, la hauteur hors tout doit
     tenir dans l'image avec de la marge — sinon on cadre un morceau de
     façade, ce qui ne dit pas ce qu'est le bâtiment. */
  const distance = Math.hypot(x - dernier.vise[0], y - dernier.vise[1], z - dernier.vise[2]);
  const couvert = 2 * Math.atan(hauteurHorsTout() / 2 / distance) * (180 / Math.PI);
  assert.ok(
    couvert < dernier.foyer * 0.85,
    `l’immeuble occupe ${couvert.toFixed(1)}° d’un cadre de ${dernier.foyer}° : trop près`,
  );
  assert.ok(
    couvert > dernier.foyer * 0.3,
    `l’immeuble n’occupe que ${couvert.toFixed(1)}° d’un cadre de ${dernier.foyer}° : trop loin`,
  );

  /* Et il le regarde : le point visé est dans l'emprise, à mi-hauteur. */
  assert.ok(
    Math.abs(dernier.vise[0] - socle.dx) < socle.hx && Math.abs(dernier.vise[2]) < socle.hz,
    'le dernier plan ne vise pas le bâtiment',
  );
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

test('la caméra franchit chaque cloison par une ouverture', () => {
  /*
   * Le défaut que ce test existe pour attraper est invisible à l'arrêt.
   *
   * Les captures sont prises **aux arrêts**, et à un arrêt la caméra est
   * toujours dans une pièce. Ce qui se passe entre deux arrêts n'est photographié
   * par personne : le vol pouvait traverser une cloison de plein fouet pendant
   * une seconde de défilement sans qu'aucune image de la série ne le montre.
   * Il le faisait — deux fois, pour entrer dans la chambre et dans la salle de
   * bains, en passant à côté des deux portes qu'on avait pris soin de
   * modéliser et d'entrouvrir.
   *
   * On échantillonne **la courbe elle-même**, et non des droites entre les
   * étapes. La version précédente interpolait en droite en se justifiant
   * ainsi : « la spline reste dans l'enveloppe convexe de ses points de
   * contrôle ». C'est faux — une Catmull-Rom interpole ses points et déborde
   * derrière eux — et le sondage du rendu l'a montré : entre l'étape à z = 9,8
   * et l'étape à z = 7,0, la caméra atteint z = 10,44, au-delà des deux, et
   * frôle le vitrage nord à vingt et un centimètres.
   */
  const MARGE = 0.25;
  const courbe = courbeOeil();
  const PAS = 2000;
  for (let k = 1; k <= PAS; k += 1) {
    const avant = courbe.getPoint((k - 1) / PAS);
    const apres = courbe.getPoint(k / PAS);
    const a = [avant.x, avant.y, avant.z];
    const b = [apres.x, apres.y, apres.z];
    for (const r of CLOISONS) {
      const axe = r.selonZ ? 0 : 2;
      const libre = r.selonZ ? 2 : 0;
      /* La cloison a une épaisseur : on traite ses deux faces, sans quoi un
         segment qui s'arrête dans le mur passerait inaperçu. */
      for (const plan of [r.fixe, r.fixe + CLOISON]) {
        const d0 = a[axe] - plan;
        const d1 = b[axe] - plan;
        if (d0 === d1 || d0 * d1 > 0) continue;
        const f = d0 / (d0 - d1);
        const ou = a[libre] + (b[libre] - a[libre]) * f;
        // Hors de la longueur de la cloison : il n'y a pas de mur là.
        if (ou < r.de || ou > r.a) continue;
        const passe = r.trous.some(([q0, q1]) => ou > q0 + MARGE && ou < q1 - MARGE);
        assert.ok(
          passe,
          `au point ${(k / PAS).toFixed(3)} du vol, on franchit la cloison ${
            r.selonZ ? 'x' : 'z'
          } = ${plan.toFixed(2)} à ${ou.toFixed(2)}, hors de ses ouvertures ${JSON.stringify(
            r.trous.map(([q0, q1]) => [q0, q1]),
          )}`,
        );
      }
    }
  }
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



test('la ponctuation double porte son espace insécable', () => {
  /*
   * Le deux-points français prend une espace **avant**, et cette espace est
   * insécable.
   *
   * Sans elle, le navigateur coupe où il veut, et il coupe : la capture en
   * 390 × 844 de la section « chambre » montrait une ligne commençant par
   * « : on donne le jour du matin ». Ce n'est pas un détail de puriste — un
   * deux-points en début de ligne se lit comme une coquille, et une page qui
   * vend du haut de gamme n'a pas droit aux coquilles.
   *
   * On vérifie sur **la copie affichée** seulement. Les commentaires du code
   * n'ont pas à respecter la typographie d'imprimerie, et les y forcer ferait
   * un test que personne ne comprendrait en le voyant échouer.
   */
  const copie: [string, string][] = [];
  const ajouter = (nom: string, texte: string) => copie.push([nom, texte]);
  const section = (nom: string, s: Section) => {
    ajouter(`${nom} — surtitre`, s.surtitre);
    s.titre.forEach((l: string, i: number) => ajouter(`${nom} — titre ${i}`, l));
    if (s.chapeau) ajouter(`${nom} — chapeau`, s.chapeau);
    for (const f of s.faits) {
      ajouter(`${nom} — clé`, f.cle);
      ajouter(`${nom} — valeur`, f.valeur);
    }
  };
  ajouter('projet — nom', PROJET.nom);
  ajouter('projet — lieu', PROJET.lieu);
  PROJET.titre.forEach((l: string, i: number) => ajouter(`projet — titre ${i}`, l));
  ajouter('projet — chapô', PROJET.chapo);
  ajouter('projet — action', PROJET.action);
  section('séjour', SEJOUR);
  section('cuisine', CUISINE);
  section('chambre', CHAMBRE);
  section('bains', BAINS);
  section('terrasse', TERRASSE_SECTION);
  for (const v of GALERIE.vues) {
    ajouter('galerie — titre', v.titre);
    ajouter('galerie — texte', v.texte);
  }
  APPEL.titre.forEach((l: string, i: number) => ajouter(`appel — titre ${i}`, l));
  ajouter('appel — surtitre', APPEL.surtitre);
  ajouter('appel — texte', APPEL.texte);
  ajouter('appel — action', APPEL.action);
  for (const c of chiffres()) {
    ajouter('chiffre — libellé', c.libelle);
    ajouter('chiffre — précision', c.precision);
  }

  for (const [nom, texte] of copie) {
    assert.ok(
      !/ [:;!?»]/.test(texte),
      `${nom} : espace sécable avant une ponctuation double — « ${texte} »`,
    );
    assert.ok(!/« /.test(texte), `${nom} : espace sécable après un guillemet ouvrant`);
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
