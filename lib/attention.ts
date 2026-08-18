import { article } from './intake.ts';
import type { PlanRoom, Scene } from './types';

/**
 * Ce que les voyageurs regardent, pièce par pièce.
 *
 * Le tableau de bord sait dire combien de fois une visite a été ouverte. Il ne
 * sait pas dire **ce qui a retenu l'attention**, et c'est pourtant la seule
 * donnée sur laquelle un propriétaire peut agir : si quatre visiteurs sur cinq
 * ne dépassent jamais le séjour, ce n'est pas la chambre qui est en cause,
 * c'est le passage qui y mène.
 *
 * ── Le parti pris qui commande tout le reste ─────────────────────────────
 *
 * **On agrège à l'écriture.** Il n'existe aucune ligne par visiteur, ni même
 * par session : le serveur reçoit des durées et les ajoute à un compteur par
 * logement, par jour et par pièce. Conséquences, toutes voulues :
 *
 * - Rien de personnel n'est jamais enregistré. Pas d'identifiant, pas de
 *   cookie, pas d'adresse IP. Il n'y a donc rien à anonymiser, rien à purger,
 *   et rien à déclarer — ce qui, pour un service vendu à des propriétaires
 *   français, se dit en une phrase sur la page de vente.
 * - La table ne grossit pas avec le trafic, seulement avec les jours et les
 *   pièces. Mille visiteurs coûtent autant de place qu'un seul.
 * - On perd le détail par visiteur. C'est le prix, et il est assumé : ce
 *   détail ne servirait à rien à un propriétaire, et beaucoup à quelqu'un qui
 *   voudrait profiler ses voyageurs.
 */

/** Compteur d'attention pour un logement, un jour et une pièce. */
export interface RoomAttention {
  /** `{propertyId}:{day}:{roomId}` — l'agrégat a une clé, pas un identifiant. */
  id: string;
  propertyId: string;
  /** Jour UTC, `AAAA-MM-JJ`. */
  day: string;
  roomId: string;
  /** Secondes cumulées passées à regarder cette pièce. */
  seconds: number;
  /** Nombre de visites qui ont ouvert cette pièce. */
  opens: number;
}

/* ------------------------------------------------------------------ bornes */

/** Au-delà, c'est un onglet resté ouvert, pas un visiteur qui regarde. */
export const MAX_SECONDS_PER_ROOM = 900;
/** Une visite entière ne compte pas plus d'une heure. */
export const MAX_TOTAL_SECONDS = 3600;
/** Un logement n'a pas cinquante pièces ; au-delà on refuse. */
export const MAX_ROOMS_PER_BEACON = 24;
/**
 * Au-delà de ce multiple de la borne, une durée n'est plus une mesure
 * imparfaite : elle est fausse, et on l'écarte plutôt que de la ramener.
 */
export const FORGERY_FACTOR = 2;

export interface AttentionEntry {
  roomId: string;
  seconds: number;
}

export class AttentionError extends Error {}

/** Jour UTC d'un instant donné. */
export const dayKey = (at: Date = new Date()): string => at.toISOString().slice(0, 10);

/**
 * Valide ce qu'envoie le navigateur.
 *
 * Le point d'entrée est public et sans authentification — un voyageur n'a pas
 * de compte. Tout ce qui arrive est donc traité comme hostile : identifiants
 * inconnus rejetés, durées bornées, nombre de pièces plafonné. Une valeur hors
 * limites n'invalide pas le lot entier, elle est ramenée à sa borne : un
 * mesureur imparfait vaut mieux qu'un mesureur muet.
 */
