"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthCard } from "@/components/AuthCard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { FormError } from "@/components/ui/States";
import { api, errorMessage, isApiError } from "@/lib/api";
import { resetSchema, type ResetValues } from "@/lib/schemas";

export function ResetForm() {
  const token = useSearchParams().get("token");
  const [done, setDone] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  if (!token) {
    return (
      <AuthCard title="Lien invalide" description="Ce lien de réinitialisation est incomplet.">
        <ButtonLink href="/mot-de-passe-oublie" className="w-full">
          Demander un nouveau lien
        </ButtonLink>
      </AuthCard>
    );
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      const { message } = await api.resetPassword(token, password);
      setDone(message);
    } catch (error) {
      if (isApiError(error, "VALIDATION_ERROR") && error.details.length > 0) {
        setError("password", { message: error.details[0].message.replace(/^Value error, /, "") });
      } else {
        setFormError(errorMessage(error));
      }
    }
  });

  return (
    <AuthCard title="Choisir un nouveau mot de passe">
      {done ? (
        <div className="space-y-4">
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          >
            {done}
          </p>
          <ButtonLink href="/connexion" className="w-full">
            Se connecter
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError message={formError} />
          {formError && (
            <p className="text-sm">
              <Link href="/mot-de-passe-oublie" className="font-semibold underline">
                Demander un nouveau lien
              </Link>
            </p>
          )}
          <Input
            label="Nouveau mot de passe"
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
            Enregistrer
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
