"use client";

// Admin · uma matriz por dentro (v12): composições, marcos e a lista de disciplinas com
// requisitos, nível na cadeia de pré-requisitos e quantas disciplinas cada uma libera.
// É a mesma topologia do Mapa curricular do aluno (lib/curriculum-graph), em forma de tabela.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { RiArrowLeftLine, RiBarChartBoxLine, RiDownloadLine, RiNodeTree, RiFlagLine, RiPieChart2Line } from "@remixicon/react";
import { courses } from "@/lib/api/endpoints";
import { buildGraph } from "@/lib/curriculum-graph";
import { compositionTone, tone } from "@/lib/palette";
import { downloadJSON } from "@/lib/csv";
import { PageBanner } from "@/components/fx/page-banner";
import { Donut, DonutLegend } from "@/components/fx/donut";
import { Panel, Pill } from "@/components/admin/panel";
import { shortCourse } from "@/components/layout/course-switcher";
import { Button } from "@/components/tremor/Button";
import { Searchbar } from "@/components/tremor/Searchbar";
import { Segmented } from "@/components/ui";
import { cx, num } from "@/lib/utils";

const KINDS = [
  { v: "all", label: "Todas" }, { v: "ob", label: "Obrigatórias" }, { v: "opt", label: "Optativas" },
  { v: "NC", label: "Núcleo comum" }, { v: "NE", label: "Núcleo específico" },
] as const;

