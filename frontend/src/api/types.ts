// Tipos das respostas da API (espelham o backend).
export type Role = "ADMIN" | "USER";
export type Theme = "dark" | "light";
export type SubjectState = "APPROVED" | "SIMULATED";
export type GraphStatus = "done" | "avail" | "co" | "lock";
export type ExtraCategory = "OPT" | "NL" | "AC" | "NONE";

export type User = { id: string; name: string; email: string; role: Role; theme: Theme; createdAt?: string };

export type Enrollment = {
  id: string; userId: string; courseId: string;
  startTerm: string | null; currentTerm: string | null;
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
  hours: number; category: ExtraCategory; done: boolean; createdAt: string;
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
  active: boolean; courses: { slug: string; name: string }[];
};
