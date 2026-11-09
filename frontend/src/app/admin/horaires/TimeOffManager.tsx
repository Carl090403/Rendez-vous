"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, FormError, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useAdminCancelBooking } from "@/hooks/useBookings";
import { useCreateTimeOff, useDeleteTimeOff, useTimeOff } from "@/hooks/useSchedule";
import { errorMessage } from "@/lib/api";
import { businessLocalToUtcIso, formatDateTime } from "@/lib/dates";
import { timeOffSchema, type TimeOffValues } from "@/lib/schemas";
import type { AdminBooking } from "@/types";

function AffectedBookingsModal({
  bookings,
  reason,
  onClose,
}: {
  bookings: AdminBooking[];
  reason: string;
  onClose: () => void;
}) {
  const cancel = useAdminCancelBooking();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const cancelAll = async () => {
    setPending(true);
    const motive = reason ? `Fermeture : ${reason}` : "Fermeture exceptionnelle du commerce";
    const results = await Promise.allSettled(
      bookings.map((b) => cancel.mutateAsync({ id: b.id, reason: motive })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0)
      toast.success(`${bookings.length} réservation(s) annulée(s). Les clients ont été prévenus.`);
    else toast.error(`${failed} annulation(s) ont échoué. Vérifiez la liste des réservations.`);
    setPending(false);
    onClose();
  };

  return (
    <Modal
      open={bookings.length > 0}
      title="Ce congé touche des réservations"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Les garder
          </Button>
          <Button variant="danger" loading={pending} onClick={cancelAll}>
            Annuler ces {bookings.length} réservation(s)
          </Button>
        </>
      }
    >
      <p>Le congé est enregistré. Ces réservations confirmées tombent pendant la fermeture :</p>
      <ul className="mt-3 space-y-2">
        {bookings.map((b) => (
          <li key={b.id} className="rounded-xl bg-neutral-100 p-3">
            <span className="font-semibold">
              {b.user.first_name} {b.user.last_name}
            </span>{" "}
            · {b.service.name}
            <br />
            {formatDateTime(b.start_at)}
          </li>
        ))}
      </ul>
      <p className="mt-3">Si vous les annulez, chaque client reçoit un courriel avec le motif.</p>
    </Modal>
  );
}

export function TimeOffManager() {
  const timeOff = useTimeOff();
  const create = useCreateTimeOff();
  const remove = useDeleteTimeOff();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [affected, setAffected] = useState<{ bookings: AdminBooking[]; reason: string }>({
    bookings: [],
    reason: "",
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TimeOffValues>({
    resolver: zodResolver(timeOffSchema),
    defaultValues: {
      start_date: "",
      start_time: "00:00",
      end_date: "",
      end_time: "23:59",
      reason: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    create.mutate(
      {
        start_at: businessLocalToUtcIso(values.start_date, values.start_time),
        end_at: businessLocalToUtcIso(values.end_date, values.end_time),
        reason: values.reason || null,
      },
      {
        onSuccess: (result) => {
          toast.success("Congé ajouté. Ces dates ne sont plus réservables.");
          reset();
          setAffected({ bookings: result.affected_bookings, reason: values.reason });
        },
        onError: (error) => setFormError(errorMessage(error)),
      },
    );
  });

  return (
    <section aria-labelledby="time-off-title" className="space-y-4">
      <div>
        <h2 id="time-off-title" className="text-2xl font-extrabold tracking-tight">
          Congés et fermetures
        </h2>
        <p className="mt-1 text-neutral-600">
          Les créneaux de ces périodes ne sont plus proposés aux clients.
        </p>
      </div>

      <Card>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError message={formError} />
          <div className="grid gap-4 sm:grid-cols-4">
            <Input
              label="Du (date)"
              type="date"
              error={errors.start_date?.message}
              {...register("start_date")}
            />
            <Input
              label="À partir de"
              type="time"
              error={errors.start_time?.message}
              {...register("start_time")}
            />
            <Input
              label="Au (date)"
              type="date"
              error={errors.end_date?.message}
              {...register("end_date")}
            />
            <Input
              label="Jusqu'à"
              type="time"
              error={errors.end_time?.message}
              {...register("end_time")}
            />
          </div>
          <Input
            label="Motif (facultatif)"
            placeholder="Vacances, formation…"
            error={errors.reason?.message}
            {...register("reason")}
          />
          <Button type="submit" loading={create.isPending}>
            Ajouter le congé
          </Button>
        </form>
      </Card>

      {timeOff.isPending ? (
        <LoadingState />
      ) : timeOff.isError ? (
        <ErrorState error={timeOff.error} onRetry={() => timeOff.refetch()} />
      ) : timeOff.data.length === 0 ? (
        <EmptyState title="Aucun congé prévu." />
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
          {timeOff.data.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-semibold">{t.reason || "Fermeture"}</p>
                <p className="text-sm text-neutral-600">
                  Du {formatDateTime(t.start_at)} au {formatDateTime(t.end_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                aria-label={`Supprimer le congé ${t.reason ?? ""}`.trim()}
                onClick={() =>
                  remove.mutate(t.id, {
                    onSuccess: () => toast.success("Congé supprimé."),
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Supprimer
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AffectedBookingsModal
        bookings={affected.bookings}
        reason={affected.reason}
        onClose={() => setAffected({ bookings: [], reason: "" })}
      />
    </section>
  );
}
