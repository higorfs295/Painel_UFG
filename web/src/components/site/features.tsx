// Recursos — Features do tremorlabs/template-solar (MIT): grade de 4 colunas com guias
// tracejadas, três linhas alternando texto (2 colunas) e uma ilustração em código
// (2 colunas) sobre hachura diagonal. As ilustrações são as do template, com o conteúdo
// trocado: a órbita de veículos virou disciplinas com sua situação; os sensores de
// temperatura viraram disciplinas na grade; o chip ganhou a marca do Painel.
import {
  RiCalendarCheckLine, RiCheckLine, RiCodeSSlashLine, RiCpuLine, RiDatabase2Line, RiDownload2Line,
  RiFlaskLine, RiFunctionLine, RiLoaderFill, RiLock2Line, RiNotification2Line, RiTableLine,
} from "@remixicon/react";
import { BrandMark } from "@/components/brand";
import { ChipViz } from "./chip-viz";
import { DashedGuide, DiagonalPattern } from "./feature-divider";
import { Orbit } from "./orbit";

function Heading({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="col-span-2 my-auto px-2">
      <h2 className="relative text-lg font-semibold tracking-tight text-orange-700">
        {label}
        <div className="absolute top-1 -left-[8px] h-5 w-[3px] rounded-r-sm bg-orange-500" />
      </h2>
      <p className="mt-2 text-3xl font-semibold tracking-tighter text-balance text-gray-900 md:text-4xl">{title}</p>
      <p className="mt-4 text-balance text-gray-700">{children}</p>
    </div>
  );
}

function Planet({ icon: Icon, pill, delay }: {
  icon: React.ElementType; delay: string;
  pill?: { tone: "red" | "gray" | "emerald" | "orange"; text: string; icon: React.ElementType; spin?: boolean };
}) {
  const bg = { red: "bg-red-500", gray: "bg-gray-500", emerald: "bg-emerald-500", orange: "bg-orange-500" };
  return (
    <div className="relative flex items-center justify-center">
      <Icon className="z-10 size-5 text-gray-900" />
      <div className="absolute size-10 rounded-full bg-white/50 shadow-lg ring-1 ring-black/5" />
      {pill && (
        <div className="absolute -top-5 left-4">
          <div className="flex gap-1">
            <div className={`flex items-center justify-center rounded-l-full ${bg[pill.tone]} p-1 text-xs ring-1 ring-gray-200`}>
              <pill.icon className={`size-3 shrink-0 text-white ${pill.spin ? "animate-spin" : ""}`} />
            </div>
            <div className="rounded-r-full bg-white/50 py-0.5 pr-1.5 pl-1 text-xs whitespace-nowrap ring-1 ring-gray-200">{pill.text}</div>
          </div>
        </div>
      )}
      <div style={{ animationDelay: delay }} className="absolute size-10 animate-[ping_7s_ease_infinite] rounded-full ring-1 ring-orange-500/50" />
    </div>
  );
}

const TILES: { top: number; left: number; label: string }[] = [
  { top: 144, left: 48, label: "CÁL 1" }, { top: 48, left: 144, label: "FÍS 1" }, { top: 96, left: 240, label: "EDO" },
  { top: 240, left: 385, label: "ED 2" }, { top: 337, left: 336, label: "SO" }, { top: 288, left: 144, label: "CÁL 3" },
];

