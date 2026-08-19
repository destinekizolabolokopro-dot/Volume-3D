import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  area,
  buildJourney,
  captionOpacity,
  describeRoom,
  doorOpening,
  heading,
  lerpAngle,
  metres,
  positionAt,
  sample,
  shortestArc,
  smoothstep,
  tourOrder,
  verticalFov,
  viewAt,
  type Caption,
  type PathPoint,
  type ViewKey,
} from '../lib/journey-path.ts';
import { containsPoint, distanceToSegment, roomWalls } from '../lib/plan.ts';
import type { PlanDoor, PlanRoom } from '../lib/types.ts';

/* Le logement de démonstration, tel qu'il est relevé : un séjour traversant, un
   dégagement d'un mètre quarante, une chambre, une salle d'eau. C'est un vrai
   plan, avec un vrai couloir — c'est justement le couloir qui met la
   trajectoire en difficulté. */
const rooms: PlanRoom[] = [
  {
    id: 'sejour',
    name: 'Séjour & cuisine',
    height: 2.6,
    points: [
      { x: 0, y: 0 },
      { x: 5.2, y: 0 },
      { x: 5.2, y: 4 },
      { x: 0, y: 4 },
    ],
  },
  {
    id: 'degagement',
    name: 'Dégagement',
    height: 2.6,
    points: [
      { x: 5.2, y: 1.2 },
      { x: 6.6, y: 1.2 },
      { x: 6.6, y: 3 },
      { x: 5.2, y: 3 },
    ],
  },
  {
    id: 'chambre',
    name: 'Chambre',
    height: 2.6,
    points: [
      { x: 6.6, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 3.2 },
      { x: 6.6, y: 3.2 },
    ],
  },
  {
    id: 'salle-eau',
    name: 'Salle d’eau',
    height: 2.6,
    points: [
      { x: 6.6, y: 3.2 },
      { x: 8.6, y: 3.2 },
      { x: 8.6, y: 5 },
      { x: 6.6, y: 5 },
    ],
  },
];

const door = (
  id: string,
  from: string,
  to: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
  kind: PlanDoor['kind'] = 'door',
  sill = 0,
): PlanDoor => ({ id, planId: 'plan1', from, to, a, b, kind, height: 2.05, sill });

const doors: PlanDoor[] = [
  door('entree', 'sejour', '', { x: 0, y: 2.4 }, { x: 0, y: 3.3 }),
  door('pd1', 'sejour', 'degagement', { x: 5.2, y: 1.6 }, { x: 5.2, y: 2.5 }, 'opening'),
  door('pd2', 'degagement', 'chambre', { x: 6.6, y: 1.4 }, { x: 6.6, y: 2.3 }),
  door('pd3', 'degagement', 'salle-eau', { x: 6.7, y: 3.2 }, { x: 7.5, y: 3.2 }),
  door('pd4', 'sejour', '', { x: 1, y: 0 }, { x: 3.2, y: 0 }, 'window', 0.85),
  door('pd5', 'chambre', '', { x: 10, y: 0.6 }, { x: 10, y: 2 }, 'window', 0.9),
  door('pd6', 'salle-eau', '', { x: 8.6, y: 3.7 }, { x: 8.6, y: 4.4 }, 'window', 1.2),
];

/* ================================================================= maths === */

test('le plus court arc ne fait jamais le tour', () => {
  assert.equal(shortestArc(10, 350), -20);
  assert.equal(shortestArc(350, 10), 20);
  assert.equal(shortestArc(0, 180), 180);
  assert.equal(shortestArc(0, -180), 180);
  assert.equal(shortestArc(-170, 170), -20);
});

test('l’interpolation d’angle passe par le plus court chemin', () => {
  assert.equal(lerpAngle(350, 10, 0.5), 360);
  assert.equal(lerpAngle(10, 350, 0.5), 0);
  assert.equal(lerpAngle(90, 90, 0.3), 90);
});

test('smoothstep a une dérivée nulle aux deux bouts', () => {
  assert.equal(smoothstep(0), 0);
  assert.equal(smoothstep(1), 1);
  assert.equal(smoothstep(0.5), 0.5);
  // Débordement borné : un curseur hors intervalle ne renvoie pas n'importe quoi.
  assert.equal(smoothstep(-3), 0);
  assert.equal(smoothstep(4), 1);
  // Le début est plus lent que le milieu, c'est tout l'intérêt.
  assert.ok(smoothstep(0.1) < 0.1);
  assert.ok(smoothstep(0.9) > 0.9);
});

