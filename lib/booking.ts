/**
 * Prise de rendez-vous.
 *
 * Le service est vendu par une personne, pas par une plateforme : le visiteur
 * choisit un créneau, laisse un numéro, et il est rappelé. Il n'y a donc ni
 * calendrier partagé, ni synchronisation, ni visioconférence intégrée — trois
 * choses qui demanderaient un service extérieur et qui n'apporteraient rien
 * tant qu'il n'y a qu'un interlocuteur.
 *
 * Ce que ce fichier fait, en revanche, il le fait sérieusement : les créneaux
 * proposés sont calculés à l'heure de Paris, changement d'heure compris, et
 * **la liste des créneaux valables est recalculée côté serveur à la réception**.
 * Un formulaire n'est jamais une source de vérité : sans ce recalcul, on
 * accepterait un rendez-vous à trois heures du matin parce que quelqu'un aurait
 * modifié une valeur dans la page.
 */

export const ZONE = 'Europe/Paris';

/** Durée d'un rendez-vous, en minutes. Un appel de découverte, pas une réunion. */
export const SLOT_MINUTES = 30;

/** Nombre de jours proposés à partir d'aujourd'hui. */
export const HORIZON_DAYS = 12;

/**
 * Délai minimal avant un rendez-vous, en heures.
 *
 * Sans lui, quelqu'un réserve pour dans dix minutes et personne ne décroche :
 * on aurait construit une machine à décevoir.
 */
export const LEAD_HOURS = 3;

interface Window {
  from: number;
  to: number;
}

/**
 * Les plages ouvertes, en minutes depuis minuit, par jour de la semaine
 * (0 = dimanche). La fin de journée compte : un propriétaire qui loue en plus
 * de son travail est joignable à 19 h, pas à 11 h.
 */
export const OPEN: Record<number, Window[]> = {
  1: [{ from: 9 * 60, to: 12 * 60 + 30 }, { from: 14 * 60, to: 20 * 60 }],
  2: [{ from: 9 * 60, to: 12 * 60 + 30 }, { from: 14 * 60, to: 20 * 60 }],
  3: [{ from: 9 * 60, to: 12 * 60 + 30 }, { from: 14 * 60, to: 20 * 60 }],
  4: [{ from: 9 * 60, to: 12 * 60 + 30 }, { from: 14 * 60, to: 20 * 60 }],
  5: [{ from: 9 * 60, to: 12 * 60 + 30 }, { from: 14 * 60, to: 19 * 60 }],
  6: [{ from: 10 * 60, to: 13 * 60 }],
};

export type Channel = 'telephone' | 'visio';

export const CHANNELS: { value: Channel; label: string; help: string }[] = [
  { value: 'telephone', label: 'Par téléphone', help: 'Je vous appelle au numéro indiqué.' },
  { value: 'visio', label: 'En visio', help: 'Je vous envoie un lien avant le rendez-vous.' },
];

export interface Appointment {
  id: string;
  /** Début du créneau, en UTC, au format ISO. C'est la clé d'unicité. */
  slot: string;
  name: string;
  email: string;
  phone: string;
  channel: string;
  city: string;
  /** Nombre de logements à mettre en visite. Zéro si la personne ne sait pas. */
  listings: number;
  message: string;
  createdAt: string;
  /** 'demande' | 'confirme' | 'annule' */
  status: string;
}

export interface Slot {
  /** Début, en UTC ISO. */
  start: string;
  /** « 9 h 30 » */
  label: string;
  free: boolean;
}

export interface Day {
  /** AAAA-MM-JJ, à l'heure de Paris. */
  date: string;
  /** « lundi 24 août » */
  label: string;
  slots: Slot[];
}

export class BookingError extends Error {}

/* ============================================================ fuseau Paris === */

const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

interface Civil {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** L'heure civile parisienne correspondant à un instant. */
export function inParis(at: Date): Civil {
  const parts = PARTS.formatToParts(at);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  // `en-CA` en 24 h rend minuit comme 24 : la seule irrégularité à corriger.
  const hour = read('hour');
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: hour === 24 ? 0 : hour,
    minute: read('minute'),
    second: read('second'),
  };
}

/** Décalage de Paris par rapport à UTC, en minutes, à cet instant précis. */
function offsetAt(at: Date): number {
  const civil = inParis(at);
  const asUtc = Date.UTC(civil.year, civil.month - 1, civil.day, civil.hour, civil.minute, civil.second);
  return (asUtc - at.getTime()) / 60000;
}

/**
 * L'instant correspondant à une heure locale parisienne.
 *
 * Deux passes, et c'est nécessaire : le décalage dépend de l'instant qu'on
 * cherche, donc on part d'une estimation et on la corrige. Aux deux dimanches
 * de changement d'heure, une heure locale peut ne pas exister ou exister deux
 * fois ; on retient alors la lecture la plus proche, ce qui suffit ici — aucun
 * créneau n'est proposé à trois heures du matin.
 */
export function fromParis(year: number, month: number, day: number, minutes: number): Date {
  const wall = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  let instant = new Date(wall);
  for (let pass = 0; pass < 2; pass += 1) instant = new Date(wall - offsetAt(instant) * 60000);
  return instant;
}

