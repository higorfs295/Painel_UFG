// "Solar Analytics" do tremorlabs/template-solar (MIT): título, um painel inclinado em
// perspectiva (rotações 3D + máscara radial) com número grande, gráfico e tabela, e uma
// fileira de StickerCards. O painel mostra um HISTÓRICO DE EXEMPLO (identificado como tal);
// a ilustração de gráfico do template (um SVG de 169 KB com rótulos em inglês) foi
// trocada por uma linha desenhada aqui.
import {
  RiCalendarScheduleLine, RiDownload2Line, RiStackLine, RiTimerFlashLine,
} from "@remixicon/react";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from "@/components/tremor/Table";
import { FeatureDivider } from "./feature-divider";
import { StickerCard } from "./sticker-card";

const TERMS = [
  { term: "2022.1", hours: 352, n: 6, avg: "7,4", bar: "bg-amber-500", diff: "—" },
  { term: "2022.2", hours: 384, n: 6, avg: "7,9", bar: "bg-emerald-500", diff: "+9,1%" },
  { term: "2023.1", hours: 320, n: 5, avg: "6,8", bar: "bg-yellow-400", diff: "−16,7%" },
  { term: "2023.2", hours: 416, n: 7, avg: "8,1", bar: "bg-emerald-500", diff: "+30,0%" },
];

function TermChart() {
  // pontos: horas acumuladas por período (dados de exemplo acima)
  const acc = TERMS.reduce<number[]>((a, t) => [...a, (a[a.length - 1] ?? 0) + t.hours], []);
  const max = 1600, w = 800, h = 220;
  const pts = acc.map((v, i) => [40 + (i * (w - 80)) / (acc.length - 1), h - 20 - (v / max) * (h - 40)] as const);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-8 w-full min-w-200 shrink-0" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M30 ${20 + i * 45}H${w}`} stroke="#E6E6E6" strokeWidth="1" />)}
      <polyline points={pts.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" className="stroke-orange-500" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" className="fill-white stroke-orange-500" strokeWidth="2" />)}
      {TERMS.map((t, i) => <text key={t.term} x={pts[i]![0]} y={h - 2} textAnchor="middle" className="fill-gray-500 text-[11px]">{t.term}</text>)}
    </svg>
  );
}

function TiltedPanel() {
  const total = TERMS.reduce((s, t) => s + t.hours, 0);
  return (
    <div className="h-150 shrink-0 overflow-hidden mask-[radial-gradient(white_30%,transparent_90%)] perspective-[4000px] perspective-origin-center">
      <div className="-translate-y-10 -translate-z-10 rotate-x-10 rotate-y-20 -rotate-z-10 transform-3d">
        <h3 className="text-sm text-gray-500">Horas integralizadas · histórico de exemplo</h3>
        <p className="mt-1 text-3xl font-semibold text-gray-900">{total.toLocaleString("pt-BR")} h</p>
        <p className="mt-1 text-sm font-medium">
          <span className="text-emerald-700">+416 h (+30,0%)</span>{" "}
          <span className="font-normal text-gray-500">no último período</span>
        </p>
        <TermChart />
        <TableRoot className="mt-6 min-w-200">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Período</TableHeaderCell>
                <TableHeaderCell className="text-right">Horas</TableHeaderCell>
                <TableHeaderCell className="text-right">Disciplinas</TableHeaderCell>
                <TableHeaderCell className="text-right">Média</TableHeaderCell>
                <TableHeaderCell className="text-right">Variação</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {TERMS.map((t) => (
                <TableRow key={t.term}>
                  <TableCell className="font-medium text-gray-900">
                    <div className="flex space-x-3">
                      <span className={`${t.bar} w-1 shrink-0 rounded-sm`} aria-hidden="true" />
                      <span>{t.term}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{t.hours} h</TableCell>
                  <TableCell className="text-right">{t.n}</TableCell>
                  <TableCell className="text-right">{t.avg}</TableCell>
                  <TableCell className="text-right">
                    <span className={t.diff.startsWith("−") ? "text-red-700" : t.diff === "—" ? "text-gray-500" : "text-emerald-700"}>{t.diff}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableRoot>
      </div>
    </div>
  );
}

export function Analytics() {
  return (
    <section aria-labelledby="historico" className="relative mx-auto w-full max-w-6xl overflow-hidden">
      <div>
        <h2 id="historico" className="relative scroll-my-24 text-lg font-semibold tracking-tight text-orange-700">
          Histórico e ritmo
          <div className="absolute top-1 -left-[8px] h-5 w-[3px] rounded-r-sm bg-orange-500" />
        </h2>
        <p className="mt-2 max-w-lg text-3xl font-semibold tracking-tighter text-balance text-gray-900 md:text-4xl">
          Notas, média ponderada e quando você forma, pelo seu ritmo real
        </p>
      </div>
      <div className="*:pointer-events-none" aria-hidden="true"><TiltedPanel /></div>
      <FeatureDivider className="mt-0" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <StickerCard Icon={RiStackLine} title="Extras e complementares"
          description="Optativas, Núcleo Livre e atividades complementares com situação e categoria." />
        <StickerCard Icon={RiTimerFlashLine} title="Agenda de provas"
          description="Provas, trabalhos e entregas com prazo, ligados às disciplinas do semestre." />
        <StickerCard Icon={RiDownload2Line} title="Backup portátil"
          description="Exporte o progresso em JSON e restaure em outra instância do Painel." />
        <StickerCard Icon={RiCalendarScheduleLine} title="Calendário acadêmico"
          description="Períodos e férias agendados pela administração valem para todos." />
      </div>
    </section>
  );
}