test('le cap 0 regarde vers le haut du plan et 90 vers la droite', () => {
  assert.equal(heading({ x: 0, y: 0 }, { x: 0, y: -1 }), 0);
  assert.equal(heading({ x: 0, y: 0 }, { x: 1, y: 0 }), 90);
  assert.equal(heading({ x: 0, y: 0 }, { x: 0, y: 1 }), 180);
  assert.equal(heading({ x: 0, y: 0 }, { x: -1, y: 0 }), -90);
});

test('la position est constante hors de la timeline et linéaire dedans', () => {
  const path: PathPoint[] = [
    { t: 0, x: 0, y: 0 },
    { t: 0.5, x: 10, y: 0 },
    { t: 1, x: 10, y: 4 },
  ];
  assert.deepEqual(positionAt(path, -1), { x: 0, y: 0 });
  assert.deepEqual(positionAt(path, 2), { x: 10, y: 4 });
  assert.deepEqual(positionAt(path, 0.25), { x: 5, y: 0 });
  assert.deepEqual(positionAt(path, 0.75), { x: 10, y: 2 });
});

test('un arrêt immobilise la caméra sans arrêter le curseur', () => {
  const path: PathPoint[] = [
    { t: 0, x: 0, y: 0 },
    { t: 0.3, x: 3, y: 0 },
    { t: 0.7, x: 3, y: 0 },
    { t: 1, x: 6, y: 0 },
  ];
  // Entre 0,3 et 0,7 le curseur avance mais la position ne bouge pas : c'est
  // exactement ce qu'on veut pendant qu'une légende se lit.
  assert.deepEqual(positionAt(path, 0.4), { x: 3, y: 0 });
  assert.deepEqual(positionAt(path, 0.65), { x: 3, y: 0 });
});

test('le regard s’adoucit sur une clé « smooth » et pas sur une « linear »', () => {
  const view: ViewKey[] = [
    { t: 0, yaw: 0, pitch: 0, fov: 60, ease: 'linear' },
    { t: 1, yaw: 100, pitch: 0, fov: 60, ease: 'linear' },
  ];
  assert.equal(viewAt(view, 0.25).yaw, 25);

  const eased: ViewKey[] = [
    { t: 0, yaw: 0, pitch: 0, fov: 60, ease: 'linear' },
    { t: 1, yaw: 100, pitch: 0, fov: 60, ease: 'smooth' },
  ];
  assert.ok(viewAt(eased, 0.25).yaw < 25);
  assert.equal(viewAt(eased, 0.5).yaw, 50);
});

test('une légende monte vite et redescend plus lentement', () => {
  const caption: Caption = {
    id: 'x',
    kicker: 'k',
    title: 't',
    text: 'txt',
    from: 0.2,
    to: 0.6,
  };
  assert.equal(captionOpacity(caption, 0.1), 0);
  assert.equal(captionOpacity(caption, 0.7), 0);
  assert.equal(captionOpacity(caption, 0.4), 1);
  // À distance égale des deux bords, l'entrée est plus avancée que la sortie.
  const distance = 0.02;
  assert.ok(captionOpacity(caption, 0.2 + distance) > captionOpacity(caption, 0.6 - distance));
});

/* ============================================================ description === */

test('les surfaces et longueurs s’écrivent en français', () => {
  assert.equal(area(20.8), '20,8 m²');
  assert.equal(area(12), '12 m²');
  assert.equal(area(12.04), '12 m²');
  assert.equal(metres(2.6), '2,60 m');
});

test('une pièce se décrit par ce qui a été mesuré, jamais par un adjectif', () => {
  const sejour = describeRoom(rooms[0], doors);
  assert.equal(sejour.kicker, 'Séjour & cuisine');
  assert.equal(sejour.title, '20,8 m²');
  assert.match(sejour.text, /Une fenêtre de 2,20 m\./);
  assert.match(sejour.text, /2,60 m/);

  // Le dégagement n'a pas d'ouverture : on le dit, on n'invente pas une clarté.
  const couloir = describeRoom(rooms[1], doors);
  assert.match(couloir.text, /Aucune ouverture sur l’extérieur\./);
});

