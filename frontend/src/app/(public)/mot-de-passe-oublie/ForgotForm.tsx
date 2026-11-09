"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { FormError } from "@/components/ui/States";
import { api, errorMessage } from "@/lib/api";
import { forgotSchema, type ForgotValues } from "@/lib/schemas";

export function ForgotForm() {
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      const { message } = await api.forgotPassword(email);
      setSentMessage(message);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Indiquez votre courriel : nous vous enverrons un lien valide 1 heure pour choisir un nouveau mot de passe."
      footer={
        <Link href="/connexion" className="font-semibold underline">
          Retour à la connexion
        </Link>
      }
    >
      {sentMessage ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          {sentMessage}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError message={formError} />
          <Input
            label="Courriel"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Button type="submit" loading={isSubmitting} className="w-full">
            Envoyer le lien
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
