import { Clock } from "lucide-react";
import type { ReactNode } from "react";

import { formatDuration, formatPrice } from "@/lib/format";
import type { Service } from "@/types";

type ServiceCardProps = {
  service: Service;
  selected?: boolean;
  onSelect?: () => void;
  action?: ReactNode;
};

export function ServiceCard({ service, selected = false, onSelect, action }: ServiceCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold text-neutral-900">{service.name}</h3>
        <span className="shrink-0 text-base font-bold text-neutral-900">
          {formatPrice(service.price_cents)}
        </span>
      </div>
      {service.description && (
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{service.description}</p>
      )}
      <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700">
        <Clock className="size-4" aria-hidden="true" />
        {formatDuration(service.duration_min)}
      </p>
    </>
  );

  const base = "block w-full rounded-2xl border bg-white p-5 text-left transition-colors";

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`${base} hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
          selected ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200"
        }`}
      >
        {body}
      </button>
    );
  }

  return (
    <article className={`${base} flex flex-col border-neutral-200`}>
      <div className="flex-1">{body}</div>
      {action && <div className="mt-5">{action}</div>}
    </article>
  );
}
