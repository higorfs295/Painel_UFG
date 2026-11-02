// Chamada final — CallToAction do tremorlabs/template-solar (MIT): texto em 2 colunas e,
// nas outras 4, uma "imagem" com uma cópia desfocada atrás. A foto da fazenda virou uma
// prévia do próprio painel, desenhada com os componentes do app (valores de exemplo).
import Link from "next/link";
import { ProgressBar } from "@/components/tremor/ProgressBar";
import { SiteButton } from "./button";

const ROWS = [
  { t: "Núcleo Comum", c: "1.216", a: "1.600", p: 76 },
  { t: "Núcleo Específico Obrigatório", c: "1.088", a: "1.984", p: 54.8 },
  { t: "Núcleo Específico Optativo", c: "128", a: "320", p: 40 },
  { t: "Núcleo Livre", c: "128", a: "128", p: 100 },
];

function Preview() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="flex items-center gap-2">
        <span className="font-bold text-gray-900 sm:text-sm">Integralização</span>
        <span className="rounded-sm bg-gray-50 px-1.5 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-500/30">exemplo</span>
      </div>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-xl text-gray-900">61,9%</span>
        <span className="text-sm text-gray-500">2.560 h de 4.132 h</span>
      </p>
      <ul className="mt-4 space-y-5">
        {ROWS.map((r) => (
          <li key={r.t}>
            <p className="flex justify-between text-sm">
              <span className="font-medium text-gray-900">{r.t}</span>
              <span className="font-medium text-gray-900">{r.c}<span className="font-normal text-gray-500">/{r.a} h</span></span>
            </p>
            <ProgressBar value={r.p} className="mt-2 [&>*]:h-1.5" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CallToAction() {
  return (
    <section aria-labelledby="cta-title" className="mx-auto max-w-6xl">
      <div className="grid items-center gap-8 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <h2 id="cta-title" className="scroll-my-60 text-3xl font-semibold tracking-tighter text-balance text-gray-900 md:text-4xl">
            Pronto para o próximo semestre?
          </h2>
          <p className="mt-3 mb-8 text-lg text-gray-600">
            Leva alguns minutos para marcar o que você já cursou — o resto o painel calcula.
          </p>
          <div className="flex flex-wrap gap-4">
            <SiteButton asChild className="text-base"><Link href="/cadastro">Criar conta</Link></SiteButton>
            <SiteButton asChild variant="secondary" className="text-base"><Link href="/entrar">Já tenho conta</Link></SiteButton>
          </div>
        </div>
        <div className="relative isolate sm:col-span-4" aria-hidden="true">
          <div className="absolute inset-0 -z-10 rounded-2xl bg-linear-to-br from-orange-200 via-orange-100 to-gray-100 blur-xl" />
          <Preview />
        </div>
      </div>
    </section>
  );
}
