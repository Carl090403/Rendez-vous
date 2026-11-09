"use client";

import { useState } from "react";

import { BookingCard } from "@/components/BookingCard";
import { CancelBookingModal } from "@/components/CancelBookingModal";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useAdminBookings, type AdminBookingFilters } from "@/hooks/useBookings";
import { useServices } from "@/hooks/useServices";
import { STATUS_LABELS } from "@/lib/format";
import type { AdminBooking, BookingStatus } from "@/types";

const PAGE_SIZE = 20;

export function AdminBookings() {
  const [filters, setFilters] = useState<AdminBookingFilters>({ page: 1, page_size: PAGE_SIZE });
  const [toCancel, setToCancel] = useState<AdminBooking | null>(null);
  const [now] = useState(() => Date.now());
  const bookings = useAdminBookings(filters);
  const services = useServices(true);

  const setFilter = (patch: Partial<AdminBookingFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }));

  const totalPages = bookings.data ? Math.max(1, Math.ceil(bookings.data.total / PAGE_SIZE)) : 1;
  const page = filters.page ?? 1;

  return (
    <>
      <PageHeader
        title="Réservations"
        description="Toutes les réservations, filtrables par date, statut et service."
      />

      <div className="mb-6 grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-4 sm:items-end">
        <Input
          label="Date"
          type="date"
          value={filters.date ?? ""}
          onChange={(e) => setFilter({ date: e.target.value || undefined })}
        />
        <Select
          label="Statut"
          value={filters.status ?? ""}
          onChange={(e) =>
            setFilter({ status: (e.target.value || undefined) as BookingStatus | undefined })
          }
        >
          <option value="">Tous</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          label="Service"
          value={filters.service_id ?? ""}
          onChange={(e) => setFilter({ service_id: e.target.value || undefined })}
        >
          <option value="">Tous</option>
          {services.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Button variant="ghost" onClick={() => setFilters({ page: 1, page_size: PAGE_SIZE })}>
          Réinitialiser les filtres
        </Button>
      </div>

      {bookings.isPending ? (
        <LoadingState />
      ) : bookings.isError ? (
        <ErrorState error={bookings.error} onRetry={() => bookings.refetch()} />
      ) : bookings.data.items.length === 0 ? (
        <EmptyState title="Aucune réservation ne correspond à ces filtres." />
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-600" aria-live="polite">
            {bookings.data.total} réservation{bookings.data.total > 1 ? "s" : ""}
          </p>
          <ul className="space-y-3">
            {bookings.data.items.map((b) => (
              <li key={b.id}>
                <BookingCard
                  booking={b}
                  actions={
                    b.status === "confirmed" &&
                    new Date(b.end_at).getTime() > now && (
                      <Button variant="secondary" onClick={() => setToCancel(b)}>
                        Annuler
                      </Button>
                    )
                  }
                />
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}
              >
                Précédent
              </Button>
              <span className="text-sm text-neutral-700">
                Page {page} sur {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}
              >
                Suivant
              </Button>
            </nav>
          )}
        </>
      )}

      <CancelBookingModal booking={toCancel} onClose={() => setToCancel(null)} />
    </>
  );
}
