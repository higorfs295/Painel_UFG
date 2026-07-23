"use client";

// Estado de sessão e de navegação de domínio (Zustand).
//
// `status` distingue três momentos que a UI precisa tratar de formas diferentes:
// "loading" (tentando renovar a sessão pelo cookie), "in" e "out". Sem isso, um F5
// numa rota protegida piscaria a tela de login antes de o refresh terminar.
import { create } from "zustand";
import type { User } from "./api/types";

type AuthState = {
  user: User | null;
  status: "loading" | "in" | "out";
  setUser: (u: User | null) => void;
  patchUser: (p: Partial<User>) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  setUser: (user) => set({ user, status: user ? "in" : "out" }),
  patchUser: (p) => set((s) => (s.user ? { user: { ...s.user, ...p } } : s)),
  clear: () => set({ user: null, status: "out" }),
}));

type AppState = {
  /** matrícula (curso) selecionada — o aluno pode ter mais de uma */
  enrollmentId: string | null;
  setEnrollment: (id: string) => void;
};

export const useApp = create<AppState>((set) => ({
  enrollmentId: null,
  setEnrollment: (enrollmentId) => set({ enrollmentId }),
}));
