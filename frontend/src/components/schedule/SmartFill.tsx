// RF-29 — "puxar do meu semestre": lista as disciplinas já marcadas como CURSANDO ou
// SIMULADA e monta a grade a partir delas. O aluno digita só o código de horário do SIGAA:
// nome, sigla, carga horária e cor vêm da matriz do curso (calculados no servidor).
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schedules } from "../../api/endpoints";
import type { ScenarioCandidate } from "../../api/endpoints";
import { parseSIGAA } from "../../lib/sigaa";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { IconSprout } from "../ui/Icons";

type Props = { scenarioId: string; enrollmentId: string };

export default function SmartFill({ scenarioId, enrollmentId }: Props) {
  const qc = useQueryClient();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["candidates", scenarioId],
    queryFn: () => schedules.candidates(scenarioId),
  });
  const items = data?.items ?? [];
  const free = items.filter((c) => !c.alreadyInScenario);

  // por padrão, tudo que ainda não está na grade vem marcado — o caminho comum é "quero todas"
  useEffect(() => {
    setPicked(Object.fromEntries(free.map((c) => [c.subjectId, true])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const add = useMutation({
    mutationFn: () => schedules.bulkAdd(scenarioId, free
      .filter((c) => picked[c.subjectId])
      .map((c) => ({ subjectId: c.subjectId, sigaaCode: codes[c.subjectId] ?? "" }))),
    onSuccess: () => {
      setErr("");
      setCodes({});
      qc.invalidateQueries({ queryKey: ["scenarios", enrollmentId] });
      qc.invalidateQueries({ queryKey: ["candidates", scenarioId] });
    },
    onError: () => setErr("Algum código de horário é inválido. Formato: 24M12 (dias 2 e 4, matutino, aulas 1–2)."),
  });

  const chosen = free.filter((c) => picked[c.subjectId]).length;

  if (isLoading) return <Card tight><div className="skeleton skeleton-card" /></Card>;
  if (items.length === 0) {
    return (
      <Card tight>
        <div className="row" style={{ gap: 10 }}>
          <IconSprout />
          <span className="mut">
            Marque disciplinas como <b>cursando</b> ou <b>simulada</b> em Disciplinas e elas aparecem aqui
            para entrar na grade automaticamente.
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="row wrap spread">
        <h3>Puxar do meu semestre</h3>
        <span className="mut" style={{ fontSize: ".8rem" }}>
          {free.length === 0 ? "tudo já está na grade" : `${chosen} de ${free.length} selecionadas`}
        </span>
      </div>
      <p className="mut" style={{ fontSize: ".84rem", margin: "2px 0 12px" }}>
        Nome, sigla e carga horária vêm da matriz — informe apenas o código de horário.
      </p>

      <ul className="pull-list">
        {items.map((c) => (
          <PullRow key={c.subjectId} c={c}
            code={codes[c.subjectId] ?? ""}
            checked={!!picked[c.subjectId]}
            onCode={(v) => setCodes((s) => ({ ...s, [c.subjectId]: v }))}
            onToggle={() => setPicked((s) => ({ ...s, [c.subjectId]: !s[c.subjectId] }))} />
        ))}
      </ul>

      {err && <div className="err mt" role="alert">{err}</div>}
      <div className="row mt" style={{ gap: 8 }}>
        <Button variant="prim" disabled={chosen === 0 || add.isPending} onClick={() => add.mutate()}>
          {add.isPending ? "Adicionando…" : `Adicionar ${chosen} à grade`}
        </Button>
        {add.isSuccess && !add.isPending && <span className="ok">Grade atualizada.</span>}
      </div>
    </Card>
  );
}

function PullRow({ c, code, checked, onCode, onToggle }: {
  c: ScenarioCandidate; code: string; checked: boolean;
  onCode: (v: string) => void; onToggle: () => void;
}) {
  // pré-visualização imediata: quantos horários o código ocupa (o servidor revalida)
  const { slots, errs } = parseSIGAA(code);
  const bad = code.trim() !== "" && errs.length > 0;

  return (
    <li className={"pull-row" + (c.alreadyInScenario ? " is-in" : "")}>
      <input type="checkbox" checked={checked} disabled={c.alreadyInScenario} onChange={onToggle}
        aria-label={`Selecionar ${c.name}`} />
      <span className="pull-sig" style={{ background: c.color }}>{c.sigla}</span>
      <span className="pull-name">
        <strong>{c.name}</strong>
        <small>{c.code} · {c.hours}h · {c.state === "ENROLLED" ? "cursando" : "simulada"}</small>
      </span>
      {c.alreadyInScenario ? (
        <span className="chip done"><span className="swatch" />na grade</span>
      ) : (
        <span className="pull-code">
          <input value={code} onChange={(e) => onCode(e.target.value)} placeholder="24M12"
            aria-label={`Código de horário de ${c.name}`} aria-invalid={bad}
            style={bad ? { borderColor: "var(--lock)" } : undefined} />
          <small className={bad ? "err" : "dim"}>
            {bad ? "inválido" : slots.length ? `${slots.length} aula(s)` : "opcional"}
          </small>
        </span>
      )}
    </li>
  );
}
