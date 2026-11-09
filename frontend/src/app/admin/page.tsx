import type { Metadata } from "next";

import { Dashboard } from "./Dashboard";

export const metadata: Metadata = { title: "Tableau de bord" };

export default function AdminPage() {
  return <Dashboard />;
}
