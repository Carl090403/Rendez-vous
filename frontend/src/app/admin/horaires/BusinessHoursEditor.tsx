"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { ErrorState, FormError, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useBusinessHours, useSaveBusinessHours } from "@/hooks/useSchedule";
import { errorMessage } from "@/lib/api";
import { WEEKDAYS } from "@/lib/dates";
import type { BusinessHour, BusinessHourInput } from "@/types";

type Range = { key: number; start: string; end: string };
type Week = Range[][];

let nextKey = 1;
const hhmm = (time: string) => time.slice(0, 5);

function toWeek(hours: BusinessHour[]): Week {
  const week: Week = Array.from({ length: 7 }, () => []);
  for (const h of hours) {
    week[h.weekday].push({ key: nextKey++, start: hhmm(h.start_time), end: hhmm(h.end_time) });
  }
  return week;
}

/** Vérifie chaque jour : début < fin et aucune plage qui se chevauche. */
export function validateWeek(week: Week): string | null {
  for (const [day, ranges] of week.entries()) {
    const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
    for (const [i, r] of sorted.entries()) {
      if (!r.start || !r.end)
        return `${WEEKDAYS[day]} : renseignez le début et la fin de chaque plage.`;
      if (r.end <= r.start)
        return `${WEEKDAYS[day]} : la fin doit être après le début (${r.start}–${r.end}).`;
      if (i > 0 && r.start < sorted[i - 1].end)
        return `${WEEKDAYS[day]} : deux plages se chevauchent.`;
    }
  }
  return null;
}

function WeekForm({ initial }: { initial: BusinessHour[] }) {
  const [week, setWeek] = useState<Week>(() => toWeek(initial));
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveBusinessHours();
  const toast = useToast();

  const updateDay = (day: number, ranges: Range[]) =>
    setWeek((current) => current.map((r, i) => (i === day ? ranges : r)));

  const submit = () => {
    const problem = validateWeek(week);
    setFormError(problem);
    if (problem) return;
    const payload: BusinessHourInput[] = week.flatMap((ranges, weekday) =>
      ranges.map((r) => ({ weekday, start_time: r.start, end_time: r.end })),
    );
    save.mutate(payload, {
      onSuccess: () => toast.success("Heures d'ouverture enregistrées."),
      onError: (error) => setFormError(errorMessage(error)),
    });
  };

  return (
    <div className="space-y-4">
      <FormError message={formError} />
      <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
        {week.map((ranges, day) => (
          <li key={WEEKDAYS[day]} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
            <p className="w-28 shrink-0 pt-2 font-semibold">{WEEKDAYS[day]}</p>
            <div className="flex-1 space-y-2">
              {ranges.length === 0 && <p className="pt-2 text-sm text-neutral-500">Fermé</p>}
              {ranges.map((range, index) => (
                <div key={range.key} className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`start-${range.key}`}>
                    {WEEKDAYS[day]}, début de la plage {index + 1}
                  </label>
                  <input
                    id={`start-${range.key}`}
                    type="time"
                    step={900}
                    value={range.start}
                    onChange={(e) =>
                      updateDay(
                        day,
                        ranges.map((r) =>
                          r.key === range.key ? { ...r, start: e.target.value } : r,
                        ),
                      )
                    }
                    className="min-h-11 rounded-xl border border-neutral-300 px-3"
                  />
                  <span aria-hidden="true">à</span>
                  <label className="sr-only" htmlFor={`end-${range.key}`}>
                    {WEEKDAYS[day]}, fin de la plage {index + 1}
                  </label>
                  <input
                    id={`end-${range.key}`}
                    type="time"
                    step={900}
                    value={range.end}
                    onChange={(e) =>
                      updateDay(
                        day,
                        ranges.map((r) =>
                          r.key === range.key ? { ...r, end: e.target.value } : r,
                        ),
                      )
                    }
                    className="min-h-11 rounded-xl border border-neutral-300 px-3"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateDay(
                        day,
                        ranges.filter((r) => r.key !== range.key),
                      )
                    }
                    className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-red-700"
                    aria-label={`Supprimer la plage ${range.start}–${range.end} du ${WEEKDAYS[day].toLowerCase()}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <Button
                variant="ghost"
                className="min-h-9 px-2 text-xs"
                onClick={() => {
                  const last = ranges.at(-1);
                  const start = last ? last.end : "09:00";
                  updateDay(day, [
                    ...ranges,
                    { key: nextKey++, start, end: start < "17:00" ? "17:00" : "23:00" },
                  ]);
                }}
              >
                <Plus className="size-4" aria-hidden="true" />
                Ajouter une plage
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button onClick={submit} loading={save.isPending}>
        Enregistrer les heures
      </Button>
    </div>
  );
}

export function BusinessHoursEditor() {
  const hours = useBusinessHours();
  return (
    <section aria-labelledby="hours-title">
      <PageHeader
        title="Heures d'ouverture"
        description="Une ou plusieurs plages par jour (ex. 9 h à 12 h et 13 h à 17 h), heure de Toronto."
      />
      <h2 id="hours-title" className="sr-only">
        Heures d&apos;ouverture hebdomadaires
      </h2>
      {hours.isPending ? (
        <LoadingState />
      ) : hours.isError ? (
        <ErrorState error={hours.error} onRetry={() => hours.refetch()} />
      ) : (
        <WeekForm key={hours.dataUpdatedAt} initial={hours.data} />
      )}
    </section>
  );
}
