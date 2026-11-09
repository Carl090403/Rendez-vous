"use client";

import { ServiceCard } from "@/components/ServiceCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useServices } from "@/hooks/useServices";

export function ServicesCatalog() {
  const { data: services, isPending, isError, error, refetch } = useServices();

  if (isPending) return <LoadingState label="Chargement des services…" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (services.length === 0) {
    return <EmptyState title="Aucun service n'est offert pour le moment." />;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <li key={service.id} className="flex">
          <ServiceCard
            service={service}
            action={
              <ButtonLink
                href={`/reserver?service=${service.id}`}
                variant="secondary"
                className="w-full"
              >
                Réserver ce service
              </ButtonLink>
            }
          />
        </li>
      ))}
    </ul>
  );
}
