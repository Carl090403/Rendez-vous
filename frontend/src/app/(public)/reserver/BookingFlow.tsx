"use client";

import { Check, CheckCircle2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { BookingSummary } from "@/components/BookingSummary";
import { DatePicker } from "@/components/DatePicker";
import { ServiceCard } from "@/components/ServiceCard";
import { SlotGrid } from "@/components/SlotGrid";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useAvailability, useAvailabilityForDays } from "@/hooks/useAvailability";
import { useCreateBooking } from "@/hooks/useBookings";
import { useServices } from "@/hooks/useServices";
import { errorMessage, isApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  addDaysToKey,
  BOOKING_HORIZON_DAYS,
  formatLongDate,
  monthGrid,
  todayInBusinessTz,
} from "@/lib/dates";
import { formatDuration, formatPrice } from "@/lib/format";
import type { Booking } from "@/types";

const STEPS = ["Service", "Date", "Créneau", "Confirmation"] as const;

type Selection = { service: string | null; date: string | null; slot: string | null };

function Stepper({ current, onGoTo }: { current: number; onGoTo: (step: number) => void }) {
  return (
    <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Étapes de la réservation">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!done}
              onClick={() => onGoTo(step)}
              aria-current={active ? "step" : undefined}
              className="flex w-full flex-col items-center gap-1.5 text-center disabled:cursor-default"
            >
              <span
                className={`flex size-8 items-center justify-center rounded-full text-sm font-bold ${
                  active
                    ? "bg-neutral-900 text-white"
                    : done
                      ? "bg-emerald-600 text-white"
                      : "bg-neutral-200 text-neutral-600"
                }`}
              >
                {done ? <Check className="size-4" aria-hidden="true" /> : step}
              </span>
              <span
                className={`text-xs font-medium sm:text-sm ${active ? "text-neutral-900" : "text-neutral-600"}`}
              >
                {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function BookingFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const services = useServices();
  const createBooking = useCreateBooking();
  const [confirmed, setConfirmed] = useState<Booking | null>(null);

  const today = useMemo(() => todayInBusinessTz(), []);
  const maxDate = addDaysToKey(today, BOOKING_HORIZON_DAYS);

  const selection: Selection = {
    service: params.get("service"),
    date: params.get("date"),
    slot: params.get("slot"),
  };
  const service = services.data?.find((s) => s.id === selection.service) ?? null;
  const date =
    service && selection.date && selection.date >= today && selection.date <= maxDate
      ? selection.date
      : null;
  const slot = date ? selection.slot : null;
  const step = !service ? 1 : !date ? 2 : !slot ? 3 : 4;

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const start = selection.date ?? today;
    return { year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) - 1 };
  });
  const monthDates = useMemo(
    () =>
      monthGrid(visibleMonth.year, visibleMonth.month).filter(
        (d): d is string => d !== null && d >= today && d <= maxDate,
      ),
    [visibleMonth, today, maxDate],
  );
  const calendar = useAvailabilityForDays(step >= 2 ? (service?.id ?? null) : null, monthDates);
  const availability = useAvailability(service?.id ?? null, date);

  const update = (next: Partial<Selection>) => {
    const merged = { ...selection, ...next };
    const query = new URLSearchParams();
    if (merged.service) query.set("service", merged.service);
    if (merged.date) query.set("date", merged.date);
    if (merged.slot) query.set("slot", merged.slot);
    router.replace(`/reserver${query.size ? `?${query}` : ""}`, { scroll: false });
  };

  const goTo = (target: number) => {
    if (target === 1) update({ service: null, date: null, slot: null });
    if (target === 2) update({ date: null, slot: null });
    if (target === 3) update({ slot: null });
  };

  const confirm = () => {
    if (!service || !slot) return;
    if (!user) {
      // La sélection est conservée dans l'URL : on revient ici après la connexion.
      const back = `/reserver?${new URLSearchParams({ service: service.id, date: date!, slot })}`;
      router.push(`/connexion?next=${encodeURIComponent(back)}`);
      return;
    }
    createBooking.mutate(
      { serviceId: service.id, startAt: slot },
      {
        onSuccess: (booking) => {
          setConfirmed(booking);
          window.scrollTo({ top: 0 });
        },
        onError: (error) => {
          if (isApiError(error) && (error.code === "SLOT_TAKEN" || error.code === "SLOT_INVALID")) {
            toast.error(
              error.code === "SLOT_TAKEN"
                ? "Ce créneau vient d'être pris. Choisissez-en un autre."
                : error.message,
            );
            update({ slot: null }); // la liste est rechargée, les autres choix sont gardés
          } else if (isApiError(error) && error.status === 401) {
            toast.error("Votre session a expiré. Reconnectez-vous.");
            router.push(`/connexion?next=${encodeURIComponent(`/reserver?${params}`)}`);
          } else {
            toast.error(errorMessage(error));
          }
        },
      },
    );
  };

  if (confirmed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 sm:py-16">
        <div className="space-y-6 text-center" role="status">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-extrabold">Votre rendez-vous est confirmé</h1>
            <p className="mt-2 text-neutral-600">
              Un courriel de confirmation vient d&apos;être envoyé à {user?.email}.
            </p>
          </div>
          <div className="text-left">
            <BookingSummary
              serviceName={confirmed.service.name}
              durationMin={confirmed.service.duration_min}
              priceCents={confirmed.service.price_cents}
              startAt={confirmed.start_at}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <ButtonLink href="/mes-rendez-vous">Voir mes rendez-vous</ButtonLink>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmed(null);
                goTo(1);
              }}
            >
              Réserver autre chose
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl">
        Réserver un rendez-vous
      </h1>
      <Stepper current={step} onGoTo={goTo} />

      {step === 1 && (
        <section aria-labelledby="step-service" className="space-y-4">
          <h2 id="step-service" className="text-lg font-bold">
            1. Choisissez un service
          </h2>
          {services.isPending ? (
            <LoadingState label="Chargement des services…" />
          ) : services.isError ? (
            <ErrorState error={services.error} onRetry={() => services.refetch()} />
          ) : services.data.length === 0 ? (
            <EmptyState title="Aucun service n'est offert pour le moment." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {services.data.map((s) => (
                <li key={s.id}>
                  <ServiceCard
                    service={s}
                    onSelect={() => update({ service: s.id, date: null, slot: null })}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step >= 2 && service && (
        <p className="mb-4 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-800">
          <span className="font-semibold">{service.name}</span> ·{" "}
          {formatDuration(service.duration_min)} · {formatPrice(service.price_cents)}
          {date && step >= 3 && (
            <>
              {" "}
              · <span className="capitalize">{formatLongDate(`${date}T12:00:00Z`)}</span>
            </>
          )}
        </p>
      )}

      {step === 2 && (
        <section aria-labelledby="step-date" className="space-y-4">
          <h2 id="step-date" className="text-lg font-bold">
            2. Choisissez une date
          </h2>
          {calendar.isError && <ErrorState error={null} />}
          <DatePicker
            value={date}
            min={today}
            max={maxDate}
            year={visibleMonth.year}
            month={visibleMonth.month}
            onMonthChange={(year, month) => setVisibleMonth({ year, month })}
            slotsByDate={calendar.slotsByDate}
            onChange={(d) => update({ date: d, slot: null })}
          />
          <p className="text-sm text-neutral-600">
            Les jours grisés n&apos;ont plus de créneau libre. Réservation possible jusqu&apos;à{" "}
            {BOOKING_HORIZON_DAYS} jours à l&apos;avance.
          </p>
        </section>
      )}

      {step === 3 && (
        <section aria-labelledby="step-slot" className="space-y-4">
          <h2 id="step-slot" className="text-lg font-bold">
            3. Choisissez un créneau
          </h2>
          {availability.isPending ? (
            <LoadingState label="Recherche des créneaux libres…" />
          ) : availability.isError ? (
            <ErrorState error={availability.error} onRetry={() => availability.refetch()} />
          ) : availability.data.slots.length === 0 ? (
            <EmptyState title="Plus aucun créneau libre ce jour-là.">
              <Button variant="secondary" onClick={() => goTo(2)}>
                Choisir une autre date
              </Button>
            </EmptyState>
          ) : (
            <SlotGrid
              slots={availability.data.slots}
              value={slot}
              onChange={(s) => update({ slot: s })}
            />
          )}
          <p className="text-sm text-neutral-600">Heures de Toronto (heure de l&apos;Est).</p>
        </section>
      )}

      {step === 4 && service && slot && (
        <section aria-labelledby="step-confirm" className="space-y-4">
          <h2 id="step-confirm" className="text-lg font-bold">
            4. Vérifiez et confirmez
          </h2>
          {availability.data && !availability.data.slots.includes(slot) && (
            <p
              role="alert"
              className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              Ce créneau n&apos;est plus disponible. Revenez à l&apos;étape précédente pour en
              choisir un autre.
            </p>
          )}
          <BookingSummary
            serviceName={service.name}
            durationMin={service.duration_min}
            priceCents={service.price_cents}
            startAt={slot}
          />
          {!user && (
            <p className="text-sm text-neutral-700">
              Vous devrez vous connecter (ou créer un compte) pour confirmer. Votre sélection sera
              conservée.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="secondary" onClick={() => goTo(3)}>
              Changer de créneau
            </Button>
            <Button onClick={confirm} loading={createBooking.isPending}>
              {user ? "Confirmer la réservation" : "Se connecter pour confirmer"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
