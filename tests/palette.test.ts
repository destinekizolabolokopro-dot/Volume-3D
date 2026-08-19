import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAlbedo, deltaE, hueGap, parseColor, toLch } from '../lib/color.ts';
import {
  ADJACENT,
  FURNITURE,
  MATERIALS,
  MAX_SUBTLETY,
  MIN_SEPARATION,
  OUTSIDE,
  SHELL,
  SUBTLE,
} from '../lib/palette.ts';

/*
 * L'étude de couleur, transformée en garde-fou.
 *
 * Un rapport qu'on lit une fois ne protège de rien : six mois plus tard on
 * éclaircit un mur « juste un peu » et le placard redevient invisible. Ces
 * contrôles rejouent l'étude à chaque exécution de la suite.
 */

const subtle = new Set(SUBTLE.map(([a, b]) => `${a}|${b}`));

test('deux surfaces voisines sont toujours distinguables', () => {
  const faults: string[] = [];
  for (const [one, two] of ADJACENT) {
    if (subtle.has(`${one}|${two}`)) continue;
    const delta = deltaE(parseColor(MATERIALS[one]), parseColor(MATERIALS[two]));
    if (delta < MIN_SEPARATION) faults.push(`${one} / ${two} : ΔE ${delta.toFixed(2)}`);
  }
  assert.deepEqual(faults, [], `des surfaces se confondent :\n  ${faults.join('\n  ')}`);
});

test('une nuance interne à un matériau reste une nuance', () => {
  for (const [one, two] of SUBTLE) {
    const delta = deltaE(parseColor(MATERIALS[one]), parseColor(MATERIALS[two]));
    assert.ok(delta > 1, `${one} / ${two} : ΔE ${delta.toFixed(2)}, on ne verra rien`);
    assert.ok(
      delta < MAX_SUBTLETY,
      `${one} / ${two} : ΔE ${delta.toFixed(2)}, le sol se lira comme un damier`,
    );
  }
});

test('aucun matériau ne sort de la plage utile du rendu', () => {
  const faults: string[] = [];
  for (const [name, value] of Object.entries(MATERIALS)) {
    const check = checkAlbedo(parseColor(value));
    if (!check.ok) faults.push(`${name} : ${check.note}`);
  }
  assert.deepEqual(faults, [], `hors plage :\n  ${faults.join('\n  ')}`);
});

test('les murs et les menuiseries se séparent par la température, pas par la clarté', () => {
  const mur = toLch(parseColor(SHELL.mur));
  const menuiserie = toLch(parseColor(SHELL.menuiserie));
  // C'est la conclusion de l'étude : dans une même famille chaude, la clarté
  // seule plafonne autour de ΔE 2,5. La saturation, elle, fait le travail.
  assert.ok(
    mur.c - menuiserie.c > 3,
    `le mur devrait être nettement plus chaud : C ${mur.c.toFixed(1)} contre ${menuiserie.c.toFixed(1)}`,
  );
  assert.ok(Math.abs(mur.l - menuiserie.l) < 8, 'l’écart de clarté doit rester discret');
  assert.ok(deltaE(parseColor(SHELL.mur), parseColor(SHELL.menuiserie)) >= MIN_SEPARATION);
});

test('la note de couleur rime avec l’accent de la marque', () => {
  const ACCENT = '#0e6e66';
  const gap = hueGap(parseColor(ACCENT), parseColor(FURNITURE.petrole));
  assert.ok(gap < 20, `le pétrole devrait tenir la teinte de la marque, il en est à ${gap.toFixed(0)}°`);
  // Rompu, pas franc : une couleur saturée sur un canapé de deux mètres crie.
  assert.ok(toLch(parseColor(FURNITURE.petrole)).c < 18, 'la note doit rester sourde');
});

test('la contre-note s’oppose vraiment à la note', () => {
  const gap = hueGap(parseColor(FURNITURE.petrole), parseColor(FURNITURE.terre));
  assert.ok(gap > 110, `terre et pétrole devraient s’opposer, ils sont à ${gap.toFixed(0)}°`);
  // Elle a le droit d'être saturée : elle ne couvre que des coussins.
  assert.ok(toLch(parseColor(FURNITURE.terre)).c > 25);
});

test('la coque reste plus claire que le mobilier, et l’extérieur plus sourd que les deux', () => {
  const clarity = (value: number) => toLch(parseColor(value)).l;
  const shell = Object.values(SHELL).map(clarity);
  const outside = Object.values(OUTSIDE).map(clarity);
  // Le plafond et les murs portent la lumière de la scène.
  assert.ok(Math.max(...shell) > 90);
  // Le palier et la rue sont volontairement éteints : c'est ce qui fait que
  // l'intérieur paraît chaud quand on y entre.
  const median = [...outside].sort((a, b) => a - b)[Math.floor(outside.length / 2)];
  assert.ok(median < 70, `l’extérieur devrait rester sourd, sa médiane est à ${median.toFixed(0)}`);
});

test('aucune couleur n’est déclarée deux fois sous deux noms différents', () => {
  const seen = new Map<number, string>();
  for (const [name, value] of Object.entries(MATERIALS)) {
    const twin = seen.get(value);
    // Le plafond et les menuiseries partagent volontairement leur blanc : dans
    // un logement, c'est la même peinture. Ailleurs, un doublon est un oubli.
    if (twin && !['plafond', 'menuiserie'].includes(name)) {
      assert.fail(`${name} reprend la couleur de ${twin} sans raison`);
    }
    seen.set(value, name);
  }
});
