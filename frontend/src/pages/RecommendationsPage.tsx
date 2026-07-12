// Recomendações (RF-07) — página dedicada: ranking completo das disciplinas disponíveis pelo
// quanto cada uma destrava (obrigatórias primeiro), com ação de marcar como cursando.
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { me, courses } from "../api/endpoints";
import { useApp } from "../store/app";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import { IconStar } from "../components/ui/Icons";

export default function RecommendationsPage() {
  const enrollmentId = useApp((s) => s.enrollmentId)!;
  const qc = useQueryClient();

  const { data: recs, isLoading } = useQuery({
    queryKey: ["recs-full", enrollmentId], queryFn: () => me.recommendations(enrollmentId, 100), enabled: !!enrollmentId,
  });
  const { data: enrs } = useQuery({ queryKey: ["enrollments"], queryFn: me.enrollments });
  const slug = enrs?.find((e) => e.id === enrollmentId)?.course.slug;
  const { data: course } = useQuery({
    queryKey: ["course-subjects", slug], queryFn: () => courses.detail(slug!), enabled: !!slug,
  });
  const idBySeq = useMemo(() => {
    const m = new Map<number, string>();
    course?.subjects.forEach((s) => m.set(s.seq, s.id));
    return m;
  }, [course]);

  const mark = useMutation({
    mutationFn: (v: { subjectId: string }) => me.setSubject(enrollmentId, v.subjectId, "ENROLLED"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recs-full", enrollmentId] });
      qc.invalidateQueries({ queryKey: ["progress", enrollmentId] });
      qc.invalidateQueries({ queryKey: ["recs", enrollmentId] });
    },
  });

  const top = recs?.slice(0, 3) ?? [];
  const rest = recs?.slice(3) ?? [];
  const maxTot = Math.max(1, ...(recs?.map((r) => r.tot) ?? [1]));

  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">o que priorizar</span>
        <h1>Recomen<em>dações</em></h1>
      </header>
      <p className="mut">Disciplinas disponíveis agora, ranqueadas pelo quanto cada uma <b>destrava</b> na
        matriz (as que liberam obrigatórias vêm primeiro). Marque como <b>cursando</b> direto daqui.</p>

      {isLoading ? <div className="spinner" role="status">Carregando…</div> :
        !recs || recs.length === 0 ? (
          <div className="muted-box">Nenhuma disciplina disponível no momento — conclua pré-requisitos para liberar novas.</div>
        ) : (
          <>
            <div className="bento">
              {top.map((r, i) => {
                const sid = idBySeq.get(r.seq);
                return (
                  <section className="b-cell sp4 rec-card" key={r.seq}>
                    <span className="rec-rank">#{i + 1}</span>
                    <span className="stat-ico" style={{ color: "var(--sun)", background: "color-mix(in srgb, var(--sun) 15%, transparent)", borderColor: "color-mix(in srgb, var(--sun) 30%, transparent)" }}><IconStar /></span>
                    <h3 style={{ marginBottom: 6 }}>{r.code}</h3>
                    <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.12rem", display: "block", lineHeight: 1.2 }}>{r.name}</strong>
                    <p className="mut" style={{ margin: "8px 0 12px", fontSize: ".84rem" }}>
                      {r.hours}h · destrava <b>{r.tot}</b> disciplina(s){r.ob > 0 && <> ({r.ob} obrigatória{r.ob > 1 ? "s" : ""})</>}
                    </p>
                    <Button size="sm" variant="prim" disabled={!sid || mark.isPending}
                      onClick={() => sid && mark.mutate({ subjectId: sid })}>Marcar como cursando</Button>
                  </section>
                );
              })}
            </div>

            {rest.length > 0 && (
              <Reveal>
                <Card tight>
                  <h3 style={{ padding: "6px 8px 0" }}>Também disponíveis</h3>
                  <div className="tablewrap">
                    <table>
                      <thead><tr><th>Código</th><th>Disciplina</th><th>CH</th><th>Destrava</th><th style={{ textAlign: "right" }}>Ação</th></tr></thead>
                      <tbody>
                        {rest.map((r) => {
                          const sid = idBySeq.get(r.seq);
                          return (
                            <tr key={r.seq}>
                              <td className="mut">{r.code}</td>
                              <td>{r.name}</td>
                              <td>{r.hours}h</td>
                              <td style={{ minWidth: 160 }}>
                                <div className="meta"><span className="badge">{r.tot} ({r.ob} obr.)</span></div>
                                <div className="bar" style={{ height: 7 }}><span style={{ width: `${(r.tot / maxTot) * 100}%` }} /></div>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <Button size="sm" disabled={!sid || mark.isPending}
                                  onClick={() => sid && mark.mutate({ subjectId: sid })}>Cursar</Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </Reveal>
            )}
          </>
        )}
    </div>
  );
}
