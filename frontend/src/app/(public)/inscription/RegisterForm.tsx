"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { FormError } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { errorMessage, isApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { safeNextPath } from "@/lib/format";
import { registerSchema, type RegisterValues } from "@/lib/schemas";

export function RegisterForm() {
  const { register: createAccount } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const next = useSearchParams().get("next");
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async ({ confirm: _confirm, ...data }) => {
    setFormError(null);
    try {
      await createAccount(data);
      toast.success("Votre compte est créé. Bienvenue !");
      router.replace(safeNextPath(next, "/reserver"));
    } catch (error) {
      if (isApiError(error, "EMAIL_EXISTS")) {
        setError("email", { message: error.message });
      } else if (isApiError(error, "VALIDATION_ERROR") && error.details.length > 0) {
        // Ex. mot de passe trop courant : refusé par le serveur avec un message précis.
        for (const detail of error.details) {
          const field = detail.field as keyof RegisterValues;
          setError(field, { message: detail.message.replace(/^Value error, /, "") });
        }
      } else {
        setFormError(errorMessage(error));
      }
    }
  });

  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthCard
      title="Créer un compte"
      description="Il vous servira à réserver, retrouver et annuler vos rendez-vous."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link href={`/connexion${query}`} className="font-semibold underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Prénom"
            autoComplete="given-name"
            error={errors.first_name?.message}
            {...register("first_name")}
          />
          <Input
            label="Nom"
            autoComplete="family-name"
            error={errors.last_name?.message}
            {...register("last_name")}
          />
        </div>
        <Input
          label="Courriel"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          hint="8 caractères minimum."
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register("confirm")}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Créer mon compte
        </Button>
      </form>
    </AuthCard>
  );
}