export default function AdminCursoDetalhePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: course, isLoading, isError } = useQuery({ queryKey: ["course", slug], queryFn: () => courses.detail(slug) });
  const graph = useMemo(() => (course ? buildGraph(course) : null), [course]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["v"]>("all");

  const rows = useMemo(() => {
    if (!course) return [];
    const n = q.trim().toLowerCase();
    return course.subjects.filter((s) =>
      (!n || s.name.toLowerCase().includes(n) || s.code.toLowerCase().includes(n) || String(s.seq) === n) &&
      (kind === "all" || (kind === "ob" ? s.groupOpt === 0 : kind === "opt" ? s.groupOpt > 0 : s.nucleus === kind)));
  }, [course, q, kind]);

  if (isError) return (
    <div className="max-w-xl">
      <h1>Curso não encontrado</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">O endereço pode estar errado, ou o curso foi para a lixeira.</p>
      <Button asChild variant="secondary" className="mt-4"><Link href="/admin/cursos">Voltar aos cursos</Link></Button>
    </div>
  );
  if (isLoading || !course || !graph) return <div className="flex flex-col gap-6"><div className="skeleton h-40" /><div className="skeleton h-96" /></div>;

  const slices = course.requirements.map((r, i) => ({ label: r.label, value: r.hours, tone: compositionTone(r.key, i) }));
  const ob = course.subjects.filter((s) => s.groupOpt === 0).length;

  return (
    <div className="flex flex-col gap-6">
      <PageBanner eyebrow="Matriz curricular" icon={RiNodeTree} title={shortCourse(course.name)}
        description={<>{course.name} · <code>{course.slug}</code> · {num(course.totalHours)} h no total</>}
        actions={<>
          <Button asChild variant="secondary"><Link href="/admin/cursos"><RiArrowLeftLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Cursos</Link></Button>
          <Button variant="secondary" onClick={async () => { downloadJSON(`matriz-${course.slug}.json`, await courses.exportMatrix(course.slug)); toast.success("Matriz baixada."); }}>
            <RiDownloadLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Baixar JSON
          </Button>
          <Button asChild><Link href={`/admin/relatorios?curso=${course.slug}`}><RiBarChartBoxLine className="-ml-0.5 mr-1.5 size-4" aria-hidden="true" />Relatório</Link></Button>
        </>}
        aside={
          <div className="flex gap-6 text-sm">
            {([["disciplinas", course.subjects.length], ["obrigatórias", ob], ["níveis", graph.maxDepth + 1]] as const).map(([k, v]) => (
              <div key={k}><span className="block text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{v}</span><span className="text-xs text-gray-500 dark:text-gray-400">{k}</span></div>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel icon={RiPieChart2Line} tone="cyan" id="composicao" title="Composição" description="horas mínimas por núcleo">
          <div className="flex flex-col items-center gap-5">
            <Donut data={slices} label="Composição curricular em horas" size={140}>
              <div><span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{num(course.requirements.reduce((s, r) => s + r.hours, 0))}</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">horas</p></div>
            </Donut>
            <div className="w-full"><DonutLegend data={slices} unit=" h" /></div>
          </div>
        </Panel>
        <Panel className="lg:col-span-2" icon={RiFlagLine} tone="amber" id="marcos" title="Marcos de horas" description="destravam disciplinas que exigem carga integralizada (ex.: estágio)">
          {course.milestones.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">Esta matriz não tem marcos.</p> : (
            <ol className="relative flex flex-col gap-4 border-l-2 border-dashed border-amber-300 pl-6 dark:border-amber-500/40">
              {[...course.milestones].sort((a, b) => a.hours - b.hours).map((m) => {
                const gated = [...graph.milestones.entries()].filter(([, keys]) => keys.includes(m.key)).map(([seq]) => graph.bySeq.get(seq)!);
                return (
                  <li key={m.key} className="relative">
                    <span className="absolute -left-[33px] grid size-4 place-items-center rounded-full bg-amber-500 ring-4 ring-white dark:ring-gray-950" aria-hidden="true" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{m.key} · {num(m.hours)} h</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.description}</p>
                    {gated.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">{gated.map((s) => <Pill key={s.seq} tone="amber">{s.code || `#${s.seq}`} {s.name}</Pill>)}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      <section aria-labelledby="disciplinas" className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs sm:p-5 dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 id="disciplinas" className="mr-auto text-sm font-semibold text-gray-900 dark:text-gray-50">Disciplinas <span className="font-normal text-gray-500">({rows.length})</span></h2>
          <Searchbar type="search" placeholder="Nome, código ou nº…" aria-label="Buscar disciplina" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-64" />
          <Segmented label="Tipo de disciplina" value={kind} onChange={setKind} options={[...KINDS]} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-y border-gray-200 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-2 py-2 font-medium">#</th><th className="px-2 py-2 font-medium">Código</th><th className="px-2 py-2 font-medium">Disciplina</th>
                <th className="px-2 py-2 text-right font-medium">CH</th><th className="px-2 py-2 font-medium">Núcleo</th>
                <th className="px-2 py-2 font-medium">Nível</th><th className="px-2 py-2 font-medium">Exige</th><th className="px-2 py-2 text-right font-medium">Libera</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
              {rows.map((s) => {
                const req = graph.requires.get(s.seq) ?? [];
                const ms = graph.milestones.get(s.seq) ?? [];
                const depth = graph.depth.get(s.seq) ?? 0;
                const lib = graph.unlocks.get(s.seq)?.length ?? 0;
                return (
                  <tr key={s.seq} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-2 py-2 tabular-nums text-gray-500">{s.seq}</td>
                    <td className="px-2 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{s.code || "—"}</td>
                    <td className="px-2 py-2 text-gray-900 dark:text-gray-50">{s.name}{s.groupOpt > 0 && <Pill tone="fuchsia" className="ml-2">optativa · grupo {s.groupOpt}</Pill>}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{s.hours}</td>
                    <td className="px-2 py-2"><Pill tone={s.nucleus === "NC" ? "cyan" : "indigo"}>{s.nucleus}</Pill></td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-1.5" title={`nível ${depth} na cadeia de pré-requisitos`}>
                        {Array.from({ length: Math.min(depth + 1, 8) }, (_, i) => <span key={i} className={cx("h-2.5 w-1 rounded-full", tone("brand").dot)} style={{ opacity: 0.35 + (i / 8) * 0.65 }} aria-hidden="true" />)}
                        <span className="text-xs tabular-nums text-gray-500">{depth}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {req.map((e) => { const r = graph.bySeq.get(e.from); return r ? <span key={`${e.from}-${e.type}`} title={r.name} className={cx("rounded-sm px-1.5 py-0.5 text-xs ring-1 ring-inset", e.type === "CO" ? tone("sky").soft : tone("gray").soft)}>{e.type === "CO" ? "co " : ""}{r.code || `#${r.seq}`}</span> : null; })}
                        {ms.map((k) => <span key={k} className={cx("rounded-sm px-1.5 py-0.5 text-xs ring-1 ring-inset", tone("amber").soft)}>{k}</span>)}
                        {!req.length && !ms.length && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{lib || <span className="text-gray-400">0</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
