import { CalendarDays, Clock, Tag } from "lucide-react";

import { formatLongDate, formatTime } from "@/lib/dates";
import { formatDuration, formatPrice } from "@/lib/format";

type BookingSummaryProps = {
  serviceName: string;
  durationMin: number;
  priceCents: number;
  startAt: string;
};

export function BookingSummary({
  serviceName,
  durationMin,
  priceCents,
  startAt,
}: BookingSummaryProps) {
  return (
    <dl className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-start gap-3 p-4">
        <Tag className="mt-0.5 size-4 shrink-0 text-neutral-500" aria-hidden="true" />
        <div>
          <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Service</dt>
          <dd className="font-semibold text-neutral-900">{serviceName}</dd>
        </div>
      </div>
      <div className="flex items-start gap-3 p-4">
        <CalendarDays className="mt-0.5 size-4 shrink-0 text-neutral-500" aria-hidden="true" />
        <div>
          <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Date</dt>
          <dd className="font-semibold text-neutral-900 capitalize">{formatLongDate(startAt)}</dd>
        </div>
      </div>
      <div className="flex items-start gap-3 p-4">
        <Clock className="mt-0.5 size-4 shrink-0 text-neutral-500" aria-hidden="true" />
        <div>
          <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Heure</dt>
          <dd className="font-semibold text-neutral-900">
            {formatTime(startAt)} · {formatDuration(durationMin)}
          </dd>
        </div>
      </div>
      <div className="flex items-center justify-between p-4">
        <dt className="text-sm font-medium text-neutral-700">Prix</dt>
        <dd className="text-lg font-bold text-neutral-900">{formatPrice(priceCents)}</dd>
      </div>
    </dl>
  );
}