export function parseBeacon(raw: unknown, knownRoomIds: string[]): AttentionEntry[] {
  const payload = raw as { rooms?: unknown };
  if (!Array.isArray(payload?.rooms)) throw new AttentionError('lot illisible');
  if (payload.rooms.length > MAX_ROOMS_PER_BEACON) throw new AttentionError('trop de pièces');

  const known = new Set(knownRoomIds);
  const merged = new Map<string, number>();

  for (const item of payload.rooms) {
    const entry = item as { roomId?: unknown; seconds?: unknown };
    const roomId = String(entry.roomId ?? '').trim();
    if (!roomId || !known.has(roomId)) continue;

    const seconds = Number(entry.seconds);
    if (!Number.isFinite(seconds) || seconds <= 0) continue;

    // Une valeur un peu au-dessus de la borne est une horloge qui a dérivé, ou
    // un onglet resté au premier plan : on la ramène. Au-delà du double, ce
    // n'est plus une mesure imparfaite mais un chiffre inventé — on l'écarte,
    // sinon un lot forgé se voit créditer le maximum à chaque envoi.
    if (seconds > MAX_SECONDS_PER_ROOM * FORGERY_FACTOR) continue;

    const bounded = Math.min(Math.round(seconds), MAX_SECONDS_PER_ROOM);
    merged.set(roomId, (merged.get(roomId) ?? 0) + bounded);
  }

  // Le plafond global s'applique après fusion : sinon on le contournerait en
  // découpant une longue durée sur plusieurs entrées de la même pièce.
  let total = 0;
  const out: AttentionEntry[] = [];
  for (const [roomId, seconds] of merged) {
    if (total >= MAX_TOTAL_SECONDS) break;
    const allowed = Math.min(seconds, MAX_SECONDS_PER_ROOM, MAX_TOTAL_SECONDS - total);
    if (allowed <= 0) continue;
    total += allowed;
    out.push({ roomId, seconds: allowed });
  }
  return out;
}

/**
 * Ajoute un lot aux compteurs.
 *
 * Rend les lignes à écrire — celles qui existaient, mises à jour, et celles à
 * créer. L'appelant décide comment les persister ; ce module reste pur.
 */
export function applyBeacon(
  existing: RoomAttention[],
  propertyId: string,
  entries: AttentionEntry[],
  day = dayKey(),
): { updated: RoomAttention[]; created: RoomAttention[] } {
  const byRoom = new Map(existing.filter((row) => row.day === day).map((row) => [row.roomId, row]));
  const updated: RoomAttention[] = [];
  const created: RoomAttention[] = [];

  for (const entry of entries) {
    const row = byRoom.get(entry.roomId);
    if (row) {
      updated.push({ ...row, seconds: row.seconds + entry.seconds, opens: row.opens + 1 });
    } else {
      created.push({
        id: `${propertyId}:${day}:${entry.roomId}`,
        propertyId,
        day,
        roomId: entry.roomId,
        seconds: entry.seconds,
        opens: 1,
      });
    }
  }
  return { updated, created };
}

/* --------------------------------------------------------------- lecture */

export interface RoomShare {
  roomId: string;
  name: string;
  /** Secondes cumulées, tous jours confondus. */
  seconds: number;
  /** Visites qui ont ouvert cette pièce. */
  opens: number;
  /** Part de l'attention totale, de 0 à 1. */
  share: number;
  /** Durée moyenne par visite qui l'a ouverte, en secondes. */
  average: number;
  /** Part des visites qui atteignent cette pièce, rapportée à la plus vue. */
  reach: number;
}

export interface AttentionSummary {
  rooms: RoomShare[];
  totalSeconds: number;
  /** Visites mesurées : le maximum d'ouvertures sur une pièce. */
  visits: number;
  /** Vrai tant qu'il n'y a pas de quoi conclure. */
  thin: boolean;
}

/** Seuil en dessous duquel on ne tire aucune conclusion. */
export const ENOUGH_VISITS = 5;

/** Nom lisible d'une pièce, quelle que soit sa provenance. */
type NamedRoom = Pick<Scene, 'id' | 'name'> | Pick<PlanRoom, 'id' | 'name'>;

