import { formatTime } from "@/lib/dates";

type SlotGridProps = {
  slots: string[];
  value: string | null;
  onChange: (slot: string) => void;
};

/** Grille de boutons d'heures (heure de Toronto). */
export function SlotGrid({ slots, value, onChange }: SlotGridProps) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Créneaux disponibles">
      {slots.map((slot) => {
        const selected = slot === value;
        return (
          <li key={slot}>
            <button
              type="button"
              onClick={() => onChange(slot)}
              aria-pressed={selected}
              className={`min-h-11 w-full rounded-xl border px-2 py-2 text-sm font-semibold transition-colors ${
                selected
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-900 hover:border-neutral-900"
              }`}
            >
              {formatTime(slot)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
