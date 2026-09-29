import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  articlesCites,
  articlesHorsDuDetail,
  articlesInventes,
  delaiAnnonce,
  jargonDansLeClair,
  juger,
  normaliserLeNumero,
  ordreDesIntertitres,
  ordreRespecte,
  sections,
  jugerLesMots,
} from '../lib/bareme.ts';

/**
 * Le barème juge les réponses du modèle. S'il juge mal, il fait pire que rien :
 * il donne la certitude que tout va bien pendant qu'un délai disparaît. Ces
 * tests le jugent lui.
 */

const BONNE = [
  'En clair :',
  'Oui, vous pouvez donner congé, mais pas n’importe quand ni pour n’importe quoi.',
  '',
  'Ce que je ferais :',
  '— Vérifier la date anniversaire du bail.',
  '— Écrire au locataire en recommandé.',
  '',
  'Le délai :',
  'Six mois avant l’échéance. À partir de la réception du courrier.',
  '',
  'Le détail juridique :',
  'L’article 15 de la loi du 6 juillet 1989 impose ce préavis, et la clause résolutoire ne s’y applique pas.',
].join('\n');

/* ----------------------------------------------------------- la structure --- */

test('les quatre sections sont retrouvées', () => {
  const trouvees = sections(BONNE);
  assert.ok(trouvees.has('en clair'));
  assert.ok(trouvees.has('le delai'));
  assert.match(trouvees.get('le delai') ?? '', /Six mois/);
});

test('l’ordre du socle est reconnu', () => {
  assert.equal(ordreRespecte(BONNE), true);
  assert.deepEqual(ordreDesIntertitres(BONNE), [
    'en clair',
    'ce que je ferais',
    'le delai',
    'le detail juridique',
  ]);
});

test('le détail placé avant le délai est un désordre', () => {
  /* Ce n'est pas une question de goût : cela ferait lire l'article à
     quelqu'un qui cherche une date. */
  const inverse = ['En clair :', 'Oui.', 'Le détail juridique :', 'Article 15.', 'Le délai :', 'Six mois.'].join('\n');
  assert.equal(ordreRespecte(inverse), false);
});

test('sauter une section n’est pas un désordre', () => {
  /* Le socle l'autorise pour une question factuelle : les intertitres
     intermédiaires n'ont alors rien à dire. */
  const factuelle = ['En clair :', 'Oui, il est obligatoire.', 'Le détail juridique :', 'Article 3-3.'].join('\n');
  assert.equal(ordreRespecte(factuelle), true);
});

/* -------------------------------------------------------------- le jargon --- */

test('le jargon du détail juridique est permis', () => {
  /* « clause résolutoire » est le terme juste, et le détail existe pour
     l'employer. Il n'est interdit qu'avant. */
  assert.deepEqual(jargonDansLeClair(BONNE), []);
});

test('le jargon dans « En clair » est relevé', () => {
  const fautif = BONNE.replace('Oui, vous pouvez donner congé', 'Oui, sous réserve du préavis');
  assert.deepEqual(jargonDansLeClair(fautif), ['préavis']);
});

test('l’accent et la casse ne cachent pas un mot interdit', () => {
  const fautif = ['En clair :', 'La Clause Résolutoire joue.', 'Le détail juridique :', 'x'].join('\n');
  assert.deepEqual(jargonDansLeClair(fautif), ['clause résolutoire']);
});

/* ------------------------------------------------------------ les articles --- */

test('un article est reconnu sous ses différentes formes', () => {
  const texte = [
    'Le détail juridique :',
    'Les articles L. 221-18 et R*111-2 s’appliquent, ainsi que l’article 15.',
  ].join('\n');
  const numeros = articlesCites(texte).map((a) => a.numero);
  assert.ok(numeros.includes('L221-18'), numeros.join(','));
  assert.ok(numeros.includes('15'), numeros.join(','));
});

