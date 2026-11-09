"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminCancelBooking } from "@/hooks/useBookings";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import type { AdminBooking } from "@/types";

/** Annulation par l'administrateur, sans limite de délai, avec motif facultatif (US-13). */
export function CancelBookingModal({
  booking,
  onClose,
}: {
  booking: AdminBooking | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const cancel = useAdminCancelBooking();
  const toast = useToast();

  const close = () => {
    setReason("");
    onClose();
  };

  const submit = () => {
    if (!booking) return;
    cancel.mutate(
      { id: booking.id, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Réservation annulée. Le client a été prévenu par courriel.");
          close();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <Modal
      open={booking !== null}
      title="Annuler cette réservation ?"
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Retour
          </Button>
          <Button variant="danger" onClick={submit} loading={cancel.isPending}>
            Annuler la réservation
          </Button>
        </>
      }
    >
      {booking && (
        <div className="space-y-4">
          <p>
            {booking.user.first_name} {booking.user.last_name} · {booking.service.name}, le{" "}
            {formatDateTime(booking.start_at)}.
          </p>
          <Textarea
            label="Motif (facultatif, envoyé au client)"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}
