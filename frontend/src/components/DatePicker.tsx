"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { formatLongDate, formatMonth, monthGrid } from "@/lib/dates";

type DatePickerProps = {
  value: string | null;
  /** Bornes incluses, au format AAAA-MM-JJ. */
  min: string;
  max: string;
  /** Nombre de créneaux par jour; un jour absent est en cours de chargement. */
  slotsByDate: Map<string, number>;
  /** Mois affiché (0 = janvier), contrôlé par le parent. */
  year: number;
  month: number;
  onChange: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
};

const WEEK_HEADERS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

/** Calendrier mensuel : les jours sans créneau sont grisés, limité à l'horizon de réservation. */
export function DatePicker({
  value,
  min,
  max,
  slotsByDate,
  year,
  month,
  onChange,
  onMonthChange,
}: DatePickerProps) {
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const canGoBack = monthKey > min.slice(0, 7);
  const canGoForward = monthKey < max.slice(0, 7);

  const shift = (delta: number) => {
    const next = new Date(Date.UTC(year, month + delta, 1));
    onMonthChange(next.getUTCFullYear(), next.getUTCMonth());
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={!canGoBack}
          className="rounded-lg p-2 hover:bg-neutral-100 disabled:opacity-30"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <p className="font-semibold capitalize" aria-live="polite">
          {formatMonth(year, month)}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={!canGoForward}
          className="rounded-lg p-2 hover:bg-neutral-100 disabled:opacity-30"
          aria-label="Mois suivant"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Choisir une date">
        {WEEK_HEADERS.map((day) => (
          <div key={day} className="pb-1 text-xs font-medium text-neutral-500" role="columnheader">
            {day}
          </div>
        ))}
        {monthGrid(year, month).map((date, index) => {
          if (!date) return <div key={`empty-${index}`} />;
          const inRange = date >= min && date <= max;
          const slots = slotsByDate.get(date);
          const loading = inRange && slots === undefined;
          const available = inRange && (slots ?? 0) > 0;
          const selected = date === value;
          const label = `${formatLongDate(`${date}T12:00:00Z`)}${
            available ? `, ${slots} créneau${slots === 1 ? "" : "x"}` : ", aucun créneau"
          }`;
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              disabled={!available}
              aria-selected={selected}
              aria-label={label}
              data-date={date}
              onClick={() => onChange(date)}
              className={`aspect-square min-h-10 rounded-xl text-sm font-medium transition-colors ${
                selected
                  ? "bg-neutral-900 text-white"
                  : available
                    ? "bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
                    : loading
                      ? "animate-pulse text-neutral-400"
                      : "text-neutral-300 line-through decoration-neutral-300"
              }`}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
