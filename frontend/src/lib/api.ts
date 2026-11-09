import type {
  AdminBooking,
  Availability,
  Booking,
  BookingStatus,
  BusinessHour,
  BusinessHourInput,
  Paginated,
  Service,
  ServiceCreate,
  ServiceUpdate,
  TimeOff,
  TimeOffCreated,
  TimeOffInput,
  TokenResponse,
  User,
} from "@/types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(
  /\/$/,
  "",
);

export type FieldError = { field: string; message: string };

/** Erreur de l'API au format {"error": {"code", "message"}} (section 8 du cahier). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.";
}

type Query = Record<string, string | number | undefined | null>;

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query } = {},
): Promise<T> {
  const url = new URL(
    API_URL + path,
    typeof window === "undefined" ? undefined : window.location.href,
  );
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      credentials: "include", // le cookie HttpOnly de session accompagne chaque appel
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", errorMessage(null));
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: FieldError[] } })
      ?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "UNKNOWN_ERROR",
      error?.message ?? "Une erreur inattendue est survenue.",
      error?.details ?? [],
    );
  }
  return data as T;
}

export const api = {
  // Authentification et profil
  register: (body: { email: string; password: string; first_name: string; last_name: string }) =>
    request<User>("/auth/register", { method: "POST", body }),
  login: (body: { email: string; password: string }) =>
    request<TokenResponse>("/auth/login", { method: "POST", body }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token: string, new_password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: { token, new_password },
    }),
  me: () => request<User>("/users/me"),
  updateMe: (body: {
    first_name?: string;
    last_name?: string;
    current_password?: string;
    new_password?: string;
  }) => request<User>("/users/me", { method: "PATCH", body }),
  deleteMe: () => request<void>("/users/me", { method: "DELETE" }),

  // Services et créneaux
  services: (includeInactive = false) =>
    request<Service[]>("/services", { query: { all: includeInactive ? "true" : undefined } }),
  createService: (body: ServiceCreate) => request<Service>("/services", { method: "POST", body }),
  updateService: (id: string, body: ServiceUpdate) =>
    request<Service>(`/services/${id}`, { method: "PATCH", body }),
  availability: (serviceId: string, date: string) =>
    request<Availability>("/availability", { query: { service_id: serviceId, date } }),

  // Réservations du client
  createBooking: (serviceId: string, startAt: string) =>
    request<Booking>("/bookings", {
      method: "POST",
      body: { service_id: serviceId, start_at: startAt },
    }),
  myBookings: (when: "upcoming" | "past") =>
    request<Booking[]>("/bookings/me", { query: { when } }),
  cancelBooking: (id: string) => request<Booking>(`/bookings/${id}/cancel`, { method: "POST" }),

  // Administration
  adminBookings: (filters: {
    page?: number;
    page_size?: number;
    status?: BookingStatus;
    service_id?: string;
    date?: string;
    date_from?: string;
    date_to?: string;
  }) => request<Paginated<AdminBooking>>("/admin/bookings", { query: filters }),
  adminCancelBooking: (id: string, reason?: string) =>
    request<AdminBooking>(`/admin/bookings/${id}/cancel`, {
      method: "POST",
      body: { reason: reason || null },
    }),
  businessHours: () => request<BusinessHour[]>("/admin/business-hours"),
  replaceBusinessHours: (body: BusinessHourInput[]) =>
    request<BusinessHour[]>("/admin/business-hours", { method: "PUT", body }),
  timeOff: () => request<TimeOff[]>("/admin/time-off"),
  createTimeOff: (body: TimeOffInput) =>
    request<TimeOffCreated>("/admin/time-off", { method: "POST", body }),
  deleteTimeOff: (id: string) => request<void>(`/admin/time-off/${id}`, { method: "DELETE" }),
};
