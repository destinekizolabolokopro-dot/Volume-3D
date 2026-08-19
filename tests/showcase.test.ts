import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildJourney, captionOpacity, sample } from '../lib/journey-path.ts';
import {
  WALL_FACADE,
  WALL_SKIN,
  containsPoint,
  distanceToSegment,
  projectOnWall,
  roomArea,
  roomWalls,
  totalArea,
  wallThickness,
} from '../lib/plan.ts';
import {
  SHOWCASE_CAPTIONS,
  SHOWCASE_CLOSING,
  SHOWCASE_DOORS,
  SHOWCASE_IDENTITY,
  SHOWCASE_MASSING,
  SHOWCASE_OPENING,
  SHOWCASE_ROOMS,
} from '../lib/showcase.ts';

/*
 * L'appartement de démonstration est la première chose que voit un visiteur.
 * Il est écrit à la main, donc il peut être faux — et un plan faux ne se voit
 * pas dans un éditeur de texte, il se voit à l'écran, trop tard.
 *
 * Ces contrôles viennent d'un vrai défaut : une porte déclarée entre le
 * dégagement et la salle d'eau, alors que les deux polygones ne se touchaient
 * pas. La caméra franchissait vingt centimètres de vide, sans sol ni plafond,
 * par lesquels on voyait le ciel au milieu de l'appartement.
 */

test('les pièces ne se chevauchent pas', () => {
  for (const room of SHOWCASE_ROOMS) {
    for (const other of SHOWCASE_ROOMS) {
      if (other.id === room.id) continue;
      for (const wall of roomWalls(room)) {
        // Le milieu de chaque mur, décalé vers l'intérieur : s'il tombe dans
        // une autre pièce, les deux polygones se superposent.
        const middle = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
        assert.ok(
          !containsPoint(other, middle) || distanceToSegment(middle, wall) < 1e-9,
          `${room.id} et ${other.id} se chevauchent`,
        );
      }
    }
  }
});

test('chaque porte intérieure repose sur un mur de ses deux pièces', () => {
  const byId = new Map(SHOWCASE_ROOMS.map((room) => [room.id, room]));
  for (const door of SHOWCASE_DOORS) {
    if (door.kind === 'window') continue;
    const sides = [door.from, door.to].filter((id) => byId.has(id));
    assert.ok(sides.length >= 1, `${door.id} ne touche aucune pièce connue`);
    for (const id of sides) {
      const room = byId.get(id)!;
      const onWall = roomWalls(room).some((wall) => projectOnWall(wall, { a: door.a, b: door.b }));
      assert.ok(onWall, `${door.id} ne repose sur aucun mur de ${id}`);
    }
  }
});

test('chaque fenêtre repose sur un mur de sa pièce', () => {
  const byId = new Map(SHOWCASE_ROOMS.map((room) => [room.id, room]));
  for (const door of SHOWCASE_DOORS) {
    if (door.kind !== 'window') continue;
    const room = byId.get(door.from || door.to);
    assert.ok(room, `${door.id} n’appartient à aucune pièce`);
    const onWall = roomWalls(room!).some((wall) => projectOnWall(wall, { a: door.a, b: door.b }));
    assert.ok(onWall, `${door.id} ne repose sur aucun mur de ${room!.id}`);
  }
});

test('une ouverture ne dépasse jamais la hauteur sous plafond', () => {
  const byId = new Map(SHOWCASE_ROOMS.map((room) => [room.id, room]));
  for (const door of SHOWCASE_DOORS) {
    for (const id of [door.from, door.to]) {
      const room = byId.get(id);
      if (!room) continue;
      assert.ok(door.height <= room.height, `${door.id} est plus haute que ${id}`);
      assert.ok(door.sill < door.height, `${door.id} a une allège au-dessus de son linteau`);
    }
  }
});

/**
 * Le contrôle qui a rattrapé le défaut le plus discret de tout le décor.
 *
 * Le mobilier était posé sur les **lignes du plan**, alors que chaque pièce
 * porte une peau de mur à l'intérieur de ce polygone : neuf centimètres pour une
 * cloison, trente pour une façade. Résultat, la cuisine était enfoncée d'un
 * tiers dans le mur de façade et le placard d'entrée à moitié dedans. À l'écran
 * ça ne se voit pas comme une erreur — ça se voit comme un meuble trop mince,
 * ce qui est bien pire : on cherche ce qui cloche sans le trouver.
 */
