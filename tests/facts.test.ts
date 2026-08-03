import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FACT_QUESTIONS,
  factsForAssistant,
  factsForDescription,
  mergeFacts,
  parseFactAnswers,
  reviewFacts,
  visualQuestions,
} from '../lib/facts.ts';
import type { PropertyFact } from '../lib/types.ts';

const fact = (key: string, value: string, source: PropertyFact['source'] = 'proprietaire'): PropertyFact => ({
  key,
  value,
  source,
});

/** Toutes les réponses obligatoires, confirmées par le propriétaire. */
const complete = (): PropertyFact[] =>
  FACT_QUESTIONS.filter((question) => question.required).map((question) => fact(question.key, 'réponse'));

test('visualQuestions ne retient que ce qui se lit sur une photo', () => {
  const keys = visualQuestions().map((question) => question.key);
  assert.ok(keys.includes('meuble'));
  assert.ok(keys.includes('equipements'));
  // Aucune photo ne dit où se trouve le logement.
  assert.ok(!keys.includes('adresse'));
  assert.ok(!keys.includes('proximite'));
});

test('mergeFacts ne laisse jamais l’IA écraser le propriétaire', () => {
  const existing = [fact('meuble', 'Entièrement meublé')];
  const merged = mergeFacts(existing, [fact('meuble', 'Non meublé', 'ia')]);
  assert.equal(merged[0].value, 'Entièrement meublé');
  assert.equal(merged[0].source, 'proprietaire');
});

test('mergeFacts laisse le propriétaire corriger l’IA', () => {
  const existing = [fact('meuble', 'Non meublé', 'ia')];
  const merged = mergeFacts(existing, [fact('meuble', 'Entièrement meublé')]);
  assert.equal(merged[0].value, 'Entièrement meublé');
  assert.equal(merged[0].source, 'proprietaire');
});

test('mergeFacts ignore les clés inconnues et garde l’ordre du catalogue', () => {
  const merged = mergeFacts([], [fact('inventee', 'x'), fact('adresse', 'Lyon 3e'), fact('meuble', 'Meublé')]);
  assert.deepEqual(
    merged.map((entry) => entry.key),
    ['meuble', 'adresse'],
  );
});

test('reviewFacts distingue ce qui manque de ce qui attend confirmation', () => {
  const review = reviewFacts([fact('meuble', 'Entièrement meublé', 'ia'), fact('adresse', 'Lyon 3e')]);
  assert.ok(review.toConfirm.some((question) => question.key === 'meuble'));
  assert.ok(review.unanswered.some((question) => question.key === 'couchages'));
  assert.ok(!review.unanswered.some((question) => question.key === 'adresse'));
  assert.equal(review.ready, false);
});

test('reviewFacts n’est prêt qu’avec des réponses confirmées', () => {
  const answers = complete();
  assert.equal(reviewFacts(answers).ready, true);
  assert.equal(reviewFacts(answers).progress, 1);

  // La même fiche, mais une réponse vient de l'IA : pas prête.
  const withGuess = answers.map((entry, index) => (index === 0 ? { ...entry, source: 'ia' as const } : entry));
  assert.equal(reviewFacts(withGuess).ready, false);
  assert.ok(reviewFacts(withGuess).progress < 1);
});

test('factsForAssistant n’expose que les réponses confirmées', () => {
  const text = factsForAssistant([
    fact('adresse', 'Lyon 3e, quartier Part-Dieu'),
    fact('couchages', '4 personnes', 'ia'),
  ]);
  assert.ok(text.includes('Lyon 3e'));
  // Une supposition de l'IA n'a rien à faire dans une réponse au voyageur.
  assert.ok(!text.includes('4 personnes'));
});

test('factsForDescription compose un paragraphe lisible', () => {
  const text = factsForDescription([
    fact('meuble', 'Entièrement meublé'),
    fact('couchages', '4'),
    fact('equipements', 'Lave-linge, Wi-Fi'),
    fact('adresse', 'Lyon 3e'),
    fact('proximite', 'métro à 3 minutes, marché le dimanche'),
    fact('particularites', 'Vue dégagée sur les toits'),
  ]);
  assert.equal(
    text,
    'Entièrement meublé, 4 couchages. Équipements : Lave-linge, Wi-Fi. Lyon 3e. À proximité : métro à 3 minutes, marché le dimanche. Vue dégagée sur les toits.',
  );
});

test('factsForDescription ne rend rien sans réponse confirmée', () => {
  assert.equal(factsForDescription([fact('meuble', 'Meublé', 'ia')]), '');
});

/* -------------------------------- lecture des réponses rendues par le modèle */

test('parseFactAnswers refuse une option hors catalogue', () => {
  const facts = parseFactAnswers({ answers: [{ key: 'meuble', value: 'Un peu meublé' }] });
  // Plutôt aucune réponse qu'une réponse déformée : le propriétaire tranchera.
  assert.deepEqual(facts, []);
});

test('parseFactAnswers normalise la casse des options', () => {
  const facts = parseFactAnswers({ answers: [{ key: 'salle-eau', value: 'douche' }] });
  assert.deepEqual(facts, [{ key: 'salle-eau', value: 'Douche', source: 'ia' }]);
});

test('parseFactAnswers ne garde que les options connues d’un choix multiple', () => {
  const facts = parseFactAnswers({
    answers: [{ key: 'equipements', value: 'Lave-linge, jacuzzi, Wi-Fi, Lave-linge' }],
  });
  assert.deepEqual(facts, [{ key: 'equipements', value: 'Lave-linge, Wi-Fi', source: 'ia' }]);
});

test('parseFactAnswers écarte les questions que les photos ne peuvent pas trancher', () => {
  // L'adresse n'est pas une question visuelle : le modèle n'a pas à y répondre.
  assert.deepEqual(parseFactAnswers({ answers: [{ key: 'adresse', value: 'Lyon 3e' }] }), []);
  assert.deepEqual(parseFactAnswers({ answers: [{ key: 'inventee', value: 'x' }] }), []);
});

test('parseFactAnswers tolère une réponse vide ou mal formée', () => {
  assert.deepEqual(parseFactAnswers({}), []);
  assert.deepEqual(parseFactAnswers({ answers: 'non' }), []);
  assert.deepEqual(parseFactAnswers({ answers: [{ key: 'meuble', value: '  ' }] }), []);
});
