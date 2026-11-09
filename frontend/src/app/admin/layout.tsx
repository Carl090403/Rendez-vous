import type { ReactNode } from "react";

import { AdminRoute } from "@/components/ProtectedRoute";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminRoute>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">{children}</div>
    </AdminRoute>
  );
}
