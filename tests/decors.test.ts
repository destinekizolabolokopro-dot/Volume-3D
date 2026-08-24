import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildJourney, captionOpacity, freeRun, sample } from '../lib/journey-path.ts';
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
import type { CaptionText } from '../lib/journey-path.ts';
import type { PlanDoor, PlanRoom } from '../lib/types.ts';
import {
  SHOWCASE_CAPTIONS,
  SHOWCASE_CLOSING,
  SHOWCASE_DOORS,
  SHOWCASE_IDENTITY,
  SHOWCASE_MASSING,
  SHOWCASE_OPENING,
  SHOWCASE_ROOMS,
  type Massing,
} from '../lib/showcase.ts';
import {
  MAISON_CAPTIONS,
  MAISON_CLOSING,
  MAISON_DOORS,
  MAISON_IDENTITY,
  MAISON_MASSING,
  MAISON_OPENING,
  MAISON_ROOMS,
} from '../lib/maison.ts';
import {
  VILLA_CAPTIONS,
  VILLA_CLOSING,
  VILLA_DOORS,
  VILLA_IDENTITY,
  VILLA_MASSING,
  VILLA_OPENING,
  VILLA_ROOMS,
} from '../lib/villa.ts';

/*
 * Les deux décors écrits à la main.
 *
 * Ce sont les premières choses que voit un visiteur, et ils sont écrits à la
 * main, donc ils peuvent être faux — or un plan faux ne se voit pas dans un
 * éditeur de texte, il se voit à l'écran, trop tard.
 *
 * Ces contrôles viennent d'un vrai défaut : une porte déclarée entre le
 * dégagement et la salle d'eau, alors que les deux polygones ne se touchaient
 * pas. La caméra franchissait vingt centimètres de vide, sans sol ni plafond,
 * par lesquels on voyait le ciel au milieu de l'appartement.
 *
 * Ils tournent sur les deux décors, et ce n'est pas de la symétrie gratuite :
 * la maison a été dessinée *après* que ces contrôles existaient, et elle a
 * démarré avec trois défauts qu'ils ont rattrapés le jour même. Un décor ajouté
 * sans eux serait un décor non vérifié.
 */

interface Decor {
  label: string;
  rooms: PlanRoom[];
  doors: PlanDoor[];
  massing: Massing[];
  opening: CaptionText;
  captions: Record<string, CaptionText>;
  closing: CaptionText;
  area: number;
  /** L'ordre des pièces visitées pour la première fois, et rien d'autre. */
  order: string[];
  /** La pièce où doit tomber le mot de la fin : la plus grande, toujours. */
  finale: string;
}

const DECORS: Decor[] = [
  {
    label: 'appartement',
    rooms: SHOWCASE_ROOMS,
    doors: SHOWCASE_DOORS,
    massing: SHOWCASE_MASSING,
    opening: SHOWCASE_OPENING,
    captions: SHOWCASE_CAPTIONS,
    closing: SHOWCASE_CLOSING,
    area: SHOWCASE_IDENTITY.area,
    order: [
      'entree',
      'galerie',
      'salon',
      'salle-a-manger',
      'cuisine',
      'suite',
      'bain-suite',
      'chambre',
      'salle-de-bains',
    ],
    finale: 'salon',
  },
  {
    label: 'maison',
    rooms: MAISON_ROOMS,
    doors: MAISON_DOORS,
    massing: MAISON_MASSING,
    opening: MAISON_OPENING,
    captions: MAISON_CAPTIONS,
    closing: MAISON_CLOSING,
    area: MAISON_IDENTITY.area,
    order: ['entree', 'degagement', 'sejour', 'chambre-1', 'chambre-2', 'salle-de-bain'],
    finale: 'sejour',
  },
  {
    label: 'villa',
    rooms: VILLA_ROOMS,
    doors: VILLA_DOORS,
    massing: VILLA_MASSING,
    opening: VILLA_OPENING,
    captions: VILLA_CAPTIONS,
    closing: VILLA_CLOSING,
    area: VILLA_IDENTITY.area,
    order: [
      'entree',
      'sejour',
      'galerie',
      'chambre-3',
      'suite',
      'bain-suite',
      'chambre-2',
      'salle-de-bain',
    ],
    finale: 'sejour',
  },
];