test('plusieurs fenêtres sont additionnées', () => {
  const deux = describeRoom(rooms[2], [
    ...doors,
    door('pd7', 'chambre', '', { x: 10, y: 2.4 }, { x: 10, y: 3 }, 'window', 0.9),
  ]);
  assert.match(deux.text, /2 fenêtres, 2,00 m d'ouverture au total\./);
});

/* =============================================================== parcours === */

test('la visite descend en profondeur et repasse par le dégagement', () => {
  const legs = tourOrder('sejour', rooms, doors);
  assert.deepEqual(
    legs.map((leg) => leg.roomId),
    ['sejour', 'degagement', 'chambre', 'degagement', 'salle-eau'],
  );
  // La chambre passe avant la salle d'eau : à l'embranchement, la plus grande
  // pièce d'abord.
  assert.equal(legs[2].roomId, 'chambre');
  assert.equal(legs[3].revisit, true);
  // Le retour final est coupé : on ne raccompagne pas le visiteur à l'entrée.
  assert.equal(legs[legs.length - 1].roomId, 'salle-eau');
});

test('une pièce isolée n’est pas visitée', () => {
  const isolee: PlanRoom = {
    id: 'cave',
    name: 'Cave',
    height: 2,
    points: [
      { x: 20, y: 20 },
      { x: 22, y: 20 },
      { x: 22, y: 22 },
      { x: 20, y: 22 },
    ],
  };
  const legs = tourOrder('sejour', [...rooms, isolee], doors);
  assert.ok(!legs.some((leg) => leg.roomId === 'cave'));
});

test('la timeline part de l’extérieur et traverse les quatre pièces', () => {
  const journey = buildJourney(rooms, doors);
  assert.ok(journey.entrance, 'la porte palière doit être reconnue');
  assert.equal(journey.entrance?.roomId, 'sejour');
  // On commence dehors : au-delà du mur x = 0, donc en x négatif.
  assert.ok(journey.entrance!.outside.x < 0);

  assert.deepEqual(
    journey.rooms.map((entry) => entry.roomId),
    ['sejour', 'degagement', 'chambre', 'salle-eau'],
  );
  // Les instants d'arrivée sont croissants et tiennent dans la timeline.
  const times = journey.rooms.map((entry) => entry.t);
  for (let i = 1; i < times.length; i += 1) assert.ok(times[i] > times[i - 1]);
  assert.ok(times[times.length - 1] < 1);
});

test('les repères de la timeline sont ordonnés et normalisés', () => {
  const journey = buildJourney(rooms, doors);
  for (const track of [journey.path, journey.view]) {
    assert.ok(track.length > 4);
    assert.ok(track[0].t >= 0);
    assert.ok(Math.abs(track[track.length - 1].t - 1) < 1e-9);
    for (let i = 1; i < track.length; i += 1) {
      assert.ok(track[i].t >= track[i - 1].t, 'les repères doivent être croissants');
    }
  }
});

test('la porte est grande ouverte à l’instant où on la franchit', () => {
  const journey = buildJourney(rooms, doors);
  const { from, to } = journey.doorOpens;
  assert.ok(to > from);
  assert.equal(doorOpening(journey, from), 0);
  assert.ok(doorOpening(journey, to) > 0.999);
  // Elle reste fermée pendant qu'on lit le panneau d'accueil, dehors.
  assert.equal(doorOpening(journey, 0), 0);
  assert.ok(doorOpening(journey, (from + to) / 2) > 0.2);

  // Au moment du franchissement, la caméra est bien sur le seuil.
  const crossing = sample(journey, to);
  assert.ok(Math.abs(crossing.x) < 0.05, 'x devrait être sur le mur d’entrée');
});

/**
 * Le contrôle qui compte.
 *
 * On échantillonne la timeline très finement et on vérifie qu'à aucun instant
 * la caméra ne se trouve hors des pièces. Une caméra qui traverse un mur, même
 * un dixième de seconde, détruit la seule chose que ce produit vend : la
 * crédibilité du volume.
 *
 * Deux tolérances, et elles sont justifiées : le début du parcours est dehors,
 * devant la porte ; et un passage d'ouverture longe forcément les jambages, on
 * ne peut donc pas exiger de marge aux murs à cet endroit-là.
 */
test('la caméra ne sort jamais du logement une fois entrée', () => {
  const journey = buildJourney(rooms, doors);
  const entered = journey.doorOpens.to;
  const openings = doors.filter((d) => d.kind !== 'window');

  const faults: string[] = [];
  for (let step = 0; step <= 2000; step += 1) {
    const t = step / 2000;
    if (t <= entered) continue;
    const pose = sample(journey, t);
    const inside = rooms.some((room) => containsPoint(room, pose));
    if (inside) continue;
    // Toléré uniquement si l'on est en train de franchir une ouverture.
    const inDoorway = openings.some((opening) => distanceToSegment(pose, { a: opening.a, b: opening.b }) < 0.2);
    if (!inDoorway) faults.push(`t=${t.toFixed(4)} (${pose.x.toFixed(2)}, ${pose.y.toFixed(2)})`);
  }
  assert.deepEqual(faults, [], `la caméra est sortie du bâti : ${faults.slice(0, 5).join(', ')}`);
});

test('la caméra ne frôle jamais un mur plein', () => {
  const journey = buildJourney(rooms, doors);
  const entered = journey.doorOpens.to;
  const openings = doors.filter((d) => d.kind !== 'window');

  let worst = Infinity;
  for (let step = 0; step <= 1000; step += 1) {
    const t = step / 1000;
    if (t <= entered) continue;
    const pose = sample(journey, t);
    const room = rooms.find((candidate) => containsPoint(candidate, pose));
    if (!room) continue;
    for (const wall of roomWalls(room)) {
      const gap = distanceToSegment(pose, wall);
      // Un mur percé d'une ouverture au droit de la caméra n'est pas un mur.
      const pierced = openings.some(
        (opening) => distanceToSegment(pose, { a: opening.a, b: opening.b }) < 0.7,
      );
      if (!pierced) worst = Math.min(worst, gap);
    }
  }
  assert.ok(worst > 0.25, `la caméra passe à ${worst.toFixed(3)} m d’un mur`);
});

/*
 * La vitesse se contrôle sur la timeline, pas sur un échantillonnage.
 *
 * Première version de ce test : échantillonner la pose tous les 1/400 et
 * comparer les pas. Elle ne mesurait rien — les intervalles qui chevauchent le
 * bord d'un arrêt ne contiennent qu'une fraction de marche, donc le rapport
 * max/min ne parlait que de la finesse de l'échantillonnage. La bonne question
 * est celle-ci : chaque tronçon parcouru couvre-t-il une part du curseur
 * proportionnelle à sa longueur ?
 */
test('la marche avance à vitesse constante d’un bout à l’autre', () => {
  const journey = buildJourney(rooms, doors);
  const speeds: number[] = [];
  for (let i = 1; i < journey.path.length; i += 1) {
    const a = journey.path[i - 1];
    const b = journey.path[i];
    const walked = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked < 1e-9) continue; // un arrêt : le curseur avance, pas la caméra
    speeds.push(walked / (b.t - a.t));
  }
  assert.ok(speeds.length > 10);
  const max = Math.max(...speeds);
  const min = Math.min(...speeds);
  assert.ok((max - min) / max < 1e-9, `écart de vitesse ${(max / min).toFixed(4)}`);
});

