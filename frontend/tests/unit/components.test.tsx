import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { validateWeek } from "@/app/admin/horaires/BusinessHoursEditor";
import { BookingCard } from "@/components/BookingCard";
import { DatePicker } from "@/components/DatePicker";
import { SlotGrid } from "@/components/SlotGrid";
import type { AdminBooking } from "@/types";

describe("SlotGrid", () => {
  const slots = ["2026-11-10T09:00:00-05:00", "2026-11-10T09:15:00-05:00"];

  it("affiche chaque créneau à l'heure de Toronto et signale la sélection", async () => {
    const onChange = vi.fn();
    render(<SlotGrid slots={slots} value={slots[1]} onChange={onChange} />);

    const first = screen.getByRole("button", { name: "9 h 00" });
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "9 h 15" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(first);
    expect(onChange).toHaveBeenCalledWith(slots[0]);
  });
});

describe("DatePicker", () => {
  const baseProps = {
    value: null,
    min: "2026-11-09",
    max: "2027-01-08",
    year: 2026,
    month: 10,
    onChange: vi.fn(),
    onMonthChange: vi.fn(),
  };

  it("grise les jours sans créneau et hors de l'horizon", async () => {
    const onChange = vi.fn();
    const slotsByDate = new Map([
      ["2026-11-10", 12],
      ["2026-11-14", 0],
    ]);
    render(<DatePicker {...baseProps} slotsByDate={slotsByDate} onChange={onChange} />);

    const available = screen.getByRole("gridcell", { name: /mardi 10 novembre 2026, 12 créneaux/ });
    expect(available).toBeEnabled();
    expect(screen.getByRole("gridcell", { name: /samedi 14 novembre 2026, aucun/ })).toBeDisabled();
    expect(screen.getByRole("gridcell", { name: /dimanche 8 novembre 2026/ })).toBeDisabled(); // passé

    await userEvent.click(available);
    expect(onChange).toHaveBeenCalledWith("2026-11-10");
  });

  it("ne permet pas de reculer avant le mois courant ni d'avancer après l'horizon", async () => {
    const onMonthChange = vi.fn();
    const { rerender } = render(
      <DatePicker {...baseProps} slotsByDate={new Map()} onMonthChange={onMonthChange} />,
    );
    expect(screen.getByRole("button", { name: "Mois précédent" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Mois suivant" }));
    expect(onMonthChange).toHaveBeenCalledWith(2026, 11);

    rerender(<DatePicker {...baseProps} year={2027} month={0} slotsByDate={new Map()} />);
    expect(screen.getByRole("button", { name: "Mois suivant" })).toBeDisabled();
  });
});

describe("BookingCard", () => {
  it("affiche le service, l'heure locale, le statut et le client pour l'administrateur", () => {
    const booking: AdminBooking = {
      id: "b1",
      service: { id: "s1", name: "Consultation 45 min", duration_min: 45, price_cents: 6500 },
      start_at: "2026-11-10T14:15:00Z",
      end_at: "2026-11-10T15:00:00Z",
      status: "cancelled_by_admin",
      cancelled_at: "2026-11-09T12:00:00Z",
      cancel_reason: "Fermeture imprévue",
      created_at: "2026-11-01T12:00:00Z",
      user: { id: "u1", first_name: "Alex", last_name: "Tremblay", email: "alex@exemple.com" },
    };
    render(<BookingCard booking={booking} />);
    expect(screen.getByText("Consultation 45 min")).toBeInTheDocument();
    expect(screen.getByText("Annulé par le commerce")).toBeInTheDocument();
    expect(screen.getByText(/9 h 15 – 10 h 00/)).toBeInTheDocument();
    expect(screen.getByText("alex@exemple.com")).toHaveAttribute("href", "mailto:alex@exemple.com");
    expect(screen.getByText("Motif : Fermeture imprévue")).toBeInTheDocument();
  });
});

describe("validation des heures d'ouverture", () => {
  const week = (ranges: { start: string; end: string }[]) => [
    ranges.map((r, i) => ({ key: i, ...r })),
    [],
    [],
    [],
    [],
    [],
    [],
  ];

  it("accepte une pause de midi", () => {
    expect(
      validateWeek(
        week([
          { start: "09:00", end: "12:00" },
          { start: "13:00", end: "17:00" },
        ]),
      ),
    ).toBeNull();
  });

  it("refuse une plage inversée ou des plages qui se chevauchent", () => {
    expect(validateWeek(week([{ start: "12:00", end: "09:00" }]))).toMatch(/Lundi/);
    expect(
      validateWeek(
        week([
          { start: "09:00", end: "12:00" },
          { start: "11:00", end: "14:00" },
        ]),
      ),
    ).toMatch(/chevauchent/);
  });
});
