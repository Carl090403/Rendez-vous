import { CalendarDays, Clock } from "lucide-react";
import type { ReactNode } from "react";

import { formatLongDate, formatTime } from "@/lib/dates";
import { formatDuration, formatPrice } from "@/lib/format";
import type { AdminBooking, Booking } from "@/types";

import { StatusBadge } from "./ui/Badge";

type BookingCardProps = {
  booking: Booking | AdminBooking;
  actions?: ReactNode;
  footer?: ReactNode;
};

export function BookingCard({ booking, actions, footer }: BookingCardProps) {
  const client = "user" in booking ? booking.user : null;
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-neutral-900">{booking.service.name}</h3>
            <StatusBadge status={booking.status} />
          </div>
          <p className="flex items-center gap-2 text-sm text-neutral-700 capitalize">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            {formatLongDate(booking.start_at)}
          </p>
          <p className="flex items-center gap-2 text-sm text-neutral-700">
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            {formatTime(booking.start_at)} – {formatTime(booking.end_at)} ·{" "}
            {formatDuration(booking.service.duration_min)} ·{" "}
            {formatPrice(booking.service.price_cents)}
          </p>
          {client && (
            <p className="text-sm text-neutral-700">
              <span className="font-medium text-neutral-900">
                {client.first_name} {client.last_name}
              </span>{" "}
              ·{" "}
              <a className="underline" href={`mailto:${client.email}`}>
                {client.email}
              </a>
            </p>
          )}
          {booking.cancel_reason && (
            <p className="text-sm text-neutral-600">Motif : {booking.cancel_reason}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-col gap-2 sm:items-end">{actions}</div>}
      </div>
      {footer}
    </article>
  );
}
