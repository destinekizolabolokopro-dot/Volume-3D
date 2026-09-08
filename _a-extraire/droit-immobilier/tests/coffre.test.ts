import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.AUTH_SECRET = 'un-secret-de-test-suffisamment-long';

const { desceller, memeSecret, sceller } = await import('../lib/coffre.ts');
const { empreinte } = await import('../lib/reglages-empreinte.ts');

/**
 * Le coffre garde une clé d'API, c'est-à-dire un moyen de paiement. Ces tests
 * décrivent surtout ce qu'il REFUSE : un scellé abîmé, une valeur écrite avec
 * un autre secret, une empreinte trop bavarde.
 */

test('ce qui est scellé se descelle', () => {
  const clair = 'sk-ant-api03-EXEMPLE-de-cle-longue-0123456789';
  assert.equal(desceller(sceller(clair)), clair);
});

/** Deux scellés identiques diraient que la clé n'a pas changé. */
test('deux scellés de la même valeur diffèrent', () => {
  assert.notEqual(sceller('identique'), sceller('identique'));
});

test('un scellé abîmé ne rend rien, il ne rend pas n’importe quoi', () => {
  const s = sceller('secret');
  assert.equal(desceller(`${s.slice(0, -3)}AAA`), null);
  assert.equal(desceller(s.split('.').slice(0, 3).join('.')), null);
  assert.equal(desceller(''), null);
  assert.equal(desceller('nimportequoi'), null);
});

/** Le cas réel : AUTH_SECRET remplacé. La clé doit devenir illisible, pas fausse. */
test('un autre AUTH_SECRET ne descelle pas', () => {
  const s = sceller('secret');
  const garde = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'un-autre-secret-tout-aussi-long';
  assert.equal(desceller(s), null);
  process.env.AUTH_SECRET = garde;
  assert.equal(desceller(s), 'secret');
});

test('sans AUTH_SECRET, on refuse de sceller plutôt que de sceller mal', () => {
  const garde = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'court';
  assert.throws(() => sceller('secret'), /AUTH_SECRET/);
  process.env.AUTH_SECRET = garde;
});

test('la comparaison de secrets distingue sans révéler', () => {
  assert.equal(memeSecret('motdepassesolide', 'motdepassesolide'), true);
  assert.equal(memeSecret('motdepassesolide', 'motdepassesolidf'), false);
  assert.equal(memeSecret('court', 'beaucoup-plus-long'), false);
  assert.equal(memeSecret('', ''), true);
});

/** L'empreinte sert à reconnaître SA clé, pas à s'en servir. */
test('l’empreinte ne montre que la fin', () => {
  const cle = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345';
  const vue = empreinte(cle);
  assert.equal(vue, 'sk-ant-…yz012345');
  assert.ok(!vue.includes('abcdefghij'));
  assert.equal(empreinte('sk-ant-x'), '…');
});
