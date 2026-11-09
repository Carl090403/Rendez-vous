import { CalendarCheck, Mail, ShieldCheck } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";

import { ServicesCatalog } from "./ServicesCatalog";

const STEPS = [
  {
    icon: CalendarCheck,
    title: "Choisissez",
    text: "Un service, une date et un créneau libre en temps réel.",
  },
  { icon: Mail, title: "Recevez", text: "Une confirmation par courriel dès que vous réservez." },
  {
    icon: ShieldCheck,
    title: "Gardez la main",
    text: "Annulez vous-même jusqu'à 24 h avant le rendez-vous.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:py-16">
      <section className="mx-auto max-w-3xl space-y-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">
          Prenez rendez-vous en ligne, en moins de deux minutes.
        </h1>
        <p className="text-lg text-neutral-600">
          Sans appeler : voyez les créneaux libres, réservez et recevez votre confirmation
          immédiatement.
        </p>
        <ButtonLink href="/reserver" className="px-6 py-3 text-base">
          Réserver un rendez-vous
        </ButtonLink>
      </section>

      <section aria-labelledby="services-title" className="space-y-6">
        <div>
          <h2 id="services-title" className="text-2xl font-bold text-neutral-900">
            Services et tarifs
          </h2>
          <p className="mt-1 text-neutral-600">Prix affichés en dollars canadiens.</p>
        </div>
        <ServicesCatalog />
      </section>

      <section aria-labelledby="how-title" className="space-y-6">
        <h2 id="how-title" className="text-2xl font-bold text-neutral-900">
          Comment ça marche
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <Icon className="size-6 text-neutral-900" aria-hidden="true" />
              <p className="mt-3 font-semibold">
                {index + 1}. {title}
              </p>
              <p className="mt-1 text-sm text-neutral-600">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
