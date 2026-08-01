/**
 * Conversions entre coordonnées sphériques (yaw/pitch en degrés, la façon dont
 * les points de passage sont stockés) et vecteurs cartésiens (ce que comprend
 * le moteur de rendu).
 *
 * Convention : yaw = rotation horizontale, 0° face à l'axe -Z, croissant vers
 * la droite. pitch = élévation, positif vers le haut, borné à ±89° pour éviter
 * la singularité au zénith.
 */

export const DEG = Math.PI / 180;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function clampPitch(pitch: number): number {
  return Math.max(-89, Math.min(89, pitch));
}

/** Ramène un angle dans [-180, 180[ pour que les comparaisons restent stables. */
export function normalizeYaw(yaw: number): number {
  const wrapped = ((yaw + 180) % 360 + 360) % 360;
  return wrapped - 180;
}

export function sphericalToVector(yaw: number, pitch: number, radius = 1): Vec3 {
  const phi = clampPitch(pitch) * DEG;
  const theta = yaw * DEG;
  const cosPhi = Math.cos(phi);
  return {
    x: radius * cosPhi * Math.sin(theta),
    y: radius * Math.sin(phi),
    z: -radius * cosPhi * Math.cos(theta),
  };
}

export function vectorToSpherical(v: Vec3): { yaw: number; pitch: number } {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  const pitch = Math.asin(Math.max(-1, Math.min(1, v.y / length))) / DEG;
  const yaw = Math.atan2(v.x, -v.z) / DEG;
  return { yaw: normalizeYaw(yaw), pitch: clampPitch(pitch) };
}
