// Casca das telas de entrada: tela dividida com o herói em gradiente à esquerda e o
// formulário à direita. Grupo de rota `(auth)` — a URL não ganha segmento, exatamente
// como o nextjs-admin-dashboard separa `(with-layout)` de `(without-layout)`.
import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import { IconCheck, IconGrid, IconSprout, IconStar } from "@/components/ui/icons";

const PONTOS = [
  { icon: IconStar, text: "Recomendações pelo que mais destrava a sua matriz" },
  { icon: IconGrid, text: "Cenários de grade com os códigos do SIGAA" },
  { icon: IconSprout, text: "Optativas, Núcleo Livre e horas complementares no lugar" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden flex-col justify-center overflow-hidden p-12 text-[#fbefe0] lg:flex"
        style={{ background: "var(--sidebar-gradient)" }}>
        <div aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-28 size-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,231,184,.32), transparent 62%)" }} />

        <Link href="/" className="font-display relative flex items-center gap-2.5 text-lg font-semibold text-[#fbefe0]">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-white/15 text-sm font-bold">PA</span>
          {APP_NAME}
        </Link>

        <h2 className="font-display relative mt-10 text-5xl leading-[0.98] font-semibold tracking-tight">
          Cada aula, um passo rumo ao <em className="not-italic text-[#ffe7b8]">horizonte</em>.
        </h2>
        <p className="relative mt-4 max-w-[40ch] text-[#fbefe0]/70">{APP_TAGLINE}</p>

        <ul className="relative mt-10 flex flex-col gap-3">
          {PONTOS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-[#fbefe0]/75">
              <Icon className="shrink-0 text-[#ffe7b8]" /> {text}
            </li>
          ))}
        </ul>

        <p className="relative mt-10 flex items-center gap-2 text-xs text-[#fbefe0]/60">
          <IconCheck className="text-[#ffe7b8]" /> sessão com renovação rotativa e matrícula cifrada em repouso
        </p>
      </aside>

      <main className="grid place-items-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}
