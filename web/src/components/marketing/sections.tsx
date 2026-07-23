"use client";

// Seções da página pública — a composição do solid-nextjs (header fixo → hero → features
// → números → CTA → rodapé) com o conteúdo e a paleta do Painel. As animações usam
// framer-motion, como no template, sempre com `whileInView` para não animar o que ninguém
// está vendo.
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import Button from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  IconBook, IconChart, IconCheck, IconGrid, IconSprout, IconStar, IconTarget, IconClock,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};
const viewport = { once: true, margin: "-80px" };

export function SiteHeader() {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn(
      "fixed inset-x-0 top-0 z-50 transition-all duration-300",
      stuck ? "bg-background/85 border-b py-3 backdrop-blur-md" : "py-6",
    )}>
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5">
        <Link href="/" className="font-display flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg text-sm font-bold text-[#1b1109]"
            style={{ background: "var(--sidebar-gradient)" }}>
            PA
          </span>
          {APP_NAME}
        </Link>
        <nav className="text-muted-foreground ml-auto hidden items-center gap-6 text-sm md:flex">
          <a href="#recursos" className="hover:text-foreground transition-colors">Recursos</a>
          <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
          <a href="#perguntas" className="hover:text-foreground transition-colors">Perguntas</a>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          <Link href="/entrar"><Button variant="primary" size="sm">Entrar</Button></Link>
        </div>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-36 pb-20 sm:pt-44 sm:pb-28">
      {/* halo do poente atrás do título */}
      <div aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[680px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
        style={{ background: "radial-gradient(circle, var(--color-primary), transparent 62%)" }} />

      <div className="relative mx-auto max-w-4xl px-5 text-center">
        <motion.span initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5 }}
          className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <IconSprout /> integralização, cronograma e histórico num lugar só
        </motion.span>

        <motion.h1 initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display mt-6 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
          {APP_TAGLINE.charAt(0).toUpperCase() + APP_TAGLINE.slice(1)}
        </motion.h1>

        <motion.p initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.6, delay: 0.12 }}
          className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base sm:text-lg">
          O Painel lê a sua matriz curricular, entende os pré-requisitos e mostra o que falta,
          o que já dá para cursar e o que mais destrava o seu caminho até a formatura.
        </motion.p>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/entrar"><Button variant="primary">Entrar no painel</Button></Link>
          <Link href="/cadastro"><Button variant="outline">Criar conta</Button></Link>
        </motion.div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: IconTarget, title: "Integralização com a regra do teto",
    text: "Cada composição soma até o mínimo exigido; o excedente aparece separado, sem inflar o total." },
  { icon: IconStar, title: "Recomendações por destravamento",
    text: "Ordena o que está disponível pelo número de disciplinas que cada uma libera adiante." },
  { icon: IconGrid, title: "Cronograma que se preenche",
    text: "As disciplinas em curso entram na grade sozinhas — você informa só o código de horário do SIGAA." },
  { icon: IconChart, title: "Histórico e média ponderada",
    text: "Notas por período, MGA ponderada pela carga horária e uma estimativa honesta de quando você forma." },
  { icon: IconBook, title: "Extras no lugar certo",
    text: "Optativas, Núcleo Livre e atividades complementares com estado e reclassificação." },
  { icon: IconClock, title: "Calendário acadêmico global",
    text: "Períodos e férias agendados pela administração valem para todo mundo, na hora certa." },
];

