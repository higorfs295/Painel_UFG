"use client";

// Hooks de dados do aluno. Concentrar as `queryKey` aqui evita o problema clássico de
// invalidar com uma chave escrita de um jeito na mutação e de outro na consulta.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { courses, extras, me, planner, schedules } from "@/lib/api/endpoints";
import { useApp } from "@/lib/auth-store";
import type { SubjectState } from "@/lib/api/types";

export const keys = {
  enrollments: ["enrollments"] as const,
  progress: (id: string) => ["progress", id] as const,
  recs: (id: string) => ["recs", id] as const,
  history: (id: string) => ["history", id] as const,
  achievements: (id: string) => ["achievements", id] as const,
  extras: (id: string) => ["extras", id] as const,
  tasks: (id: string) => ["tasks", id] as const,
  scenarios: (id: string) => ["scenarios", id] as const,
  candidates: (sid: string) => ["candidates", sid] as const,
  courseDetail: (slug: string) => ["course", slug] as const,
};

/** A matrícula selecionada; as páginas do painel só renderizam quando ela existe. */
export function useEnrollmentId() {
  return useApp((s) => s.enrollmentId);
}

export function useProgress() {
  const id = useEnrollmentId();
  return useQuery({
    queryKey: keys.progress(id ?? ""),
    queryFn: () => me.progress(id!),
    enabled: !!id,
  });
}

export function useHistory() {
  const id = useEnrollmentId();
  return useQuery({ queryKey: keys.history(id ?? ""), queryFn: () => me.history(id!), enabled: !!id });
}

export function useAchievements() {
  const id = useEnrollmentId();
  return useQuery({ queryKey: keys.achievements(id ?? ""), queryFn: () => me.achievements(id!), enabled: !!id });
}

export function useRecommendations(limit = 12) {
  const id = useEnrollmentId();
  return useQuery({ queryKey: [...keys.recs(id ?? ""), limit], queryFn: () => me.recommendations(id!, limit), enabled: !!id });
}

export function useExtras() {
  const id = useEnrollmentId();
  return useQuery({ queryKey: keys.extras(id ?? ""), queryFn: () => extras.list(id!), enabled: !!id });
}

export function useTasks() {
  const id = useEnrollmentId();
  return useQuery({ queryKey: keys.tasks(id ?? ""), queryFn: () => planner.tasks(id!), enabled: !!id });
}

export function useScenarios() {
  const id = useEnrollmentId();
  return useQuery({ queryKey: keys.scenarios(id ?? ""), queryFn: () => schedules.list(id!), enabled: !!id });
}

/** Detalhe do curso da matrícula — precisamos dele para mapear seq → subjectId. */
export function useCourseDetail() {
  const id = useEnrollmentId();
  return useQuery({
    queryKey: ["course-of", id ?? ""],
    queryFn: async () => {
      const enr = (await me.enrollments()).find((e) => e.id === id);
      return enr ? courses.detail(enr.course.slug) : null;
    },
    enabled: !!id,
  });
}

/**
 * Marcar/limpar o estado de uma disciplina. Toda tela que depende do progresso é
 * invalidada de uma vez — histórico e conquistas derivam dos mesmos status.
 */
export function useSetSubject() {
  const id = useEnrollmentId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      subjectId: string; state: SubjectState | null;
      detail?: { grade?: number | null; absences?: number | null; term?: string | null };
    }) => me.setSubject(id!, v.subjectId, v.state, v.detail),
    onSuccess: () => {
      for (const k of [keys.progress(id!), keys.recs(id!), keys.history(id!), keys.achievements(id!)]) {
        qc.invalidateQueries({ queryKey: k });
      }
      qc.invalidateQueries({ queryKey: ["candidates"] }); // a grade puxa de cursando/simuladas
    },
  });
}
