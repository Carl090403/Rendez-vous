import { z } from "zod";

// Mêmes règles que le backend (section 10) : courriel valide, 8 caractères minimum.
const email = z.string().trim().min(1, "Le courriel est obligatoire.").email("Courriel invalide.");
const password = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(128, "Le mot de passe est trop long.");
const name = (label: string) =>
  z.string().trim().min(1, `${label} est obligatoire.`).max(100, `${label} est trop long.`);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Le mot de passe est obligatoire."),
});

export const registerSchema = z
  .object({
    first_name: name("Le prénom"),
    last_name: name("Le nom"),
    email,
    password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Les mots de passe ne correspondent pas.",
  });

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Les mots de passe ne correspondent pas.",
  });

export const profileSchema = z.object({
  first_name: name("Le prénom"),
  last_name: name("Le nom"),
});

export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Le mot de passe actuel est obligatoire."),
    new_password: password,
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, {
    path: ["confirm"],
    message: "Les mots de passe ne correspondent pas.",
  });

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(120, "Le nom est trop long."),
  description: z.string().trim().max(2000, "La description est trop longue."),
  duration_min: z
    .string()
    .trim()
    .regex(/^\d+$/, "La durée doit être un nombre entier de minutes.")
    .refine(
      (v) => Number(v) >= 5 && Number(v) <= 480,
      "La durée doit être entre 5 et 480 minutes.",
    ),
  price: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, "Prix invalide (ex. 45 ou 45,50)."),
  is_active: z.boolean(),
});

export const timeOffSchema = z
  .object({
    start_date: z.string().min(1, "La date de début est obligatoire."),
    start_time: z.string().min(1, "L'heure de début est obligatoire."),
    end_date: z.string().min(1, "La date de fin est obligatoire."),
    end_time: z.string().min(1, "L'heure de fin est obligatoire."),
    reason: z.string().trim().max(500, "Le motif est trop long."),
  })
  .refine((v) => `${v.end_date}T${v.end_time}` > `${v.start_date}T${v.start_time}`, {
    path: ["end_time"],
    message: "La fin doit être après le début.",
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotValues = z.infer<typeof forgotSchema>;
export type ResetValues = z.infer<typeof resetSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;
export type ServiceFormValues = z.infer<typeof serviceSchema>;
export type TimeOffValues = z.infer<typeof timeOffSchema>;
