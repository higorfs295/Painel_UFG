// Estado de autenticação (Zustand). O access token vive em api/client.ts (memória);
// aqui guardamos o usuário e o status para reatividade da UI.
import { create } from "zustand";
import type { User, Theme } from "../api/types";

type Status = "loading" | "authed" | "anon";

type AuthState = {
  user: User | null;
  status: Status;
  setSession: (user: User) => void;
  clear: () => void;
  patchUser: (p: Partial<User>) => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  setSession: (user) => set({ user, status: "authed" }),
  clear: () => set({ user: null, status: "anon" }),
  patchUser: (p) => set((s) => ({ user: s.user ? { ...s.user, ...p } : s.user })),
}));

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