export function Features() {
  return (
    <section aria-label="Recursos do Painel" id="recursos" className="relative mx-auto max-w-6xl scroll-my-24">
      <div className="pointer-events-none inset-0 select-none">
        <DashedGuide />
        <DashedGuide className="right-0" />
        <DashedGuide className="left-1/2 -z-10" />
        <DashedGuide className="left-1/4 -z-10 hidden sm:block" />
        <DashedGuide className="left-3/4 -z-10 hidden sm:block" />
      </div>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-4 md:gap-0">
        <Heading label="Recomendações" title="Saiba o que cursar para destravar mais da sua matriz">
          O painel ordena as disciplinas disponíveis pelo número de matérias que cada uma libera
          adiante — direta e indiretamente — e mostra onde você está travado.
        </Heading>
        <div className="relative col-span-2 flex items-center justify-center overflow-hidden">
          <DiagonalPattern id="feat-1" className="mask-[linear-gradient(transparent,white_10rem)]" />
          <div className="pointer-events-none h-104 p-10 select-none" aria-hidden="true">
            <div className="relative flex flex-col items-center justify-center">
              <Orbit durationSeconds={40} radiusPx={140} keepUpright orbitingObjects={[
                <Planet key="1" icon={RiFunctionLine} delay="1s" pill={{ tone: "red", text: "Bloqueada", icon: RiLock2Line }} />,
                <Planet key="2" icon={RiCodeSSlashLine} delay="4s" pill={{ tone: "gray", text: "Cursando", icon: RiLoaderFill, spin: true }} />,
                <Planet key="3" icon={RiCpuLine} delay="2s" />,
                <Planet key="4" icon={RiFlaskLine} delay="6s" pill={{ tone: "emerald", text: "Concluída", icon: RiCheckLine }} />,
                <Planet key="5" icon={RiDatabase2Line} delay="3s" pill={{ tone: "orange", text: "Destrava 11", icon: RiCheckLine }} />,
              ]}>
                <div className="relative flex h-48 w-48 items-center justify-center">
                  <div className="rounded-full p-1 ring-1 ring-black/10">
                    <div className="relative z-10 flex size-20 items-center justify-center rounded-full bg-white shadow-[inset_0px_-15px_20px_rgba(0,0,0,0.1),0_7px_10px_0_rgba(0,0,0,0.15)] ring-1 ring-black/20">
                      <BrandMark className="size-9" />
                    </div>
                    <div className="absolute inset-12 animate-[spin_8s_linear_infinite] rounded-full bg-linear-to-t from-transparent via-orange-400 to-transparent blur-lg" />
                  </div>
                </div>
              </Orbit>
            </div>
          </div>
        </div>

        <Heading label="Pré-requisitos" title="Cada disciplina na camada certa da matriz">
          As disciplinas ficam organizadas pela profundidade da cadeia de pré-requisitos. Selecione
          uma e veja tudo o que ela exige — e tudo o que ela libera.
        </Heading>
        <div className="relative col-span-2 flex items-center justify-center overflow-hidden">
          <DiagonalPattern id="feat-2" />
          <div className="relative h-[432px] w-[432px]" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" className="mask absolute size-[432px]">
              <path className="stroke-gray-300" d="M48 0v432M96 0v432M144 0v432M192 0v432M240 0v432M288 0v432M336 0v432M384 0v432M0 48h432M0 96h432M0 144h432M0 192h432M0 240h432M0 288h432M0 336h432M0 384h432" />
            </svg>
            <div className="pointer-events-none relative h-full select-none">
              <div className="absolute top-[192px] left-[191.8px]">
                <div className="flex h-12 w-12 items-center justify-center bg-white shadow-sm ring-1 ring-black/15">
                  <BrandMark className="size-7" />
                </div>
              </div>
              {TILES.map((t) => (
                <div key={t.label} className="absolute" style={{ top: t.top, left: t.left }}>
                  <div className="relative">
                    <div className="absolute inset-0 size-12 animate-pulse bg-orange-200 blur-[3px]" />
                    <div className="relative flex h-12 w-12 items-center justify-center bg-white shadow-sm ring-1 ring-black/15">
                      <span className="text-xs font-medium text-gray-500">{t.label}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Heading label="Tudo conectado" title="Grade, agenda, avisos e backup saindo da mesma matriz">
          As disciplinas em curso entram no cronograma com o código de horário do SIGAA; provas e
          entregas vão para a agenda; e o progresso inteiro cabe num backup portátil.
        </Heading>
        <div className="relative col-span-2 flex items-center justify-center overflow-hidden">
          <DiagonalPattern id="feat-3" className="mask-[linear-gradient(white_10rem,transparent)]" />
          <div className="pointer-events-none relative flex size-full h-104 items-center justify-center p-10 select-none" aria-hidden="true">
            <div className="relative">
              {[
                ["top-24 left-24", RiNotification2Line], ["top-24 right-24", RiCalendarCheckLine],
                ["right-24 bottom-24", RiTableLine], ["bottom-24 left-24", RiDownload2Line],
              ].map(([pos, Icon], i) => {
                const I = Icon as React.ElementType;
                return (
                  <div key={i} className={`absolute z-20 ${pos as string}`}>
                    <div className="relative mx-auto w-fit rounded-full bg-gray-50 p-1 shadow-md ring-1 shadow-black/10 ring-black/10">
                      <div className="w-fit rounded-full bg-linear-to-b from-white to-gray-100 p-3 shadow-[inset_0px_-2px_6px_rgba(0,0,0,0.05),0_7px_10px_0_rgba(0,0,0,0.10)] ring-1 ring-white/50 ring-inset">
                        <I className="size-5 text-gray-900" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="relative">
              {[0, 45, 135, 180, 225, 315, 360].map((rotation, index) => (
                <div key={rotation} className="absolute origin-left overflow-hidden" style={{ transform: `rotate(${rotation}deg)` }}>
                  <div className="relative">
                    <div className="h-0.5 w-60 bg-linear-to-r from-gray-300 to-transparent" />
                    <div className="absolute top-0 left-0 h-0.5 w-28 bg-linear-to-r from-transparent via-orange-300 to-transparent"
                      style={{ animation: `gridMovingLine 5s linear infinite ${index * 1.2}s`, animationFillMode: "backwards" }} />
                  </div>
                </div>
              ))}
              <div className="absolute -translate-x-1/2 -translate-y-1/2"><ChipViz /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
