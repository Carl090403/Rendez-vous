import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-sm font-semibold text-neutral-500">Erreur 404</p>
      <h1 className="mt-2 text-2xl font-extrabold">Cette page n&apos;existe pas</h1>
      <p className="mt-3 text-neutral-600">
        Le lien est peut-être incorrect ou la page a été déplacée.
      </p>
      <ButtonLink href="/" className="mt-6">
        Retour à l&apos;accueil
      </ButtonLink>
    </div>
  );
}
