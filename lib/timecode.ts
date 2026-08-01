/** Repères temporels saisis à la main pour les chapitres de la vidéo. */

export class TimecodeError extends Error {}

/**
 * « 1:30 » ou « 90 » → 90 secondes.
 *
 * Les deux écritures sont acceptées parce que les deux viennent naturellement :
 * on lit « 1:30 » sur le lecteur, mais on compte parfois en secondes.
 */
export function parseTimecode(input: string): number {
  const raw = input.trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = /^(\d+):([0-5]?\d)$/.exec(raw);
  if (!match) throw new TimecodeError('Indiquez un repère au format 1:30 ou un nombre de secondes.');
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 90 → « 1:30 ». */
export function formatTimecode(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}
