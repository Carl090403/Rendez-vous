import { addDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Toutes les heures sont affichées dans le fuseau du commerce, quel que soit le navigateur. */
export const BUSINESS_TZ = "America/Toronto";
export const BOOKING_HORIZON_DAYS = 60;
export const CANCEL_LIMIT_HOURS = Number(process.env.NEXT_PUBLIC_CANCEL_LIMIT_HOURS ?? 24);

export const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const toDate = (value: string | Date) => (typeof value === "string" ? parseISO(value) : value);

/** « mardi 10 novembre 2026 » */
export function formatLongDate(value: string | Date): string {
  return formatInTimeZone(toDate(value), BUSINESS_TZ, "EEEE d MMMM yyyy", { locale: fr });
}

/** « 9 h 15 » */
export function formatTime(value: string | Date): string {
  return formatInTimeZone(toDate(value), BUSINESS_TZ, "H 'h' mm", { locale: fr });
}

/** « mardi 10 novembre 2026 à 9 h 15 » */
export function formatDateTime(value: string | Date): string {
  return `${formatLongDate(value)} à ${formatTime(value)}`;
}

/** Date du jour à Toronto, au format AAAA-MM-JJ. */
export function todayInBusinessTz(now: Date = new Date()): string {
  return formatInTimeZone(now, BUSINESS_TZ, "yyyy-MM-dd");
}

/** Date locale (AAAA-MM-JJ) d'un instant, dans le fuseau du commerce. */
export function businessDateOf(value: string | Date): string {
  return formatInTimeZone(toDate(value), BUSINESS_TZ, "yyyy-MM-dd");
}

// Les calculs de calendrier se font sur des dates « pures » (midi UTC) pour éviter
// tout effet du changement d'heure.
function fromDateKey(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToKey(key: string, days: number): string {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** Lundi = 0 … dimanche = 6, comme dans l'API. */
export function weekdayOfKey(key: string): number {
  return (fromDateKey(key).getUTCDay() + 6) % 7;
}

/** « novembre 2026 » */
export function formatMonth(year: number, month: number): string {
  return format(new Date(year, month, 1), "MMMM yyyy", { locale: fr });
}

/** Grille d'un mois commençant le lundi; `null` pour les cases hors du mois. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1, 12));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toDateKey(new Date(Date.UTC(year, month, day, 12))));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Convertit une date et une heure saisies à Toronto en instant UTC (ISO 8601). */
export function businessLocalToUtcIso(dateKey: string, time: string): string {
  return fromZonedTime(`${dateKey}T${time}:00`, BUSINESS_TZ).toISOString();
}

export function hoursUntil(value: string, now: Date = new Date()): number {
  return (parseISO(value).getTime() - now.getTime()) / 3_600_000;
}

export function canClientCancel(startAt: string, now: Date = new Date()): boolean {
  return hoursUntil(startAt, now) >= CANCEL_LIMIT_HOURS;
}
