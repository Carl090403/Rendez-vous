import { STATUS_LABELS } from "@/lib/format";
import type { BookingStatus } from "@/types";

const TONES = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<BookingStatus, keyof typeof TONES> = {
  confirmed: "green",
  cancelled_by_client: "red",
  cancelled_by_admin: "red",
  completed: "neutral",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
