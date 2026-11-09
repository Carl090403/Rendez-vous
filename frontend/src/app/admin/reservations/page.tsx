import type { Metadata } from "next";

import { AdminBookings } from "./AdminBookings";

export const metadata: Metadata = { title: "Réservations" };

export default function AdminBookingsPage() {
  return <AdminBookings />;
}
