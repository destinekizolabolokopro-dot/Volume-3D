import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TimecodeError, formatTimecode, parseTimecode } from '../lib/timecode.ts';

test('parseTimecode accepte minutes:secondes et secondes brutes', () => {
  assert.equal(parseTimecode('1:30'), 90);
  assert.equal(parseTimecode('0:05'), 5);
  assert.equal(parseTimecode('12:00'), 720);
  assert.equal(parseTimecode('90'), 90);
  assert.equal(parseTimecode('  2:07 '), 127);
});

test('parseTimecode refuse ce qui n’est pas un repère', () => {
  assert.throws(() => parseTimecode('1:60'), TimecodeError);
  assert.throws(() => parseTimecode('bientôt'), TimecodeError);
  assert.throws(() => parseTimecode('1:2:3'), TimecodeError);
  assert.throws(() => parseTimecode(''), TimecodeError);
});

test('formatTimecode est l’opération inverse', () => {
  assert.equal(formatTimecode(90), '1:30');
  assert.equal(formatTimecode(5), '0:05');
  assert.equal(formatTimecode(0), '0:00');
  for (const seconds of [0, 7, 59, 60, 61, 599, 3600]) {
    assert.equal(parseTimecode(formatTimecode(seconds)), seconds);
  }
});
