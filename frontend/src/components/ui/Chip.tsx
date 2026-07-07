// Chip de status/categoria. `tone` mapeia para as cores dos tokens (done/avail/co/lock/sim).
import type { ReactNode } from "react";
import type { GraphStatus } from "../../api/types";

const LABEL: Record<GraphStatus, string> = { done: "Concluída", avail: "Disponível", co: "Co-requisito", lock: "Bloqueada" };

export function StatusChip({ status, sim }: { status: GraphStatus; sim?: boolean }) {
  if (sim) return <span className="chip sim"><span className="swatch" />Simulada</span>;
  return <span className={`chip ${status}`}><span className="swatch" />{LABEL[status]}</span>;
}

export default function Chip({ tone = "", children }: { tone?: string; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}
