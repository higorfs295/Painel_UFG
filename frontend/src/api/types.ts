// Tipos das respostas da API (espelham o backend).
export type Role = "ADMIN" | "USER";
export type Theme = "dark" | "light";
export type SubjectState = "APPROVED" | "SIMULATED" | "ENROLLED";
export type GraphStatus = "done" | "avail" | "co" | "lock";
export type ExtraCategory = "NC" | "NE" | "OPT" | "NL" | "AC" | "NONE";
export type ExtraStatus = "PLANNED" | "IN_PROGRESS" | "DONE";

// RF-20 v2 — período letivo GLOBAL resolvido pelo servidor a partir do calendário
// acadêmico agendado pelos admins (fallback: heurística de meses).
export type PeriodInfo = {
  term: string | null; onBreak: boolean; label: string; nextTerm: string;
  source: "calendar" | "heuristic"; nextStartsAt?: string;
};

// Entrada agendada do calendário acadêmico (admin).
export type AcademicPeriodEntry = {
  id: string; type: "TERM" | "BREAK"; term: string | null; startsAt: string; createdAt: string;
};

export type Shift = "matutino" | "vespertino" | "noturno" | "integral";

export type User = {
  id: string; name: string; email: string; role: Role; theme: Theme;
  matricula?: string | null; shift?: Shift | null;
  createdAt?: string; period?: PeriodInfo;
};

export type Enrollment = {
  id: string; userId: string; courseId: string;
  startTerm: string | null;
  course: { slug: string; name: string; totalHours: number };
};

export type SubjectProgress = {
  seq: number; code: string; name: string; hours: number;
  nucleus: "NC" | "NE"; groupOpt: number;
  state: SubjectState | null; status: GraphStatus;
};
export type Composition = { key: string; label: string; required: number; hours: number; pct: number; over: number };
export type MilestoneProgress = { key: string; hours: number; description: string; reached: boolean };

export type Progress = {
  enrollment: { id: string; courseId: string };
  subjects: SubjectProgress[];
  compositions: Composition[];
  totals: { hours: number; required: number; pct: number };
  milestones: MilestoneProgress[];
  projected: {
    compositions: Composition[];
    totals: { hours: number; required: number };
    milestones: Record<string, boolean>;
  };
};

export type Recommendation = { seq: number; code: string; name: string; hours: number; ob: number; tot: number };

export type Extra = {
  id: string; enrollmentId: string; name: string; code: string | null;
  hours: number; category: ExtraCategory; status: ExtraStatus; createdAt: string;
};

export type CourseSummary = { id: string; slug: string; name: string; totalHours: number };

export type ScenarioDiscipline = {
  id: string; scenarioId: string; name: string; sigla: string;
  hours: number; docente: string | null; sigaaCode: string; color: string;
};
export type ScenarioPaint = { id: string; scenarioId: string; cellKey: string; category: string };
export type Scenario = { id: string; enrollmentId: string; name: string; disciplines: ScenarioDiscipline[]; paints: ScenarioPaint[] };

export type AdminUser = {
  id: string; name: string; email: string; role: Role; createdAt: string;
  matricula: string | null; shift: Shift | null;
  active: boolean; courses: { enrollmentId: string; slug: string; name: string }[];
};

export type AdminStats = {
  users: { total: number; admins: number; pendingInvites: number; newUsers30d: number };
  courses: number;
  enrollments: number;
  byCourse: { slug: string; name: string; count: number }[];
  activity: { subjectStatuses: number; extras: number; scenarios: number };
};
