// Funções de acesso à API, agrupadas por domínio. Usam o cliente com refresh automático.
import { api, setAccessToken } from "./client";
import type {
  User, Enrollment, Progress, Recommendation, Extra, CourseSummary, Scenario, AdminUser,
  SubjectState, ExtraCategory, Theme,
} from "./types";

// ---- auth ----
export const auth = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; user: User }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  logout: () => api<void>("/auth/logout", { method: "POST" }),
  acceptInvite: (token: string, password: string) =>
    api<void>("/auth/invite/accept", { method: "POST", body: JSON.stringify({ token, password }) }),
  forgot: (email: string) =>
    api<{ ok: boolean }>("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) }),
  // tenta renovar a sessão pelo cookie httpOnly; usado no boot do app
  bootstrap: async (): Promise<User | null> => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3333"}/auth/refresh`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) return null;
      const { accessToken } = await res.json();
      setAccessToken(accessToken);
      return await api<User>("/me");
    } catch { return null; }
  },
};

// ---- conta ----
export const me = {
  profile: () => api<User>("/me"),
  updateSettings: (patch: { theme?: Theme; name?: string }) =>
    api<User>("/me/settings", { method: "PATCH", body: JSON.stringify(patch) }),
  enrollments: () => api<Enrollment[]>("/me/enrollments"),
  progress: (enrollmentId: string) => api<Progress>(`/me/enrollments/${enrollmentId}/progress`),
  recommendations: (enrollmentId: string, limit = 12) =>
    api<Recommendation[]>(`/me/enrollments/${enrollmentId}/recommendations?limit=${limit}`),
  setSubject: (enrollmentId: string, subjectId: string, state: SubjectState | null) =>
    api<unknown>(`/me/enrollments/${enrollmentId}/subjects/${subjectId}`, {
      method: "PUT", body: JSON.stringify({ state }),
    }),
  exportBackup: () => api<unknown>("/me/export"),
  importBackup: (data: unknown) => api<{ restored: number; skippedCourses: string[] }>("/me/import", {
    method: "POST", body: JSON.stringify(data),
  }),
};

// ---- extras ----
export const extras = {
  list: (enrollmentId: string) => api<Extra[]>(`/me/enrollments/${enrollmentId}/extras`),
  create: (enrollmentId: string, data: Partial<Extra> & { name: string; hours: number; category: ExtraCategory }) =>
    api<Extra>(`/me/enrollments/${enrollmentId}/extras`, { method: "POST", body: JSON.stringify(data) }),
  update: (extraId: string, patch: Partial<Extra>) =>
    api<Extra>(`/me/extras/${extraId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (extraId: string) => api<void>(`/me/extras/${extraId}`, { method: "DELETE" }),
};

// ---- cursos ----
export type CourseSubject = {
  id: string; seq: number; code: string; name: string; hours: number; nucleus: "NC" | "NE"; groupOpt: number;
};
export type CourseDetail = {
  id: string; slug: string; name: string; totalHours: number;
  subjects: CourseSubject[];
  requirements: { key: string; label: string; hours: number }[];
  milestones: { key: string; hours: number; description: string }[];
};
export const courses = {
  list: () => api<CourseSummary[]>("/courses"),
  detail: (slug: string) => api<CourseDetail>(`/courses/${slug}`),
  import: (matriz: unknown) => api<{ slug: string; subjects: number }>("/courses/import", {
    method: "POST", body: JSON.stringify(matriz),
  }),
};

// ---- cronograma ----
export const schedules = {
  list: (enrollmentId: string) => api<Scenario[]>(`/me/enrollments/${enrollmentId}/scenarios`),
  create: (enrollmentId: string, name: string, copyFrom?: string) =>
    api<Scenario>(`/me/enrollments/${enrollmentId}/scenarios`, { method: "POST", body: JSON.stringify({ name, copyFrom }) }),
  rename: (sid: string, name: string) => api<Scenario>(`/me/scenarios/${sid}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  remove: (sid: string) => api<void>(`/me/scenarios/${sid}`, { method: "DELETE" }),
  addDiscipline: (sid: string, d: Record<string, unknown>) =>
    api<unknown>(`/me/scenarios/${sid}/disciplines`, { method: "POST", body: JSON.stringify(d) }),
  removeDiscipline: (sid: string, did: string) =>
    api<void>(`/me/scenarios/${sid}/disciplines/${did}`, { method: "DELETE" }),
  paint: (sid: string, cellKey: string, category: string) =>
    api<unknown>(`/me/scenarios/${sid}/paint`, { method: "PUT", body: JSON.stringify({ cellKey, category }) }),
};

// ---- admin (RF-01) ----
export const admin = {
  listUsers: () => api<AdminUser[]>("/users"),
  createUser: (data: { name: string; email: string; role?: "ADMIN" | "USER"; courseSlug?: string }) =>
    api<{ user: User; invite: { link: string; expiresAt: string } }>("/users", { method: "POST", body: JSON.stringify(data) }),
  reinvite: (id: string) =>
    api<{ invite: { link: string; expiresAt: string; purpose: string } }>(`/users/${id}/invite`, { method: "POST" }),
  removeUser: (id: string) => api<void>(`/users/${id}`, { method: "DELETE" }),
};
