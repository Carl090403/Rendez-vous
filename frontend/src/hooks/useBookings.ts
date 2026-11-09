"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { BookingStatus } from "@/types";

export function useMyBookings(when: "upcoming" | "past") {
  return useQuery({ queryKey: ["bookings", "me", when], queryFn: () => api.myBookings(when) });
}

/** Après une réservation ou une annulation, les créneaux et les listes sont rafraîchis. */
function useInvalidateBookings() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["availability"] }),
    ]);
}

export function useCreateBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: ({ serviceId, startAt }: { serviceId: string; startAt: string }) =>
      api.createBooking(serviceId, startAt),
    onSettled: invalidate,
  });
}

export function useCancelBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({ mutationFn: (id: string) => api.cancelBooking(id), onSettled: invalidate });
}

export type AdminBookingFilters = {
  page?: number;
  page_size?: number;
  status?: BookingStatus;
  service_id?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
};

export function useAdminBookings(filters: AdminBookingFilters) {
  return useQuery({
    queryKey: ["bookings", "admin", filters],
    queryFn: () => api.adminBookings(filters),
    placeholderData: keepPreviousData,
  });
}

export function useAdminCancelBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.adminCancelBooking(id, reason),
    onSettled: invalidate,
  });
}
