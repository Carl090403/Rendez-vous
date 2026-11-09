import type { BookingStatus } from "@/types";

const currency = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });

/** 6500 -> « 65,00 $ » (les prix sont stockés en cents, jamais en décimaux). */
export function formatPrice(cents: number): string {
  return currency.format(cents / 100);
}

/** 45 -> « 45 min », 60 -> « 1 h », 90 -> « 1 h 30 » */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: "Confirmé",
  cancelled_by_client: "Annulé par le client",
  cancelled_by_admin: "Annulé par le commerce",
  completed: "Terminé",
};

/** Accepte « 65 », « 65,5 » ou « 65.50 » et renvoie des cents. */
export function parsePriceToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s|\$/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Empêche les redirections ouvertes : seuls les chemins internes sont acceptés. */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