/** Rassemble les compteurs pour l'affichage. */
export function summarize(rows: RoomAttention[], rooms: NamedRoom[]): AttentionSummary {
  const names = new Map(rooms.map((room) => [room.id, room.name]));
  const totals = new Map<string, { seconds: number; opens: number }>();

  for (const row of rows) {
    const current = totals.get(row.roomId) ?? { seconds: 0, opens: 0 };
    current.seconds += row.seconds;
    current.opens += row.opens;
    totals.set(row.roomId, current);
  }

  const totalSeconds = [...totals.values()].reduce((sum, entry) => sum + entry.seconds, 0);
  const visits = Math.max(0, ...[...totals.values()].map((entry) => entry.opens));

  const shares: RoomShare[] = [...totals.entries()]
    // Une pièce supprimée du logement garde ses compteurs mais n'a plus de nom :
    // on ne l'affiche pas plutôt que d'écrire « undefined ».
    .filter(([roomId]) => names.has(roomId))
    .map(([roomId, entry]) => ({
      roomId,
      name: names.get(roomId) ?? roomId,
      seconds: entry.seconds,
      opens: entry.opens,
      share: totalSeconds === 0 ? 0 : entry.seconds / totalSeconds,
      average: entry.opens === 0 ? 0 : entry.seconds / entry.opens,
      reach: visits === 0 ? 0 : entry.opens / visits,
    }))
    .sort((a, b) => b.seconds - a.seconds);

  return { rooms: shares, totalSeconds, visits, thin: visits < ENOUGH_VISITS };
}

/** Durée en français : « 1 min 20 s », « 45 s ». */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

/**
 * La phrase à montrer au propriétaire.
 *
 * Un graphique ne dit pas quoi faire. On énonce donc le fait le plus
 * actionnable, et **rien** tant que le nombre de visites ne permet pas de
 * conclure — trois visiteurs ne font pas une tendance, et une recommandation
 * tirée de trois visiteurs se retourne contre l'outil.
 */
export function insight(summary: AttentionSummary): string {
  if (summary.visits === 0) return '';
  if (summary.thin) {
    return `Encore trop peu de visites pour conclure : ${summary.visits} mesurée${
      summary.visits > 1 ? 's' : ''
    } sur ${ENOUGH_VISITS} nécessaires.`;
  }
  if (summary.rooms.length === 0) return '';

  const [first] = summary.rooms;
  const last = summary.rooms[summary.rooms.length - 1];

  // Un décrochage franc est le signal le plus utile : il pointe un passage
  // manquant ou mal placé, pas un défaut de la pièce elle-même.
  const dropped = summary.rooms.filter((room) => room.reach < 0.5);
  if (dropped.length > 0) {
    const worst = dropped.reduce((a, b) => (a.reach < b.reach ? a : b));
    const percent = Math.round(worst.reach * 100);
    // « Seul 1 % » mais « Seuls 29 % » : l'accord suit le nombre, pas la part.
    const seul = percent >= 2 ? 'Seuls' : 'Seul';
    const nom = worst.name.toLowerCase();
    return `${seul} ${percent} % des visiteurs atteignent ${article(worst.name)} ${nom}. Vérifiez qu’un passage y mène depuis la pièce précédente.`;
  }

  // Un seuil fixe à 50 % signalerait un « déséquilibre » sur tout logement de
  // deux pièces, où l'une dépasse forcément la moitié. On compare donc à la
  // part équitable — 1/n — et on ne parle de monopole qu'au-delà du double.
  const fairShare = 1 / summary.rooms.length;
  if (summary.rooms.length >= 3 && first.share > Math.max(0.5, fairShare * 2)) {
    return `${first.name} retient ${Math.round(first.share * 100)} % de l’attention, pour ${
      summary.rooms.length
    } pièces. Les autres méritent peut-être une vue de départ plus engageante.`;
  }

  if (summary.rooms.length > 1 && last.average < 8) {
    const feminin = article(last.name) === 'la';
    return `${last.name} n’est regardé${feminin ? 'e' : ''} que ${formatDuration(
      last.average,
    )} en moyenne. Une vue de départ mieux choisie y retiendrait davantage.`;
  }

  return `L’attention se répartit entre les pièces : ${first.name} arrive en tête avec ${formatDuration(
    first.average,
  )} en moyenne.`;
}
