"use client";

import { useMemo } from "react";

import { BookingCard } from "@/components/BookingCard";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useAdminBookings } from "@/hooks/useBookings";
import { addDaysToKey, businessDateOf, formatLongDate, todayInBusinessTz } from "@/lib/dates";
import { formatPrice } from "@/lib/format";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-neutral-900">{value}</p>
    </div>
  );
}

export function Dashboard() {
  const today = useMemo(() => todayInBusinessTz(), []);
  const weekEnd = addDaysToKey(today, 6);
  const week = useAdminBookings({
    status: "confirmed",
    date_from: today,
    date_to: weekEnd,
    page_size: 100,
  });

  const todays = week.data?.items.filter((b) => businessDateOf(b.start_at) === today) ?? [];
  const revenue = week.data?.items.reduce((sum, b) => sum + b.service.price_cents, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={<span className="capitalize">{formatLongDate(`${today}T12:00:00Z`)}</span>}
        action={<ButtonLink href="/admin/reservations">Toutes les réservations</ButtonLink>}
      />

      {week.isPending ? (
        <LoadingState />
      ) : week.isError ? (
        <ErrorState error={week.error} onRetry={() => week.refetch()} />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Rendez-vous aujourd'hui" value={todays.length} />
            <Stat label="Rendez-vous sur 7 jours" value={week.data.total} />
            <Stat label="Revenus prévus sur 7 jours" value={formatPrice(revenue)} />
          </div>

          <section aria-labelledby="today-title" className="space-y-3">
            <h2 id="today-title" className="text-lg font-bold">
              Aujourd&apos;hui
            </h2>
            {todays.length === 0 ? (
              <EmptyState title="Aucun rendez-vous aujourd'hui." />
            ) : (
              <ul className="space-y-3">
                {todays.map((b) => (
                  <li key={b.id}>
                    <BookingCard booking={b} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="week-title" className="space-y-3">
            <h2 id="week-title" className="text-lg font-bold">
              Les 7 prochains jours
            </h2>
            {week.data.items.length === 0 ? (
              <EmptyState title="Aucun rendez-vous cette semaine." />
            ) : (
              <ul className="space-y-3">
                {week.data.items.map((b) => (
                  <li key={b.id}>
                    <BookingCard booking={b} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
