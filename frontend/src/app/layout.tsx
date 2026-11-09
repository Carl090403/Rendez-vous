import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import { Footer } from "@/components/Footer";
import { BUSINESS_NAME, Navbar } from "@/components/Navbar";

import "./globals.css";
import { Providers } from "./providers";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${BUSINESS_NAME} — Réservation en ligne`, template: `%s · ${BUSINESS_NAME}` },
  description:
    "Réservez votre rendez-vous en ligne en moins de deux minutes : choisissez un service, une date et un créneau libre.",
};

export const viewport: Viewport = { themeColor: "#171717" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <a
            href="#contenu"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
          >
            Aller au contenu
          </a>
          <Navbar />
          <main id="contenu" className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
