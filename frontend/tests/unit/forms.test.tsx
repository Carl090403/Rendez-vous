import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";

const replace = vi.fn();
const login = vi.fn();
let nextParam: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nextParam ? { next: nextParam } : {}),
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ login }) }));

const { LoginForm } = await import("@/app/(public)/connexion/LoginForm");

describe("LoginForm", () => {
  beforeEach(() => {
    replace.mockReset();
    login.mockReset();
    nextParam = null;
  });

  it("valide les champs côté client avec des messages en français", async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Courriel"), "pas-un-courriel");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByText("Courriel invalide.")).toBeInTheDocument();
    expect(screen.getByText("Le mot de passe est obligatoire.")).toBeInTheDocument();
    expect(screen.getByLabelText("Courriel")).toHaveAttribute("aria-invalid", "true");
    expect(login).not.toHaveBeenCalled();
  });

  it("affiche l'erreur de l'API sans préciser quel champ est faux", async () => {
    login.mockRejectedValue(
      new ApiError(401, "INVALID_CREDENTIALS", "Courriel ou mot de passe incorrect."),
    );
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Courriel"), "alex@exemple.com");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "mauvais-mdp");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Courriel ou mot de passe incorrect.",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("ramène le client à sa réservation après la connexion", async () => {
    nextParam = "/reserver?service=s1&date=2026-11-10&slot=x";
    login.mockResolvedValue({ role: "client" });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Courriel"), "alex@exemple.com");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "Sup3r-Secret!");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(nextParam));
  });

  it("ignore une redirection externe", async () => {
    nextParam = "//evil.example";
    login.mockResolvedValue({ role: "admin" });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Courriel"), "admin@exemple.com");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "Sup3r-Secret!");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
  });
});
