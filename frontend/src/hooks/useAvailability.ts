"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const availabilityKey = (serviceId: string, date: string) =>
  ["availability", serviceId, date] as const;

export function useAvailability(serviceId: string | null, date: string | null) {
  return useQuery({
    queryKey: availabilityKey(serviceId ?? "", date ?? ""),
    queryFn: () => api.availability(serviceId!, date!),
    enabled: Boolean(serviceId && date),
    staleTime: 30_000,
  });
}

/** Disponibilités de plusieurs jours (calendrier) : partage le cache de useAvailability. */
export function useAvailabilityForDays(serviceId: string | null, dates: string[]) {
  const results = useQueries({
    queries: dates.map((date) => ({
      queryKey: availabilityKey(serviceId ?? "", date),
      queryFn: () => api.availability(serviceId!, date),
      enabled: Boolean(serviceId),
      staleTime: 30_000,
    })),
  });
  const slotsByDate = new Map<string, number>();
  results.forEach((result, index) => {
    if (result.data) slotsByDate.set(dates[index], result.data.slots.length);
  });
  return {
    slotsByDate,
    isLoading: results.some((r) => r.isPending && r.fetchStatus !== "idle"),
    isError: results.some((r) => r.isError),
  };
}
