"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { BusinessHourInput, TimeOffInput } from "@/types";

export function useBusinessHours() {
  return useQuery({ queryKey: ["business-hours"], queryFn: api.businessHours });
}

export function useSaveBusinessHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ranges: BusinessHourInput[]) => api.replaceBusinessHours(ranges),
    onSuccess: (saved) => {
      queryClient.setQueryData(["business-hours"], saved);
      return queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useTimeOff() {
  return useQuery({ queryKey: ["time-off"], queryFn: api.timeOff });
}

export function useCreateTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TimeOffInput) => api.createTimeOff(data),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["time-off"] }),
        queryClient.invalidateQueries({ queryKey: ["availability"] }),
      ]),
  });
}

export function useDeleteTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTimeOff(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["time-off"] }),
        queryClient.invalidateQueries({ queryKey: ["availability"] }),
      ]),
  });
}
