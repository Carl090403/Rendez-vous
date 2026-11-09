import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/States";

import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Créer un compte" };

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RegisterForm />
    </Suspense>
  );
}
