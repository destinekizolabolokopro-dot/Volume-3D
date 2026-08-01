import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampPitch, normalizeYaw, sphericalToVector, vectorToSpherical } from '../lib/sphere.ts';

test('normalizeYaw ramène tout angle dans [-180, 180[', () => {
  assert.equal(normalizeYaw(0), 0);
  assert.equal(normalizeYaw(190), -170);
  assert.equal(normalizeYaw(-190), 170);
  assert.equal(normalizeYaw(540), -180);
  assert.equal(normalizeYaw(-45), -45);
});

test('clampPitch évite la singularité au zénith', () => {
  assert.equal(clampPitch(120), 89);
  assert.equal(clampPitch(-120), -89);
  assert.equal(clampPitch(12), 12);
});

test('un aller-retour sphérique → cartésien → sphérique conserve la direction', () => {
  const cases = [
    { yaw: 0, pitch: 0 },
    { yaw: 90, pitch: 30 },
    { yaw: -135, pitch: -45 },
    { yaw: 179, pitch: 12 },
  ];

  for (const { yaw, pitch } of cases) {
    const round = vectorToSpherical(sphericalToVector(yaw, pitch, 10));
    assert.ok(Math.abs(round.yaw - yaw) < 0.001, `yaw ${round.yaw} ≠ ${yaw}`);
    assert.ok(Math.abs(round.pitch - pitch) < 0.001, `pitch ${round.pitch} ≠ ${pitch}`);
  }
});

test('yaw 0 regarde vers -Z, yaw 90 vers +X', () => {
  const front = sphericalToVector(0, 0, 1);
  assert.ok(Math.abs(front.z + 1) < 1e-9);
  assert.ok(Math.abs(front.x) < 1e-9);

  const right = sphericalToVector(90, 0, 1);
  assert.ok(Math.abs(right.x - 1) < 1e-9);
  assert.ok(Math.abs(right.z) < 1e-9);
});

test('le rayon est respecté quelle que soit la direction', () => {
  const v = sphericalToVector(37, 22, 10);
  assert.ok(Math.abs(Math.hypot(v.x, v.y, v.z) - 10) < 1e-9);
});
