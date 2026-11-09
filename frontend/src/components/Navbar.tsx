"use client";

import { CalendarCheck, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";

export const BUSINESS_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Rendez-vous";

type NavLink = { href: string; label: string };

const GUEST_LINKS: NavLink[] = [{ href: "/reserver", label: "Réserver" }];
const CLIENT_LINKS: NavLink[] = [
  { href: "/reserver", label: "Réserver" },
  { href: "/mes-rendez-vous", label: "Mes rendez-vous" },
  { href: "/profil", label: "Profil" },
];
const ADMIN_LINKS: NavLink[] = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/reservations", label: "Réservations" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/horaires", label: "Horaires" },
];

export function Navbar() {
  const { user, isAdmin, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const menuOpen = openFor === pathname; // le menu mobile se referme à chaque navigation

  const links = !user ? GUEST_LINKS : isAdmin ? ADMIN_LINKS : CLIENT_LINKS;
  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const handleLogout = async () => {
    setOpenFor(null);
    await logout();
    toast.success("Vous êtes déconnecté.");
    router.push("/");
  };

  const linkClass = (href: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive(href) ? "bg-neutral-100 text-neutral-900" : "text-neutral-700 hover:text-neutral-900"
    }`;

  const accountActions = isLoading ? null : user ? (
    <button
      type="button"
      onClick={handleLogout}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
    >
      <LogOut className="size-4" aria-hidden="true" />
      Déconnexion
    </button>
  ) : (
    <>
      <Link href="/connexion" className={linkClass("/connexion")}>
        Connexion
      </Link>
      <Link
        href="/inscription"
        className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
      >
        Créer un compte
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4"
      >
        <Link
          href={isAdmin ? "/admin" : "/"}
          className="flex items-center gap-2 font-extrabold text-neutral-900"
        >
          <CalendarCheck className="size-6" aria-hidden="true" />
          {BUSINESS_NAME}
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass(link.href)}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
          <span className="mx-2 h-6 w-px bg-neutral-200" aria-hidden="true" />
          {user && (
            <span className="px-2 text-sm text-neutral-600">
              {user.first_name}
              {isAdmin && " (admin)"}
            </span>
          )}
          {accountActions}
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-neutral-900 md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpenFor(menuOpen ? null : pathname)}
        >
          {menuOpen ? (
            <X className="size-6" aria-hidden="true" />
          ) : (
            <Menu className="size-6" aria-hidden="true" />
          )}
        </button>
      </nav>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-neutral-200 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={linkClass(link.href)}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-neutral-200" />
            {user && <p className="px-3 text-sm text-neutral-600">Connecté : {user.email}</p>}
            {accountActions}
          </div>
        </div>
      )}
    </header>
  );
}
