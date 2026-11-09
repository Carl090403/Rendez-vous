import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/States";

import { BookingFlow } from "./BookingFlow";

export const metadata: Metadata = { title: "Réserver" };

export default function BookPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <BookingFlow />
    </Suspense>
  );
}
