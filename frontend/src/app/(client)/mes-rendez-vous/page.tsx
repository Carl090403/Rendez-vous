import type { Metadata } from "next";

import { MyBookings } from "./MyBookings";

export const metadata: Metadata = { title: "Mes rendez-vous" };

export default function MyBookingsPage() {
  return <MyBookings />;
}
