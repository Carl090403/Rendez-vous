"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, FormError, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useSaveService, useServices } from "@/hooks/useServices";
import { errorMessage } from "@/lib/api";
import { formatDuration, formatPrice, parsePriceToCents } from "@/lib/format";
import { serviceSchema, type ServiceFormValues } from "@/lib/schemas";
import type { Service } from "@/types";

const EMPTY: ServiceFormValues = {
  name: "",
  description: "",
  duration_min: "30",
  price: "",
  is_active: true,
};

function toFormValues(service: Service): ServiceFormValues {
  return {
    name: service.name,
    description: service.description,
    duration_min: String(service.duration_min),
    price: (service.price_cents / 100).toFixed(2).replace(".", ","),
    is_active: service.is_active,
  };
}

function ServiceForm({ service, onDone }: { service: Service | null; onDone: () => void }) {
  const save = useSaveService();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: service ? toFormValues(service) : EMPTY,
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    const data = {
      name: values.name,
      description: values.description,
      duration_min: Number(values.duration_min),
      price_cents: parsePriceToCents(values.price) ?? 0,
      is_active: values.is_active,
    };
    save.mutate(
      { id: service?.id, data },
      {
        onSuccess: () => {
          toast.success(service ? "Service modifié." : "Service créé.");
          onDone();
        },
        onError: (error) => setFormError(errorMessage(error)),
      },
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      <Input label="Nom" error={errors.name?.message} {...register("name")} />
      <Textarea
        label="Description"
        rows={3}
        error={errors.description?.message}
        {...register("description")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Durée (minutes)"
          inputMode="numeric"
          error={errors.duration_min?.message}
          {...register("duration_min")}
        />
        <Input
          label="Prix ($ CAD)"
          inputMode="decimal"
          placeholder="45,00"
          error={errors.price?.message}
          {...register("price")}
        />
      </div>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" className="size-5 accent-neutral-900" {...register("is_active")} />
        Service actif (visible et réservable par les clients)
      </label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" loading={save.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

export function AdminServices() {
  const services = useServices(true);
  const save = useSaveService();
  const toast = useToast();
  // null = fermé, "new" = création, sinon le service en cours de modification.
  const [editing, setEditing] = useState<Service | "new" | null>(null);

  const toggle = (service: Service) =>
    save.mutate(
      { id: service.id, data: { is_active: !service.is_active } },
      {
        onSuccess: (s) => toast.success(s.is_active ? "Service réactivé." : "Service désactivé."),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  return (
    <>
      <PageHeader
        title="Services"
        description="Un service désactivé disparaît du catalogue, mais ses réservations sont conservées."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden="true" />
            Nouveau service
          </Button>
        }
      />

      {services.isPending ? (
        <LoadingState />
      ) : services.isError ? (
        <ErrorState error={services.error} onRetry={() => services.refetch()} />
      ) : services.data.length === 0 ? (
        <EmptyState title="Aucun service pour le moment.">Créez votre premier service.</EmptyState>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {services.data.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{s.name}</p>
                  <Badge tone={s.is_active ? "green" : "neutral"}>
                    {s.is_active ? "Actif" : "Désactivé"}
                  </Badge>
                </div>
                <p className="text-sm text-neutral-600">
                  {formatDuration(s.duration_min)} · {formatPrice(s.price_cents)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(s)}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Modifier
                </Button>
                <Button variant="ghost" onClick={() => toggle(s)} disabled={save.isPending}>
                  {s.is_active ? "Désactiver" : "Réactiver"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        title={editing === "new" ? "Nouveau service" : "Modifier le service"}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <ServiceForm
            key={editing === "new" ? "new" : editing.id}
            service={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}
