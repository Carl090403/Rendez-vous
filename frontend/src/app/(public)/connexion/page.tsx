import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/States";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoginForm />
    </Suspense>
  );
}
