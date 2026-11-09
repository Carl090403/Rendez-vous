import { describe, expect, it } from "vitest";

import {
  addDaysToKey,
  businessDateOf,
  businessLocalToUtcIso,
  canClientCancel,
  formatDateTime,
  formatLongDate,
  formatTime,
  monthGrid,
  todayInBusinessTz,
  weekdayOfKey,
} from "@/lib/dates";
import { formatDuration, formatPrice, parsePriceToCents, safeNextPath } from "@/lib/format";

// La machine de test est réglée sur Tokyo (vitest.config.mts) : l'affichage doit
// pourtant toujours être celui de Toronto.
describe("dates (America/Toronto)", () => {
  it("affiche l'heure de Toronto, jour de la semaine en toutes lettres", () => {
    expect(formatDateTime("2026-11-10T14:15:00Z")).toBe("mardi 10 novembre 2026 à 9 h 15");
    expect(formatTime("2026-07-06T13:05:00Z")).toBe("9 h 05"); // heure avancée, UTC-4
  });

  it("gère les deux dimanches de changement d'heure", () => {
    expect(formatTime("2026-03-08T13:00:00Z")).toBe("9 h 00"); // après le passage à l'heure d'été
    expect(formatTime("2026-03-07T14:00:00Z")).toBe("9 h 00"); // la veille, UTC-5
    expect(formatTime("2026-11-01T14:00:00Z")).toBe("9 h 00"); // retour à l'heure normale
    expect(businessLocalToUtcIso("2026-03-08", "09:00")).toBe("2026-03-08T13:00:00.000Z");
    expect(businessLocalToUtcIso("2026-11-01", "09:00")).toBe("2026-11-01T14:00:00.000Z");
  });

  it("calcule la date locale d'un instant", () => {
    // 3 h UTC le 11 novembre = 22 h le 10 novembre à Toronto.
    expect(businessDateOf("2026-11-11T03:00:00Z")).toBe("2026-11-10");
    expect(todayInBusinessTz(new Date("2026-11-11T03:00:00Z"))).toBe("2026-11-10");
    expect(formatLongDate("2026-11-11T03:00:00Z")).toBe("mardi 10 novembre 2026");
  });

  it("fait l'arithmétique de calendrier sans effet de fuseau", () => {
    expect(addDaysToKey("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDaysToKey("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOfKey("2026-11-09")).toBe(0); // lundi
    expect(weekdayOfKey("2026-11-15")).toBe(6); // dimanche
  });

  it("construit une grille de mois commençant le lundi", () => {
    const grid = monthGrid(2026, 10); // novembre 2026 commence un dimanche
    expect(grid.length % 7).toBe(0);
    expect(grid.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(grid.filter(Boolean)).toHaveLength(30);
  });

  it("indique si le client peut encore annuler (24 h)", () => {
    const now = new Date("2026-11-09T14:15:00Z");
    expect(canClientCancel("2026-11-10T14:15:00Z", now)).toBe(true); // exactement 24 h
    expect(canClientCancel("2026-11-10T14:14:00Z", now)).toBe(false);
  });
});

describe("formats", () => {
  it("affiche les prix en dollars canadiens à partir des cents", () => {
    expect(formatPrice(6500).replace(/\s/g, " ")).toBe("65,00 $");
    expect(formatPrice(123456).replace(/\s/g, " ")).toBe("1 234,56 $");
  });

  it("affiche les durées", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30");
  });

  it("convertit un prix saisi en cents", () => {
    expect(parsePriceToCents("45")).toBe(4500);
    expect(parsePriceToCents("45,5")).toBe(4550);
    expect(parsePriceToCents("45.99")).toBe(4599);
    expect(parsePriceToCents("abc")).toBeNull();
    expect(parsePriceToCents("-5")).toBeNull();
  });

  it("refuse les redirections vers un autre site", () => {
    expect(safeNextPath("/reserver?service=1")).toBe("/reserver?service=1");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath(null, "/mes-rendez-vous")).toBe("/mes-rendez-vous");
  });
});