for (const decor of DECORS) {
  const { label, rooms, doors, massing } = decor;
  const byId = new Map(rooms.map((room) => [room.id, room]));

  test(`${label} — les pièces ne se chevauchent pas`, () => {
    for (const room of rooms) {
      for (const other of rooms) {
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

  test(`${label} — chaque porte intérieure repose sur un mur de ses deux pièces`, () => {
    for (const door of doors) {
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

  test(`${label} — chaque fenêtre repose sur un mur de sa pièce`, () => {
    for (const door of doors) {
      if (door.kind !== 'window') continue;
      const room = byId.get(door.from || door.to);
      assert.ok(room, `${door.id} n’appartient à aucune pièce`);
      const onWall = roomWalls(room!).some((wall) => projectOnWall(wall, { a: door.a, b: door.b }));
      assert.ok(onWall, `${door.id} ne repose sur aucun mur de ${room!.id}`);
    }
  });

  test(`${label} — une ouverture ne dépasse jamais la hauteur sous plafond`, () => {
    for (const door of doors) {
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
   * porte une peau de mur à l'intérieur de ce polygone : neuf centimètres pour
   * une cloison, trente pour une façade. Résultat, la cuisine était enfoncée
   * d'un tiers dans le mur de façade et le placard d'entrée à moitié dedans. À
   * l'écran ça ne se voit pas comme une erreur — ça se voit comme un meuble trop
   * mince, ce qui est bien pire : on cherche ce qui cloche sans le trouver.
   */
  test(`${label} — aucun meuble n’est enfoncé dans la maçonnerie`, () => {
    const faults: string[] = [];

    for (const item of massing) {
      const room = byId.get(item.roomId);
      assert.ok(room, `mobilier orphelin dans ${item.roomId}`);

      /* Les quatre coins de l'empreinte au sol, pivot compris.
         Le contrôle les calculait sans tenir compte du `yaw` — ce qui allait
         tant qu'aucun meuble n'était pivoté, et devenait faux dès le premier :
         il cherchait le radiateur de la chambre à quarante centimètres de sa
         vraie place. La rotation reprend celle de `furniture()` : le repère du
         plan a son y vers le bas, d'où le signe. */
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
          faults.push(
            `${item.roomId} : coin hors de la pièce en (${corner.x.toFixed(2)}, ${corner.y.toFixed(2)})`,
          );
          continue;
        }
        for (const wall of roomWalls(room!)) {
          const thickness = wallThickness(room!, wall, rooms, WALL_SKIN, WALL_FACADE);
          const gap = distanceToSegment(corner, wall);
          // Un millimètre de tolérance : on compare des flottants.
          if (gap < thickness - 0.001) {
            faults.push(
              `${item.roomId} : un meuble entre de ${(thickness - gap).toFixed(2)} m dans un mur de ${thickness} m`,
            );
          }
        }
      }
      assert.ok(
        (item.base ?? 0) + item.h <= room!.height + 1e-9,
        `un meuble traverse le plafond de ${item.roomId}`,
      );
    }

    assert.deepEqual([...new Set(faults)], [], `\n  ${[...new Set(faults)].join('\n  ')}`);
  });

  test(`${label} — la surface annoncée correspond à la somme des pièces`, () => {
    assert.ok(Math.abs(totalArea(rooms) - decor.area) < 0.1);
  });

  test(`${label} — les légendes annoncent la surface réelle de leur pièce`, () => {
    for (const room of rooms) {
      const caption = decor.captions[room.id];
      assert.ok(caption, `pas de légende pour ${room.id}`);
      const written = Number(caption.title.replace(' m²', '').replace(',', '.'));
      assert.ok(
        Math.abs(written - roomArea(room)) < 0.1,
        `${room.id} : la légende dit ${caption.title}, le plan dit ${roomArea(room).toFixed(1)} m²`,
      );
    }
  });

  test(`${label} — la visite traverse tout le logement sans sortir des murs`, () => {
    const journey = buildJourney(rooms, doors, {
      opening: decor.opening,
      captions: decor.captions,
      closing: decor.closing,
    });

    assert.deepEqual(journey.rooms.map((entry) => entry.roomId), decor.order);

    /* Le mot de la fin tombe dans la plus grande pièce. Ce n'est pas un détail
       de mise en scène : c'est la dernière image du site, et une visite qui se
       termine sur trois mètres carrés de salle d'eau — ou, pour la maison, sur
       neuf mètres carrés de sas face à un placard — annule le bénéfice de tout
       ce qui précède. */
    const closing = journey.captions[journey.captions.length - 1];
    assert.equal(closing.title, decor.closing.title);
    const biggest = [...rooms].sort((a, b) => roomArea(b) - roomArea(a))[0];
    assert.equal(biggest.id, decor.finale);
    const end = sample(journey, 1);
    assert.ok(containsPoint(biggest, end), `la visite doit se terminer dans ${decor.finale}`);

    const openings = doors.filter((door) => door.kind !== 'window');
    const faults: string[] = [];
    for (let step = 0; step <= 3000; step += 1) {
      const t = step / 3000;
      if (t <= journey.doorOpens.to) continue;
      const pose = sample(journey, t);
      if (rooms.some((room) => containsPoint(room, pose))) continue;
      const inDoorway = openings.some(
        (door) => distanceToSegment(pose, { a: door.a, b: door.b }) < 0.25,
      );
      if (!inDoorway) faults.push(`t=${t.toFixed(4)} (${pose.x.toFixed(2)}, ${pose.y.toFixed(2)})`);
    }
    assert.deepEqual(faults, [], `la caméra sort du logement : ${faults.slice(0, 4).join(', ')}`);
  });

  /**
   * Personne ne lit une légende le nez contre un mur.
   *
   * Une légende tient l'écran pendant un dixième du défilement. Pendant tout ce
   * temps l'image ne bouge pas, et c'est donc la seule chose que le visiteur
   * regarde vraiment. Si la caméra fixe une cloison à un mètre, la pièce n'est
   * pas montrée — elle est *décrite*, ce qui est exactement ce qu'on reproche
   * aux annonces.
   *
   * Le contrôle mesure ce que la caméra a devant elle. Deux seuils :
   *
   *  · **1,70 m partout.** Une chambre cadrée en diagonale voit le coin opposé
   *    à deux mètres, et c'est le bon cadrage — on ne peut pas exiger plus sans
   *    interdire les petites pièces. La salle d'eau de l'appartement, cadrée
   *    depuis son embrasure, tient 1,80 m : c'est le plus serré qui soit
   *    légitime.
   *  · **2,50 m dans une pièce sans fenêtre.** Un sas ou un couloir n'a rien à
   *    montrer de lui-même : ce qu'il a à dire est ce qu'il ouvre, donc il doit
   *    porter loin. C'est le défaut qui a fait écrire ce contrôle — l'entrée de
   *    la maison, neuf mètres carrés mais deux mètres quarante de large,
   *    regardait sa penderie à un mètre vingt.
   *
   * L'ouverture est exclue : elle se dit dehors, devant la porte, où le plan ne
   * dit rien de ce qu'on a devant soi.
   */
  test(`${label} — aucune légende ne se lit le nez contre un mur`, () => {
    const journey = buildJourney(rooms, doors, {
      opening: decor.opening,
      captions: decor.captions,
      closing: decor.closing,
    });
    const aveugle = new Set(
      rooms
        .filter((room) => !doors.some((d) => d.kind === 'window' && (d.from === room.id || d.to === room.id)))
        .map((room) => room.id),
    );
    const faults: string[] = [];
    for (const caption of journey.captions) {
      if (caption.title === decor.opening.title) continue;
      const t = (caption.from + caption.to) / 2;
      const pose = sample(journey, t);
      const room = rooms.find((candidate) => containsPoint(candidate, pose));
      const seuil = room && aveugle.has(room.id) ? 2.5 : 1.7;
      const portee = freeRun(rooms, doors, pose, pose.yaw);
      if (portee < seuil) {
        faults.push(`${caption.kicker} : ${portee.toFixed(2)} m devant la caméra, il en faut ${seuil}`);
      }
    }
    assert.deepEqual(faults, [], `\n  ${faults.join('\n  ')}`);
  });

  /**
   * Une pièce qui a un jour se regarde vers son jour.
   *
   * Le contrôle précédent mesure ce que la caméra a **devant** elle, et il ne
   * suffit pas : `freeRun` traverse les ouvertures, si bien que fixer une
   * embrasure de porte donne une portée flatteuse. La suite de la villa en a
   * fait la démonstration — mal classée comme pièce de passage, elle regardait
   * la porte de sa salle d'eau, et le contrôle de portée l'a laissée passer
   * sans broncher. Ce qu'il fallait mesurer n'était pas la distance mais la
   * **direction**.
   *
   * La règle est donc : dans une pièce qui a au moins une fenêtre, il est
   * interdit de les avoir toutes derrière soi. Quatre-vingt-dix degrés, pas
   * moins — le séjour de l'appartement est cadré à cinquante-quatre degrés de
   * sa fenêtre, vers le fond de la cuisine, et c'est un bon cadrage vérifié en
   * image. La suite mal classée, elle, était à cent quatorze.
   *
   * Le mot de la fin est exempté : il ne décrit aucune pièce, il regarde l'axe
   * qui traverse le logement, et c'est tout son intérêt.
   */
  test(`${label} — une pièce qui a un jour n’est pas cadrée dos à ses fenêtres`, () => {
    const journey = buildJourney(rooms, doors, {
      opening: decor.opening,
      captions: decor.captions,
      closing: decor.closing,
    });
    const ecart = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
    const faults: string[] = [];
    for (const caption of journey.captions) {
      if (caption.title === decor.opening.title || caption.title === decor.closing.title) continue;
      const pose = sample(journey, (caption.from + caption.to) / 2);
      const room = rooms.find((candidate) => containsPoint(candidate, pose));
      if (!room) continue;
      const baies = doors.filter(
        (door) => door.kind === 'window' && (door.from === room.id || door.to === room.id),
      );
      if (baies.length === 0) continue;
      const vers = baies.map((baie) => {
        const milieu = { x: (baie.a.x + baie.b.x) / 2, y: (baie.a.y + baie.b.y) / 2 };
        return ecart((Math.atan2(milieu.x - pose.x, -(milieu.y - pose.y)) * 180) / Math.PI, pose.yaw);
      });
      const plusProche = Math.min(...vers);
      if (plusProche > 90) {
        faults.push(`${caption.kicker} : sa fenêtre la plus proche est à ${plusProche.toFixed(0)}° du regard`);
      }
    }
    assert.deepEqual(faults, [], `\n  ${faults.join('\n  ')}`);
  });

  test(`${label} — à tout moment, au plus une légende occupe l’écran`, () => {
    const journey = buildJourney(rooms, doors, {
      opening: decor.opening,
      captions: decor.captions,
      closing: decor.closing,
    });
    for (let step = 0; step <= 800; step += 1) {
      const t = step / 800;
      const visible = journey.captions.filter((caption) => captionOpacity(caption, t) > 0.8);
      assert.ok(visible.length <= 1, `${visible.length} légendes à t=${t.toFixed(3)}`);
    }
  });
}