test('un plan sans porte palière commence quand même, dans la plus grande pièce', () => {
  const sansEntree = doors.filter((d) => d.id !== 'entree');
  const journey = buildJourney(rooms, sansEntree);
  assert.equal(journey.entrance, null);
  assert.deepEqual(journey.doorOpens, { from: 0, to: 0 });
  assert.equal(journey.rooms[0].roomId, 'sejour');
  assert.ok(journey.metres > 5);
});

test('un plan vide ne fait pas tomber la construction', () => {
  const journey = buildJourney([], []);
  assert.deepEqual(journey.path, []);
  assert.equal(journey.metres, 0);
  assert.deepEqual(sample(journey, 0.5), { x: 0, y: 0, yaw: 0, pitch: -4, fov: 72 });
});

test('les légendes écrites à la main priment sur la description automatique', () => {
  const journey = buildJourney(rooms, doors, {
    opening: { kicker: 'Le Marais', title: 'Bienvenue', text: 'Poussez la porte.' },
    captions: { chambre: { kicker: 'Chambre', title: 'Au calme', text: 'Sur cour.' } },
    closing: { kicker: 'Fin', title: 'Voilà', text: 'C’est tout.' },
  });
  const chambre = journey.captions.find((caption) => caption.title === 'Au calme');
  assert.ok(chambre, 'la légende manuelle doit être retenue');
  assert.equal(chambre!.text, 'Sur cour.');
  assert.equal(journey.captions[0].title, 'Bienvenue');
  assert.equal(journey.captions[journey.captions.length - 1].title, 'Voilà');
});