test('aucun meuble n’est enfoncé dans la maçonnerie', () => {
  const byId = new Map(SHOWCASE_ROOMS.map((room) => [room.id, room]));
  const faults: string[] = [];

  for (const item of SHOWCASE_MASSING) {
    const room = byId.get(item.roomId);
    assert.ok(room, `mobilier orphelin dans ${item.roomId}`);

    /* Les quatre coins de l'empreinte au sol, pivot compris.
       Le contrôle les calculait sans tenir compte du `yaw` — ce qui allait tant
       qu'aucun meuble n'était pivoté, et devenait faux dès le premier : il
       cherchait le radiateur de la chambre à quarante centimètres de sa vraie
       place. La rotation reprend celle de `furniture()` : le repère du plan a
       son y vers le bas, d'où le signe. */
    const spin = -((item.yaw ?? 0) * Math.PI) / 180;
    const corners = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) => {
        const dx = (sx * item.w) / 2;
        const dz = (sy * item.d) / 2;
        return {
          x: item.x + dx * Math.cos(spin) + dz * Math.sin(spin),
          y: item.y - dx * Math.sin(spin) + dz * Math.cos(spin),
        };
      }),
    );

    for (const corner of corners) {
      if (!containsPoint(room!, corner)) {
        faults.push(`${item.roomId} : coin hors de la pièce en (${corner.x.toFixed(2)}, ${corner.y.toFixed(2)})`);
        continue;
      }
      for (const wall of roomWalls(room!)) {
        const thickness = wallThickness(room!, wall, SHOWCASE_ROOMS, WALL_SKIN, WALL_FACADE);
        const gap = distanceToSegment(corner, wall);
        // Un millimètre de tolérance : on compare des flottants.
        if (gap < thickness - 0.001) {
          faults.push(
            `${item.roomId} : un meuble entre de ${(thickness - gap).toFixed(2)} m dans un mur de ${thickness} m`,
          );
        }
      }
    }
    assert.ok((item.base ?? 0) + item.h <= room!.height + 1e-9, `un meuble traverse le plafond de ${item.roomId}`);
  }

  assert.deepEqual([...new Set(faults)], [], `\n  ${[...new Set(faults)].join('\n  ')}`);
});

test('la surface annoncée correspond à la somme des pièces', () => {
  assert.ok(Math.abs(totalArea(SHOWCASE_ROOMS) - SHOWCASE_IDENTITY.area) < 0.1);
});

test('les légendes annoncent la surface réelle de leur pièce', () => {
  for (const room of SHOWCASE_ROOMS) {
    const caption = SHOWCASE_CAPTIONS[room.id];
    assert.ok(caption, `pas de légende pour ${room.id}`);
    const written = Number(caption.title.replace(' m²', '').replace(',', '.'));
    assert.ok(
      Math.abs(written - roomArea(room)) < 0.1,
      `${room.id} : la légende dit ${caption.title}, le plan dit ${roomArea(room).toFixed(1)} m²`,
    );
  }
});

test('la visite d’accueil traverse tout l’appartement sans sortir des murs', () => {
  const journey = buildJourney(SHOWCASE_ROOMS, SHOWCASE_DOORS, {
    opening: SHOWCASE_OPENING,
    captions: SHOWCASE_CAPTIONS,
    closing: SHOWCASE_CLOSING,
  });

  assert.deepEqual(
    journey.rooms.map((entry) => entry.roomId),
    ['sejour', 'degagement', 'chambre', 'salle-eau'],
  );
  // Le mot de la fin tombe dans le séjour : on revient sur la plus grande
  // pièce plutôt que de terminer dans la salle d'eau.
  const closing = journey.captions[journey.captions.length - 1];
  assert.equal(closing.title, SHOWCASE_CLOSING.title);
  const end = sample(journey, 1);
  assert.ok(containsPoint(SHOWCASE_ROOMS[0], end), 'la visite doit se terminer dans le séjour');

  const openings = SHOWCASE_DOORS.filter((door) => door.kind !== 'window');
  const faults: string[] = [];
  for (let step = 0; step <= 3000; step += 1) {
    const t = step / 3000;
    if (t <= journey.doorOpens.to) continue;
    const pose = sample(journey, t);
    if (SHOWCASE_ROOMS.some((room) => containsPoint(room, pose))) continue;
    const inDoorway = openings.some(
      (door) => distanceToSegment(pose, { a: door.a, b: door.b }) < 0.25,
    );
    if (!inDoorway) faults.push(`t=${t.toFixed(4)} (${pose.x.toFixed(2)}, ${pose.y.toFixed(2)})`);
  }
  assert.deepEqual(faults, [], `la caméra sort du logement : ${faults.slice(0, 4).join(', ')}`);
});

test('à tout moment, au plus une légende occupe l’écran', () => {
  const journey = buildJourney(SHOWCASE_ROOMS, SHOWCASE_DOORS, {
    opening: SHOWCASE_OPENING,
    captions: SHOWCASE_CAPTIONS,
    closing: SHOWCASE_CLOSING,
  });
  for (let step = 0; step <= 800; step += 1) {
    const t = step / 800;
    const visible = journey.captions.filter((caption) => captionOpacity(caption, t) > 0.8);
    assert.ok(visible.length <= 1, `${visible.length} légendes à t=${t.toFixed(3)}`);
  }
});
