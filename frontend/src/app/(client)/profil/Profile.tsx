"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage, isApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  passwordChangeSchema,
  profileSchema,
  type PasswordChangeValues,
  type ProfileValues,
} from "@/lib/schemas";
import type { User } from "@/types";

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: user.first_name, last_name: user.last_name },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const updated = await api.updateMe(values);
      setUser(updated);
      reset({ first_name: updated.first_name, last_name: updated.last_name });
      toast.success("Profil mis à jour.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Card>
      <h2 className="text-lg font-bold">Informations</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
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
          value={user.email}
          disabled
          readOnly
          hint="Le courriel ne peut pas être modifié."
        />
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Enregistrer
        </Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChangeValues>({ resolver: zodResolver(passwordChangeSchema) });

  const onSubmit = handleSubmit(async ({ current_password, new_password }) => {
    try {
      await api.updateMe({ current_password, new_password });
      reset({ current_password: "", new_password: "", confirm: "" });
      toast.success("Mot de passe modifié.");
    } catch (error) {
      if (isApiError(error, "INVALID_PASSWORD"))
        setError("current_password", { message: error.message });
      else if (isApiError(error, "VALIDATION_ERROR") && error.details.length > 0) {
        setError("new_password", {
          message: error.details[0].message.replace(/^Value error, /, ""),
        });
      } else toast.error(errorMessage(error));
    }
  });

  return (
    <Card>
      <h2 className="text-lg font-bold">Mot de passe</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
        <Input
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          error={errors.current_password?.message}
          {...register("current_password")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            error={errors.new_password?.message}
            {...register("new_password")}
          />
          <Input
            label="Confirmer"
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register("confirm")}
          />
        </div>
        <Button type="submit" loading={isSubmitting}>
          Changer le mot de passe
        </Button>
      </form>
    </Card>
  );
}

function DeleteAccount() {
  const { setUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    setPending(true);
    try {
      await api.deleteMe();
      setUser(null);
      toast.success("Votre compte a été supprimé.");
      router.replace("/");
    } catch (error) {
      toast.error(errorMessage(error));
      setPending(false);
      setOpen(false);
    }
  };

  return (
    <Card className="border-red-200">
      <h2 className="text-lg font-bold">Supprimer mon compte</h2>
      <p className="mt-2 text-sm text-neutral-700">
        Vos données personnelles (nom, courriel) sont effacées et vos rendez-vous à venir sont
        annulés. Cette action est définitive.
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        Supprimer mon compte
      </Button>
      <Modal
        open={open}
        title="Supprimer définitivement votre compte ?"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button variant="danger" loading={pending} onClick={remove}>
              Supprimer
            </Button>
          </>
        }
      >
        Vous ne pourrez plus vous connecter avec ce compte.
      </Modal>
    </Card>
  );
}

export function Profile() {
  const { user, isAdmin } = useAuth();
  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-12">
      <PageHeader title="Mon profil" />
      <ProfileForm user={user} />
      <PasswordForm />
      {!isAdmin && <DeleteAccount />}
    </div>
  );
}