test('les légendes ne se chevauchent pas au point d’être illisibles', () => {
  const journey = buildJourney(rooms, doors);
  // Deux légendes peuvent se croiser en fondu, mais jamais être pleines
  // toutes les deux en même temps.
  for (let step = 0; step <= 600; step += 1) {
    const t = step / 600;
    const full = journey.captions.filter((caption) => captionOpacity(caption, t) > 0.85);
    assert.ok(full.length <= 1, `${full.length} légendes pleines à t=${t.toFixed(3)}`);
  }
});

test('une photo au mur attire le regard plus qu’une fenêtre', () => {
  const walls = roomWalls(rooms[2]);
  // Mur 2 de la chambre : le mur du fond, sans fenêtre — la fenêtre est sur le mur 1.
  const avec = buildJourney(rooms, doors, { photos: [{ roomId: 'chambre', wallIndex: 2 }] });
  const sans = buildJourney(rooms, doors);
  const at = (journey: ReturnType<typeof buildJourney>) => {
    const arrival = journey.rooms.find((entry) => entry.roomId === 'chambre')!.t;
    // Au milieu de l'arrêt, le regard est posé sur sa cible.
    return sample(journey, arrival + 0.02).yaw;
  };
  assert.ok(walls.length === 4);
  assert.notEqual(Math.round(at(avec)), Math.round(at(sans)));
});

test('le champ de vision s’élargit sur un écran étroit, et pas au-delà du raisonnable', () => {
  // Le format de référence ne change rien.
  assert.equal(verticalFov(74, 16 / 9), 74);

  /* Écran plus large que le 16/9 : le champ vertical se **resserre**, pour que
     la largeur vue reste la même. Sans cela, la scène de la visite livrée — deux
     fois et demie sa hauteur — atteignait cent vingt-deux degrés d'horizontale,
     et la pièce se lisait comme un couloir courbe. */
  const large = verticalFov(72, 2.5);
  assert.ok(large < 72, `le champ devrait se resserrer, il vaut ${large}`);
  const demiLargeur = (fov: number, aspect: number) => Math.tan((fov * Math.PI) / 360) * aspect;
  assert.ok(Math.abs(demiLargeur(large, 2.5) - demiLargeur(72, 16 / 9)) < 1e-9);

  // Téléphone tenu debout : le champ vertical s'ouvre pour que la largeur tienne.
  const phone = verticalFov(74, 390 / 720);
  assert.ok(phone > 74, `le champ devrait s’élargir, il vaut ${phone}`);
  assert.ok(phone <= 96, 'le champ ne doit pas dépasser le plafond');

  // À largeur constante : la demi-largeur vue reste la même tant qu'on n'a pas
  // touché le plafond.
  const halfWidth = (fov: number, aspect: number) => Math.tan((fov * Math.PI) / 360) * aspect;
  const gentle = verticalFov(50, 1.2);
  assert.ok(Math.abs(halfWidth(gentle, 1.2) - halfWidth(50, 16 / 9)) < 1e-9);

  // Une valeur absurde ne fait pas tomber le rendu.
  assert.equal(verticalFov(74, 0), 74);
  assert.equal(verticalFov(74, Number.NaN), 74);
});

