import type { Metadata } from "next";

import { Profile } from "./Profile";

export const metadata: Metadata = { title: "Mon profil" };

export default function ProfilePage() {
  return <Profile />;
}