export function Features() {
  return (
    <section id="recursos" className="border-t py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div initial="hidden" whileInView="visible" viewport={viewport} variants={fadeUp} transition={{ duration: 0.5 }}>
          <span className="eyebrow">o que ele faz</span>
          <h2 className="mt-2 text-3xl sm:text-4xl">Feito para a régua real do curso</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            Nada de planilha paralela: as regras da matriz viram cálculo, e o cálculo vira decisão de matrícula.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.article key={f.title}
                initial="hidden" whileInView="visible" viewport={viewport} variants={fadeUp}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="bg-card rounded-xl border p-6 shadow-sm">
                <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-lg">
                  <Icon />
                </span>
                <h3 className="font-display mt-4 text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{f.text}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "Escolha o curso", text: "A matriz oficial já vem carregada, com pré-requisitos, marcos de horas e composições." },
  { n: "02", title: "Marque o que já cursou", text: "Aprovada, cursando ou simulada — com nota, faltas e período quando quiser." },
  { n: "03", title: "Planeje o próximo semestre", text: "Veja o que destrava mais, monte a grade e acompanhe o quanto falta." },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-t py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div initial="hidden" whileInView="visible" viewport={viewport} variants={fadeUp} transition={{ duration: 0.5 }}>
          <span className="eyebrow">como funciona</span>
          <h2 className="mt-2 text-3xl sm:text-4xl">Três passos até o próximo semestre</h2>
        </motion.div>

        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.li key={s.n}
              initial="hidden" whileInView="visible" viewport={viewport} variants={fadeUp}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-card relative rounded-xl border p-6 shadow-sm">
              <span className="font-display text-primary/25 absolute top-4 right-5 text-5xl font-semibold">{s.n}</span>
              <h3 className="font-display relative text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="text-muted-foreground relative mt-2 text-sm">{s.text}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FAQ = [
  { q: "Preciso digitar a matriz do meu curso?",
    a: "Não. As matrizes são importadas por quem administra a instância, com pré-requisitos, co-requisitos e marcos de horas. Você só marca o que já cursou." },
  { q: "O que é a 'regra do teto'?",
    a: "Cada composição (Núcleo Comum, Optativas, Núcleo Livre, Atividades Complementares) soma no máximo o que ela exige. Horas além disso aparecem como excedente, mas não empurram o total de integralização para cima — é assim que a coordenação conta." },
  { q: "Simular altera o meu progresso oficial?",
    a: "Não. O estado simulado entra só na projeção, lado a lado com o número oficial, para você comparar cenários antes de se matricular." },
  { q: "Meus dados ficam salvos onde?",
    a: "No banco da instituição que hospeda a instância. A matrícula é guardada cifrada, e a sessão usa token de curta duração com renovação rotativa." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="perguntas" className="border-t py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5">
        <motion.div initial="hidden" whileInView="visible" viewport={viewport} variants={fadeUp} transition={{ duration: 0.5 }}>
          <span className="eyebrow">perguntas</span>
          <h2 className="mt-2 text-3xl sm:text-4xl">Antes de começar</h2>
        </motion.div>

        <div className="mt-10 flex flex-col gap-3">
          {FAQ.map((item, i) => (
            <div key={item.q} className="bg-card rounded-xl border shadow-sm">
              <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}
                className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left">
                <span className="font-medium">{item.q}</span>
                <span className={cn("text-primary transition-transform", open === i && "rotate-45")} aria-hidden="true">+</span>
              </button>
              {open === i && <p className="text-muted-foreground border-t px-5 py-4 text-sm">{item.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Cta() {
  return (
    <section className="px-5 py-20 sm:py-28">
      <motion.div initial="hidden" whileInView="visible" viewport={viewport} variants={fadeUp} transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl p-10 text-center sm:p-16"
        style={{ background: "var(--sidebar-gradient)" }}>
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 size-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,231,184,.3), transparent 62%)" }} />
        <h2 className="font-display relative text-3xl font-semibold tracking-tight text-[#fbefe0] sm:text-4xl">
          Comece pelo semestre que vem
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-[#fbefe0]/75">
          Leva alguns minutos para marcar o que você já cursou — e a partir daí o painel faz o resto.
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/cadastro">
            <Button className="border-transparent bg-[#fbefe0] text-[#3b2a4e] hover:bg-white">Criar minha conta</Button>
          </Link>
          <Link href="/entrar">
            <Button variant="ghost" className="text-[#fbefe0] hover:bg-white/15 hover:text-white">Já tenho conta</Button>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t py-10">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 text-sm">
        <span className="font-display text-foreground text-base font-semibold tracking-tight">{APP_NAME}</span>
        <nav className="flex flex-wrap items-center gap-5">
          <Link href="/entrar" className="hover:text-primary transition-colors">Entrar</Link>
          <Link href="/cadastro" className="hover:text-primary transition-colors">Criar conta</Link>
          <a href="#recursos" className="hover:text-primary transition-colors">Recursos</a>
        </nav>
        <small className="text-subtle-foreground flex items-center gap-1.5 text-[0.7rem] tracking-[0.14em] uppercase">
          <IconCheck /> feito no cerrado · {new Date().getFullYear()}
        </small>
      </div>
    </footer>
  );
}
