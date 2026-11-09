"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { api, isApiError } from "@/lib/api";
import type { User } from "@/types";

export const ME_QUERY_KEY = ["me"] as const;

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<User | null> {
  try {
    return await api.me();
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null; // visiteur non connecté
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const setUser = useCallback(
    (user: User | null) => queryClient.setQueryData(ME_QUERY_KEY, user),
    [queryClient],
  );

  /** Change d'utilisateur : aucune donnée de la session précédente ne doit survivre. */
  const startSession = useCallback(
    (user: User | null) => {
      // On ne vide pas tout le cache (clear) : la requête « me » doit rester observée.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0] });
      setUser(user);
    },
    [queryClient, setUser],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { user } = await api.login({ email, password });
      startSession(user);
      return user;
    },
    [startSession],
  );

  const register = useCallback<AuthContextValue["register"]>(
    async (payload) => {
      const user = await api.register(payload);
      startSession(user);
      return user;
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      startSession(null);
    }
  }, [startSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
      isLoading: isPending,
      isAdmin: data?.role === "admin",
      login,
      register,
      logout,
      setUser,
    }),
    [data, isPending, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans <AuthProvider>.");
  return context;
}