/** Jour de la semaine parisien, 0 = dimanche. */
function weekday(at: Date): number {
  const civil = inParis(at);
  return new Date(Date.UTC(civil.year, civil.month - 1, civil.day)).getUTCDay();
}

/* ============================================================== affichage === */

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', {
  timeZone: ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** « 9 h 30 », « 14 h » — la typographie française, espaces comprises. */
export function timeLabel(at: Date): string {
  const { hour, minute } = inParis(at);
  return minute === 0 ? `${hour} h` : `${hour} h ${String(minute).padStart(2, '0')}`;
}

export const dayLabel = (at: Date): string => DAY_LABEL.format(at);

/**
 * Première lettre en capitale, le reste tel quel.
 *
 * `text-transform: capitalize` mettrait une majuscule à chaque mot et rendrait
 * « Mercredi 19 Août » — en français, les noms de mois ne prennent pas de
 * capitale. La règle est typographique, pas cosmétique : elle appartient au
 * code, pas à la feuille de style.
 */
export const sentence = (text: string): string =>
  text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);

export const dayKey = (at: Date): string => {
  const { year, month, day } = inParis(at);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** « lundi 24 août à 9 h 30 » — ce qu'on affiche en confirmation. */
export const slotLabel = (iso: string): string => {
  const at = new Date(iso);
  return `${dayLabel(at)} à ${timeLabel(at)}`;
};

/* ================================================================ créneaux === */

/**
 * Les créneaux proposés à partir d'un instant donné.
 *
 * `now` est un paramètre et non `Date.now()` : c'est ce qui rend la fonction
 * testable, et c'est aussi ce qui permet au serveur de refaire exactement le
 * même calcul que la page au moment de la réception.
 */
export function offeredDays(now: Date, taken: string[] = [], horizon = HORIZON_DAYS): Day[] {
  const busy = new Set(taken);
  const earliest = now.getTime() + LEAD_HOURS * 3600_000;
  const days: Day[] = [];

  for (let step = 0; step < horizon; step += 1) {
    // On avance de 24 h puis on relit l'heure civile : autour du changement
    // d'heure, ajouter 24 h ne tombe pas sur la même heure locale, mais on ne
    // s'en sert que pour désigner le jour.
    const probe = new Date(now.getTime() + step * 86_400_000);
    const civil = inParis(probe);
    const windows = OPEN[weekday(probe)];
    if (!windows) continue;

    const slots: Slot[] = [];
    for (const window of windows) {
      for (let minutes = window.from; minutes + SLOT_MINUTES <= window.to; minutes += SLOT_MINUTES) {
        const start = fromParis(civil.year, civil.month, civil.day, minutes);
        if (start.getTime() < earliest) continue;
        const iso = start.toISOString();
        slots.push({ start: iso, label: timeLabel(start), free: !busy.has(iso) });
      }
    }
    if (slots.length > 0) {
      days.push({ date: dayKey(probe), label: dayLabel(probe), slots });
    }
  }
  return days;
}

/** Tous les créneaux proposés, à plat. Sert au contrôle côté serveur. */
export const offeredSlots = (now: Date, horizon = HORIZON_DAYS): Set<string> =>
  new Set(offeredDays(now, [], horizon).flatMap((day) => day.slots.map((slot) => slot.start)));

/**
 * Contrôle qu'un créneau demandé est réellement proposé et encore libre.
 *
 * Deux refus distincts, parce qu'ils veulent dire deux choses différentes pour
 * la personne en face : « ce créneau n'existe pas » relève de la manipulation ou
 * d'une page restée ouverte trop longtemps, « ce créneau vient d'être pris » est
 * la course normale entre deux visiteurs et mérite qu'on repropose la liste.
 */
export function checkSlot(requested: string, now: Date, taken: string[]): string {
  const at = new Date(requested);
  if (Number.isNaN(at.getTime())) throw new BookingError('Ce créneau n’est pas lisible.');
  const iso = at.toISOString();
  if (!offeredSlots(now).has(iso)) {
    throw new BookingError('Ce créneau n’est plus proposé. Choisissez-en un autre.');
  }
  if (taken.includes(iso)) {
    throw new BookingError('Ce créneau vient d’être réservé. Choisissez-en un autre.');
  }
  return iso;
}

/** Un rendez-vous encore à venir, au sens du back-office. */
export const isUpcoming = (appointment: Appointment, now: Date): boolean =>
  appointment.status !== 'annule' && new Date(appointment.slot).getTime() >= now.getTime();

/** Les rendez-vous à venir, du plus proche au plus lointain. */
export function upcoming(appointments: Appointment[], now: Date): Appointment[] {
  return appointments
    .filter((appointment) => isUpcoming(appointment, now))
    .sort((a, b) => a.slot.localeCompare(b.slot));
}

/** Les créneaux déjà pris : annulés exclus, ils se libèrent. */
export const bookedSlots = (appointments: Appointment[]): string[] =>
  appointments.filter((appointment) => appointment.status !== 'annule').map((appointment) => appointment.slot);

/** Le canal, en clair. */
export const channelLabel = (value: string): string =>
  CHANNELS.find((channel) => channel.value === value)?.label ?? 'Par téléphone';
