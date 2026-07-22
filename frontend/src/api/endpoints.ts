// Funções de acesso à API, agrupadas por domínio. Usam o cliente com refresh automático.
import { api, setAccessToken } from "./client";
import type {
  User, Enrollment, Progress, Recommendation, Extra, CourseSummary, Scenario, AdminUser,
  AdminStats, SubjectState, ExtraCategory, Theme, AcademicPeriodEntry, PeriodInfo, Shift, AdminConfig,
  History, Achievements, StudyTask, TaskKind, SubjectNote, Announcement, Audience,
  Metrics, AuditEntry, SessionInfo,
} from "./types";

// ---- auth ----
export const auth = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; user: User }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    api<{ accessToken: string; user: User }>("/auth/register", {
      method: "POST", body: JSON.stringify({ name, email, password }),
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
  updateSettings: (patch: { theme?: Theme; name?: string; matricula?: string | null; shift?: Shift | null }) =>
    api<User>("/me/settings", { method: "PATCH", body: JSON.stringify(patch) }),
  changePassword: (current: string, next: string) =>
    api<void>("/me/password", { method: "POST", body: JSON.stringify({ current, next }) }),
  enrollments: () => api<Enrollment[]>("/me/enrollments"),
  selfEnroll: (courseSlug: string) =>
    api<Enrollment>("/me/enrollments", { method: "POST", body: JSON.stringify({ courseSlug }) }),
  updateEnrollment: (enrollmentId: string, patch: { startTerm?: string | null }) =>
    api<Enrollment>(`/me/enrollments/${enrollmentId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  progress: (enrollmentId: string) => api<Progress>(`/me/enrollments/${enrollmentId}/progress`),
  recommendations: (enrollmentId: string, limit = 12) =>
    api<Recommendation[]>(`/me/enrollments/${enrollmentId}/recommendations?limit=${limit}`),
  // RF-06/22: estado + (opcional) nota, faltas e período em que cursou
  setSubject: (
    enrollmentId: string, subjectId: string, state: SubjectState | null,
    detail?: { grade?: number | null; absences?: number | null; term?: string | null },
  ) =>
    api<unknown>(`/me/enrollments/${enrollmentId}/subjects/${subjectId}`, {
      method: "PUT", body: JSON.stringify({ state, ...detail }),
    }),
  history: (enrollmentId: string) => api<History>(`/me/enrollments/${enrollmentId}/history`),
  achievements: (enrollmentId: string) => api<Achievements>(`/me/enrollments/${enrollmentId}/achievements`),
  sessions: () => api<{ sessions: SessionInfo[]; count: number }>("/me/sessions"),
  revokeOtherSessions: () => api<{ revoked: number }>("/me/sessions/revoke-others", { method: "POST" }),
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

// ---- agenda e anotações (RF-25/26) ----
export const planner = {
  tasks: (enrollmentId: string) => api<StudyTask[]>(`/me/enrollments/${enrollmentId}/tasks`),
  addTask: (enrollmentId: string, data: { title: string; kind?: TaskKind; dueAt?: string | null; subjectCode?: string | null; notes?: string | null }) =>
    api<StudyTask>(`/me/enrollments/${enrollmentId}/tasks`, { method: "POST", body: JSON.stringify(data) }),
  patchTask: (taskId: string, patch: Partial<Pick<StudyTask, "title" | "kind" | "dueAt" | "done" | "notes" | "subjectCode">>) =>
    api<StudyTask>(`/me/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  removeTask: (taskId: string) => api<void>(`/me/tasks/${taskId}`, { method: "DELETE" }),
  notes: (enrollmentId: string) => api<SubjectNote[]>(`/me/enrollments/${enrollmentId}/notes`),
  saveNote: (enrollmentId: string, subjectId: string, text: string) =>
    api<unknown>(`/me/enrollments/${enrollmentId}/subjects/${subjectId}/note`, {
      method: "PUT", body: JSON.stringify({ text }),
    }),
};

// ---- avisos (RF-24) ----
export const announcements = {
  feed: () => api<Announcement[]>("/announcements"),
  listAll: () => api<Announcement[]>("/admin/announcements"),
  create: (data: { title: string; body: string; audience?: Audience; pinned?: boolean }) =>
    api<Announcement>("/admin/announcements", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, patch: { title?: string; body?: string; audience?: Audience; pinned?: boolean }) =>
    api<Announcement>(`/admin/announcements/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: string) => api<void>(`/admin/announcements/${id}`, { method: "DELETE" }),
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

// ---- admin (RF-01/21) ----
export const admin = {
  listUsers: () => api<AdminUser[]>("/users"),
  createUser: (data: { name: string; email: string; role?: "ADMIN" | "USER"; courseSlug?: string }) =>
    api<{ user: User; invite: { link: string; expiresAt: string; emailed: boolean } }>("/users", { method: "POST", body: JSON.stringify(data) }),
  reinvite: (id: string) =>
    api<{ invite: { link: string; expiresAt: string; purpose: string; emailed: boolean } }>(`/users/${id}/invite`, { method: "POST" }),
  patchUser: (id: string, patch: { role?: "ADMIN" | "USER"; name?: string }) =>
    api<{ id: string; role: "ADMIN" | "USER" }>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  enrollUser: (id: string, courseSlug: string) =>
    api<{ enrollmentId: string }>(`/users/${id}/enrollments`, { method: "POST", body: JSON.stringify({ courseSlug }) }),
  unenrollUser: (id: string, enrollmentId: string) =>
    api<void>(`/users/${id}/enrollments/${enrollmentId}`, { method: "DELETE" }),
  removeUser: (id: string) => api<void>(`/users/${id}`, { method: "DELETE" }),
  stats: () => api<AdminStats>("/admin/stats"),
  config: () => api<AdminConfig>("/admin/config"),
  testMail: () => api<{ sent: boolean; to?: string; error?: string }>("/admin/mail/test", { method: "POST" }),
  // observabilidade (RF-27)
  metrics: () => api<Metrics>("/admin/metrics"),
  audit: (q: { limit?: number; action?: string } = {}) => {
    const p = new URLSearchParams();
    if (q.limit) p.set("limit", String(q.limit));
    if (q.action) p.set("action", q.action);
    return api<{ entries: AuditEntry[] }>(`/admin/audit${p.toString() ? `?${p}` : ""}`);
  },
  // ferramentas de desenvolvimento (só com DEV_TOOLS=true)
  seedStudents: (data: { count: number; courseSlug: string; progress?: number }) =>
    api<{ created: number; emails: string[]; password: string }>("/admin/dev/students", {
      method: "POST", body: JSON.stringify(data),
    }),
  purgeDevStudents: () => api<{ removed: number }>("/admin/dev/students", { method: "DELETE" }),
  seedAnnouncements: () => api<{ created: number }>("/admin/dev/announcements", { method: "POST" }),
  // calendário acadêmico global (RF-20 v2)
  periods: () => api<{ entries: AcademicPeriodEntry[]; current: PeriodInfo }>("/admin/periods"),
  addPeriod: (data: { type: "TERM" | "BREAK"; term?: string | null; startsAt: string }) =>
    api<AcademicPeriodEntry>("/admin/periods", { method: "POST", body: JSON.stringify(data) }),
  removePeriod: (id: string) => api<void>(`/admin/periods/${id}`, { method: "DELETE" }),
};
