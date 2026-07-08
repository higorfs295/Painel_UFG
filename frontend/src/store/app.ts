// Estado de navegação de domínio: qual enrollment (curso) está selecionado.
import { create } from "zustand";

type AppState = {
  enrollmentId: string | null;
  setEnrollment: (id: string) => void;
};

export const useApp = create<AppState>((set) => ({
  enrollmentId: null,
  setEnrollment: (id) => set({ enrollmentId: id }),
}));
