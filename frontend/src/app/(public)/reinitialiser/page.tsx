import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/States";

import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ResetForm />
    </Suspense>
  );
}
