"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { LoadingState } from "@/components/ui/States";
import { useAuth } from "@/lib/auth";

function currentPath(): string {
  return window.location.pathname + window.location.search;
}

/** Redirige vers la connexion (avec retour à la page demandée) si personne n'est connecté. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/connexion?next=${encodeURIComponent(currentPath())}`);
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) return <LoadingState />;
  return <>{children}</>;
}

/** Réservé à l'administrateur : les autres sont redirigés (l'API refuse de toute façon). */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace(`/connexion?next=${encodeURIComponent(currentPath())}`);
    else if (!isAdmin) router.replace("/");
  }, [isLoading, user, isAdmin, router]);

  if (isLoading || !isAdmin) return <LoadingState />;
  return <>{children}</>;
}
