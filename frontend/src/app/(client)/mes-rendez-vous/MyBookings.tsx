"use client";

import { useState } from "react";

import { BookingCard } from "@/components/BookingCard";
import { PageHeader } from "@/components/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useCancelBooking, useMyBookings } from "@/hooks/useBookings";
import { errorMessage } from "@/lib/api";
import { CANCEL_LIMIT_HOURS, canClientCancel, formatDateTime } from "@/lib/dates";
import type { Booking } from "@/types";

type Tab = "upcoming" | "past";

export function MyBookings() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [toCancel, setToCancel] = useState<Booking | null>(null);
  const bookings = useMyBookings(tab);
  const cancel = useCancelBooking();
  const toast = useToast();

  const confirmCancel = () => {
    if (!toCancel) return;
    cancel.mutate(toCancel.id, {
      onSuccess: () =>
        toast.success("Rendez-vous annulé. Un courriel de confirmation vous a été envoyé."),
      onError: (error) => toast.error(errorMessage(error)),
      onSettled: () => setToCancel(null),
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <PageHeader
        title="Mes rendez-vous"
        action={<ButtonLink href="/reserver">Nouveau rendez-vous</ButtonLink>}
      />

      <div
        role="tablist"
        aria-label="Période"
        className="mb-6 inline-flex rounded-xl bg-neutral-100 p-1"
      >
        {(
          [
            ["upcoming", "À venir"],
            ["past", "Passés"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${
              tab === value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {bookings.isPending ? (
          <LoadingState />
        ) : bookings.isError ? (
          <ErrorState error={bookings.error} onRetry={() => bookings.refetch()} />
        ) : bookings.data.length === 0 ? (
          <EmptyState
            title={tab === "upcoming" ? "Aucun rendez-vous à venir." : "Aucun rendez-vous passé."}
          >
            {tab === "upcoming" && (
              <ButtonLink href="/reserver" variant="secondary">
                Réserver maintenant
              </ButtonLink>
            )}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {bookings.data.map((booking) => {
              const cancellable = booking.status === "confirmed" && tab === "upcoming";
              const inTime = canClientCancel(booking.start_at);
              return (
                <li key={booking.id}>
                  <BookingCard
                    booking={booking}
                    actions={
                      cancellable &&
                      (inTime ? (
                        <Button variant="secondary" onClick={() => setToCancel(booking)}>
                          Annuler
                        </Button>
                      ) : (
                        <p className="max-w-56 text-xs text-neutral-600 sm:text-right">
                          Annulation impossible moins de {CANCEL_LIMIT_HOURS} h avant. Contactez le
                          commerce.
                        </p>
                      ))
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        open={toCancel !== null}
        title="Annuler ce rendez-vous ?"
        onClose={() => setToCancel(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToCancel(null)}>
              Garder le rendez-vous
            </Button>
            <Button variant="danger" onClick={confirmCancel} loading={cancel.isPending}>
              Oui, annuler
            </Button>
          </>
        }
      >
        {toCancel && (
          <p>
            {toCancel.service.name}, le {formatDateTime(toCancel.start_at)}. Le créneau sera libéré
            pour un autre client.
          </p>
        )}
      </Modal>
    </div>
  );
}