test('dans un couloir, on regarde le fond et non le mur qu’on longe', () => {
  /*
   * Le dégagement fait 1,40 m de large sur 1,80 m de long. Le mur le plus long
   * est celui qu'on longe : à soixante-dix centimètres, il occupe cent trente
   * degrés et l'image devient un pan de peinture — c'est exactement ce que
   * faisait le parcours avant que le cadrage ne tienne compte de la distance.
   *
   * On vérifie ce qui se voit vraiment : au milieu de l'arrêt, le rayon parti de
   * l'œil doit franchir plus d'un mètre avant de rencontrer un mur.
   */
  const journey = buildJourney(rooms, doors);
  const arret = journey.rooms.find((entry) => entry.roomId === 'degagement');
  assert.ok(arret, 'le dégagement doit être visité');

  const pose = sample(journey, arret.t + 0.015);
  const salle = rooms.find((room) => room.id === 'degagement')!;

  // Marche avant le long du regard jusqu'à sortir de la pièce.
  const step = 0.02;
  const dx = Math.sin((pose.yaw * Math.PI) / 180);
  const dy = -Math.cos((pose.yaw * Math.PI) / 180);
  let portee = 0;
  for (let d = step; d <= 6; d += step) {
    const point = { x: pose.x + dx * d, y: pose.y + dy * d };
    if (!containsPoint(salle, point) && !rooms.some((room) => containsPoint(room, point))) break;
    portee = d;
  }
  assert.ok(portee > 1, `le regard bute à ${portee.toFixed(2)} m : c'est un mur en gros plan`);
});
test('le regard ne bute jamais sur un mur pendant qu’on marche', () => {
  /*
   * Un demi-tour de cent soixante-dix degrés fait à l'arrêt, dans une chambre de
   * onze mètres carrés, balaie forcément un mur à moins de deux mètres : le
   * visiteur qui s'arrête de faire défiler à cet instant a devant lui un aplat
   * de peinture. Le virage se fait donc en marchant, et c'est ce qu'on vérifie
   * ici — hors des arrêts, où une petite pièce est légitimement proche.
   */
  const journey = buildJourney(rooms, doors, { closing: { kicker: 'k', title: 't', text: 'x' } });

  /** Distance parcourue par le regard avant de sortir du logement. */
  const reach = (t: number) => {
    const pose = sample(journey, t);
    const dx = Math.sin((pose.yaw * Math.PI) / 180);
    const dy = -Math.cos((pose.yaw * Math.PI) / 180);
    let seen = 0;
    for (let step = 0.05; step <= 12; step += 0.05) {
      const point = { x: pose.x + dx * step, y: pose.y + dy * step };
      if (!rooms.some((room) => containsPoint(room, point))) break;
      seen = step;
    }
    return seen;
  };

  /* On ne juge que la marche. À l'arrêt, une salle d'eau de trois mètres carrés
     est proche par nature et on ne lui demande pas de profondeur ; c'est le
     balayage en mouvement qui doit garder quelque chose à regarder. L'arrêt se
     reconnaît à ce qu'il est : la position n'y bouge pas. */
  const parked = (t: number) => {
    const here = positionAt(journey.path, t);
    const soon = positionAt(journey.path, Math.min(1, t + 0.004));
    return Math.hypot(soon.x - here.x, soon.y - here.y) < 1e-6;
  };

  const dehors = journey.doorOpens.to;
  let pire = { t: 0, d: 99 };
  let serres = 0;
  let mesures = 0;
  for (let index = 0; index <= 400; index += 1) {
    const t = index / 400;
    if (t < dehors || parked(t)) continue;
    const d = reach(t);
    mesures += 1;
    if (d < 1.5) serres += 1;
    if (d < pire.d) pire = { t, d };
  }

  /* Deux seuils, parce qu'il y a deux défauts distincts.
     Le nez au mur : à moins de quatre-vingt-dix centimètres, il n'y a plus
     d'image du tout. Un virage à angle droit dans un couloir d'un mètre
     quarante passe légitimement près — un humain qui tourne là voit le mur,
     lui aussi — mais il ne s'y arrête pas. */
  assert.ok(
    pire.d > 0.9,
    `à t=${pire.t.toFixed(3)} le regard bute à ${pire.d.toFixed(2)} m : c’est le nez au mur`,
  );

  /* Le mur tenu : c'est celui-là qui abîmait la visite. Un virage sur place au
     milieu d'une chambre y passait un dixième du parcours. */
  const part = serres / mesures;
  assert.ok(
    part < 0.12,
    `${Math.round(part * 100)} % de la marche se fait à moins d’un mètre cinquante d’un mur`,
  );
});
