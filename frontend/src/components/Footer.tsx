import { BUSINESS_NAME } from "./Navbar";

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
        <p>© {BUSINESS_NAME} · Heures affichées à l&apos;heure de Toronto (HE)</p>
        <p>Annulation gratuite jusqu&apos;à 24 h avant le rendez-vous.</p>
      </div>
    </footer>
  );
}
