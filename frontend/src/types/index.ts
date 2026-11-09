// Types issus du schéma OpenAPI du backend (npm run gen:types) : un seul contrat.
import type { components } from "./api";

type Schemas = components["schemas"];

export type User = Schemas["UserOut"];
export type UserRole = User["role"];
export type Service = Schemas["ServiceOut"];
export type ServiceCreate = Schemas["ServiceCreate"];
export type ServiceUpdate = Schemas["ServiceUpdate"];
export type Availability = Schemas["AvailabilityOut"];
export type Booking = Schemas["BookingOut"];
export type AdminBooking = Schemas["AdminBookingOut"];
export type BookingStatus = Booking["status"];
export type BusinessHour = Schemas["BusinessHourOut"];
export type BusinessHourInput = Schemas["BusinessHourIn"];
export type TimeOff = Schemas["TimeOffOut"];
export type TimeOffInput = Schemas["TimeOffIn"];
export type TimeOffCreated = Schemas["TimeOffCreatedOut"];
export type TokenResponse = Schemas["TokenOut"];
export type Paginated<T> = { items: T[]; total: number; page: number; page_size: number };
