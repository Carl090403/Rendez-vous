"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ServiceCreate, ServiceUpdate } from "@/types";

export const servicesKey = (includeInactive: boolean) => ["services", { includeInactive }] as const;

export function useServices(includeInactive = false) {
  return useQuery({
    queryKey: servicesKey(includeInactive),
    queryFn: () => api.services(includeInactive),
  });
}

export function useSaveService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: ServiceCreate | ServiceUpdate }) =>
      id ? api.updateService(id, data) : api.createService(data as ServiceCreate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });
}