test('« L. 221-18 » et « L221-18 » sont le même article', () => {
  assert.equal(normaliserLeNumero('L. 221-18'), normaliserLeNumero('L221-18'));
});

test('un article cité hors du détail est relevé', () => {
  const fautif = BONNE.replace('Six mois avant l’échéance.', 'Six mois, article 15.');
  assert.deepEqual(articlesHorsDuDetail(fautif), ['15']);
});

test('un article absent des textes joints est un article inventé', () => {
  /* La vérification la plus importante du barème : un numéro faux a la forme
     exacte d'un vrai, et il sera recopié dans un courrier. */
  assert.deepEqual(articlesInventes(BONNE, ['22', '1719']), ['15']);
  assert.deepEqual(articlesInventes(BONNE, ['15', '22']), []);
});

test('les trois articles vérifiés du socle sont admis', () => {
  const texte = ['Le détail juridique :', 'L’article 226-4-2 du code pénal punit ce fait.'].join('\n');
  assert.deepEqual(articlesInventes(texte, []), []);
});

/* --------------------------------------------------------------- le délai --- */

test('un délai chiffré est reconnu', () => {
  assert.equal(delaiAnnonce(BONNE), true);
});

test('« c’est déjà trop tard » est un délai', () => {
  const texte = ['Le délai :', 'C’est déjà trop tard pour contester.'].join('\n');
  assert.equal(delaiAnnonce(texte), true);
});

test('une section de délai vide ou absente ne compte pas', () => {
  assert.equal(delaiAnnonce(['Le délai :', ''].join('\n')), false);
  assert.equal(delaiAnnonce('En clair :\nOui.'), false);
});

/* -------------------------------------------------------------- le verdict --- */

test('une bonne réponse ne produit aucun manquement', () => {
  assert.deepEqual(juger(BONNE, { delai: true, doitContenir: ['congé'] }, ['15']), []);
});

test('chaque manquement se nomme et se situe', () => {
  const fautive = ['En clair :', 'Le préavis court, article 99.'].join('\n');
  const manques = juger(fautive, { delai: true }, ['15']);
  const regles = manques.map((m) => m.regle);
  assert.ok(regles.includes('jargon'), regles.join(','));
  assert.ok(regles.includes('article inventé'), regles.join(','));
  assert.ok(regles.includes('article hors du détail'), regles.join(','));
  assert.ok(regles.includes('délai'), regles.join(','));
  assert.ok(regles.includes('structure'), regles.join(','));
  /* Une liste, pas un score : un pourcentage ne se corrige pas. */
  for (const manque of manques) assert.ok(manque.detail.length > 5, manque.regle);
});

test('un mot attendu manquant est relevé, accents compris', () => {
  const manques = juger(BONNE, { doitContenir: ['echeance'] }, ['15']);
  assert.deepEqual(manques, []);
  assert.equal(juger(BONNE, { doitContenir: ['indivision'] }, ['15']).length, 1);
});

test('un mot interdit présent est relevé', () => {
  const manques = juger(BONNE, { neDoitPasContenir: ['changer la serrure'] }, ['15']);
  assert.deepEqual(manques, []);
  assert.equal(juger(BONNE, { neDoitPasContenir: ['congé'] }, ['15']).length, 1);
});

test('le jugement des seuls mots n’exige aucune forme', () => {
  /* La réponse écrite par le site quand aucune spécialité n'est reconnue n'a
     ni intertitres ni articles, et c'est voulu : lui réclamer un « détail
     juridique » serait exiger la forme d'une consultation d'un texte qui
     explique justement qu'il n'y en aura pas. */
  const sansForme = 'Je n’ai pas reconnu de spécialité. Cet assistant ne traite que le droit immobilier.';
  assert.deepEqual(jugerLesMots(sansForme, { doitContenir: ['droit immobilier'] }), []);
  assert.ok(juger(sansForme, { doitContenir: ['droit immobilier'] }, []).length > 0);
});
