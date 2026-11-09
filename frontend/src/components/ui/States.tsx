import { CircleAlert, Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { errorMessage } from "@/lib/api";

import { Button } from "./Button";
import { Spinner } from "./Spinner";

// Chaque écran gère quatre états : chargement, vide, erreur, succès (section 10).

export function LoadingState({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex justify-center py-12 text-neutral-700">
      <Spinner label={label} />
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
      <Inbox className="size-8 text-neutral-400" aria-hidden="true" />
      <p className="font-semibold text-neutral-900">{title}</p>
      {children && <div className="text-sm text-neutral-600">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-red-900"
    >
      <CircleAlert className="size-7" aria-hidden="true" />
      <p className="text-sm">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      {message}
    </p>
  );
}
