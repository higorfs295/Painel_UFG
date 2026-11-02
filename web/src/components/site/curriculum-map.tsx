// Seção escura — "Map" do tremorlabs/template-solar (MIT): cartão gray-950 com bordas
// laterais hachuradas, título em laranja, e um desenho em SVG com marcadores que pulsam.
// O mapa da fazenda virou um mapa curricular: camadas de disciplinas ligadas pelos
// pré-requisitos, com a cadeia de uma delas em destaque (traço animado, `animate-dashes`).
import { RiBookOpenLine, RiCheckLine, RiLoaderFill, RiLock2Line } from "@remixicon/react";

type N = { id: string; x: number; y: number; label: string };
const COLS = [70, 210, 350, 490, 630];
const NODES: N[] = [
  { id: "a", x: COLS[0]!, y: 50, label: "CÁL 1A" }, { id: "b", x: COLS[0]!, y: 130, label: "ALG LIN" }, { id: "c", x: COLS[0]!, y: 210, label: "INT COMP" },
  { id: "d", x: COLS[1]!, y: 50, label: "CÁL 2A" }, { id: "e", x: COLS[1]!, y: 170, label: "PROG OO" },
  { id: "f", x: COLS[2]!, y: 70, label: "CÁL 3A" }, { id: "g", x: COLS[2]!, y: 190, label: "ED 1" },
  { id: "h", x: COLS[3]!, y: 110, label: "SINAIS" }, { id: "i", x: COLS[3]!, y: 210, label: "ED 2" },
  { id: "j", x: COLS[4]!, y: 150, label: "CONTROLE" },
];
const EDGES: [string, string][] = [["a", "d"], ["b", "d"], ["c", "e"], ["d", "f"], ["e", "g"], ["f", "h"], ["g", "i"], ["h", "j"], ["b", "h"]];
const HOT = new Set(["a-d", "d-f", "f-h", "h-j"]);
const at = (id: string) => NODES.find((n) => n.id === id)!;
const curve = (p: N, q: N) => `M${p.x + 34} ${p.y}C${(p.x + q.x) / 2} ${p.y} ${(p.x + q.x) / 2} ${q.y} ${q.x - 34} ${q.y}`;

function Marker({ left, top, label, icon: Icon, ping }: { left: number; top: number; label?: string; icon: React.ElementType; ping?: boolean }) {
  return (
    <div className="absolute" style={{ left, top }}>
      <div className="relative flex items-center justify-center">
        <div className="absolute size-10 rounded-full bg-gray-950 ring-1 ring-white/15" />
        {label && (
          <div className="absolute -top-4 left-5 flex w-fit items-center justify-center rounded-full bg-gray-950 px-1.5 py-0.5 text-xs whitespace-nowrap text-white ring-1 ring-white/15">
            {label}
          </div>
        )}
        <Icon className="relative size-5 text-white" />
        {ping && <div style={{ animationDelay: "3.5s" }} className="absolute size-10 animate-[ping_5s_ease_infinite] rounded-full ring-1 ring-orange-500/50" />}
      </div>
    </div>
  );
}

function SideHatch({ side }: { side: "left" | "right" }) {
  return (
    <div className={`absolute ${side === "left" ? "left-0" : "right-0"} z-10 h-full backdrop-blur-[2px]`}>
      <svg className="h-full w-8 border-r border-zinc-900 stroke-zinc-800 sm:w-20" aria-hidden="true"
        style={{ maskImage: "linear-gradient(transparent, white 10rem, white calc(100% - 10rem), transparent)" }}>
        <defs>
          <pattern id={`hatch-${side}`} patternUnits="userSpaceOnUse" width="64" height="64">
            {Array.from({ length: 17 }, (_, i) => <path key={i} d={`M${-106 + i * 8} 110L${22 + i * 8} -18`} strokeWidth="1" />)}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#hatch-${side})`} />
      </svg>
    </div>
  );
}

export function CurriculumMap() {
  return (
    <section id="mapa" aria-labelledby="mapa-title"
      className="relative flex w-full max-w-6xl scroll-my-24 flex-col items-center justify-center overflow-hidden rounded-2xl bg-gray-950 px-10 shadow-2xl shadow-black/50 sm:px-16 md:px-28 lg:mx-auto">
      <SideHatch side="left" />
      <SideHatch side="right" />

      <div className="pt-12 text-base font-semibold tracking-tight text-orange-400 sm:pt-20 sm:text-lg">Mapa curricular</div>
      <h2 id="mapa-title" className="mt-6 max-w-[700px] text-center text-2xl font-semibold tracking-tight text-balance text-white md:text-5xl">
        A cadeia de pré-requisitos, à vista
      </h2>
      <p className="mt-4 max-w-2xl text-center text-base text-balance text-gray-400 sm:mt-8 sm:text-xl">
        Cada disciplina na sua camada, colorida pela situação. Escolha uma e o painel acende o caminho
        que leva até ela e tudo o que ela destrava.
      </p>

      <div className="relative mt-10 mb-10 w-full overflow-x-auto pt-10 sm:mb-16 md:mt-14">
        <div className="relative mx-auto h-[260px] w-[700px]" aria-hidden="true">
          <svg viewBox="0 0 700 260" className="absolute inset-0 h-full w-full" fill="none">
            {EDGES.map(([p, q]) => {
              const hot = HOT.has(`${p}-${q}`);
              return (
                <path key={`${p}-${q}`} d={curve(at(p), at(q))} strokeLinecap="round"
                  className={hot ? "animate-dashes stroke-orange-400" : "stroke-zinc-800"}
                  strokeWidth={hot ? 1.5 : 1} strokeDasharray={hot ? "4 3" : undefined} />
              );
            })}
          </svg>
          {NODES.map((n) => (
            <div key={n.id} className="absolute flex h-7 w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-gray-950 font-mono text-[10px] text-gray-300 ring-1 ring-white/15"
              style={{ left: n.x, top: n.y }}>
              {n.label}
            </div>
          ))}
          <Marker left={COLS[0]! - 12} top={-10} icon={RiCheckLine} label="Concluída" />
          <Marker left={COLS[1]! - 12} top={-10} icon={RiLoaderFill} label="Cursando" ping />
          <Marker left={COLS[3]! - 12} top={56} icon={RiBookOpenLine} label="Disponível" ping />
          <Marker left={COLS[4]! - 12} top={96} icon={RiLock2Line} label="Bloqueada" />
        </div>
      </div>
    </section>
  );
}
