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
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { safeNextPath } from "@/lib/format";
import { loginSchema, type LoginValues } from "@/lib/schemas";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      const user = await login(email, password);
      router.replace(safeNextPath(next, user.role === "admin" ? "/admin" : "/mes-rendez-vous"));
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthCard
      title="Connexion"
      description={
        next?.startsWith("/reserver")
          ? "Connectez-vous pour confirmer votre réservation."
          : undefined
      }
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href={`/inscription${query}`} className="font-semibold underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <div className="text-right">
          <Link href="/mot-de-passe-oublie" className="text-sm font-medium underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full">
          Se connecter
        </Button>
      </form>
    </AuthCard>
  );
}
