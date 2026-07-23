"use client";

// RF-29 — "puxar do meu semestre": lista as disciplinas já marcadas como CURSANDO ou
// SIMULADA e monta a grade a partir delas. O aluno digita só o código de horário do
// SIGAA; nome, sigla, carga horária e cor vêm da matriz (calculados no servidor).
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { schedules } from "@/lib/api/endpoints";
import type { ScenarioCandidate } from "@/lib/api/endpoints";
import { keys } from "@/hooks/use-progress";
import { parseSIGAA } from "@/lib/sigaa";
import { Card, Chip, inputCls } from "@/components/ui";
import Button from "@/components/ui/button";
import { IconSprout } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function SmartFill({ scenarioId, enrollmentId }: { scenarioId: string; enrollmentId: string }) {
  const qc = useQueryClient();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: keys.candidates(scenarioId),
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
    onSuccess: (res) => {
      setCodes({});
      qc.invalidateQueries({ queryKey: keys.scenarios(enrollmentId) });
      qc.invalidateQueries({ queryKey: keys.candidates(scenarioId) });
      toast.success(res.added > 0 ? `${res.added} disciplina(s) na grade.` : "Nada novo para adicionar.");
    },
    onError: () => toast.error("Algum código de horário é inválido. Formato: 24M12."),
  });

  const chosen = free.filter((c) => picked[c.subjectId]).length;

  if (isLoading) return <Card><div className="skeleton h-24" /></Card>;

  if (items.length === 0) {
    return (
      <Card>
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <IconSprout className="text-primary shrink-0" />
          <span>
            Marque disciplinas como <b className="text-foreground">cursando</b> ou{" "}
            <b className="text-foreground">simulada</b> em Disciplinas e elas aparecem aqui para entrar na grade
            automaticamente.
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="section-label !mb-0">Puxar do meu semestre</h3>
        <span className="text-subtle-foreground text-xs">
          {free.length === 0 ? "tudo já está na grade" : `${chosen} de ${free.length} selecionadas`}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">
        Nome, sigla e carga horária vêm da matriz — informe apenas o código de horário.
      </p>

      <ul className="divide-y">
        {items.map((c) => (
          <PullRow key={c.subjectId} c={c}
            code={codes[c.subjectId] ?? ""}
            checked={!!picked[c.subjectId]}
            onCode={(v) => setCodes((s) => ({ ...s, [c.subjectId]: v }))}
            onToggle={() => setPicked((s) => ({ ...s, [c.subjectId]: !s[c.subjectId] }))} />
        ))}
      </ul>

      <div className="mt-4">
        <Button variant="primary" disabled={chosen === 0 || add.isPending} onClick={() => add.mutate()}>
          {add.isPending ? "Adicionando…" : `Adicionar ${chosen} à grade`}
        </Button>
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
    <li className={cn("flex flex-wrap items-center gap-3 py-2.5", c.alreadyInScenario && "opacity-55")}>
      <input type="checkbox" checked={checked} disabled={c.alreadyInScenario} onChange={onToggle}
        aria-label={`Selecionar ${c.name}`} className="accent-primary size-4" />
      <span className="min-w-[58px] shrink-0 rounded-md px-2 py-1 text-center text-[0.7rem] font-bold text-[#1b1109]"
        style={{ background: c.color }}>
        {c.sigla}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <strong className="truncate text-sm font-medium">{c.name}</strong>
        <small className="text-subtle-foreground text-xs">
          {c.code} · {c.hours}h · {c.state === "ENROLLED" ? "cursando" : "simulada"}
        </small>
      </span>
      {c.alreadyInScenario ? (
        <Chip tone="done">na grade</Chip>
      ) : (
        <span className="flex w-[108px] shrink-0 flex-col gap-0.5">
          <input value={code} onChange={(e) => onCode(e.target.value)} placeholder="24M12"
            aria-label={`Código de horário de ${c.name}`} aria-invalid={bad}
            className={cn(inputCls, "px-2 py-1.5 font-mono text-sm", bad && "border-lock")} />
          <small className={cn("text-[0.65rem]", bad ? "text-lock" : "text-subtle-foreground")}>
            {bad ? "inválido" : slots.length ? `${slots.length} aula(s)` : "opcional"}
          </small>
        </span>
      )}
    </li>
  );
}
