"use client";

// Barra do site — NavBar do tremorlabs/template-solar (MIT): flutua a 1 rem do topo,
// transparente até rolar; aí ganha fundo branco translúcido, borda e sombra longa.
import Link from "next/link";
import { useEffect, useState } from "react";
import { RiCloseFill, RiMenuFill } from "@remixicon/react";
import { BrandWordmark } from "@/components/brand";
import { APP_NAME } from "@/lib/branding";
import { cx } from "@/lib/utils";
import { SiteButton } from "./button";

const LINKS = [
  { href: "#recursos", label: "Recursos" },
  { href: "#mapa", label: "Mapa curricular" },
  { href: "#historico", label: "Histórico" },
];

export function NavBar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 15);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cx(
      "fixed inset-x-4 top-4 z-50 mx-auto flex max-w-6xl justify-center rounded-lg border border-transparent px-3 py-3 transition duration-300",
      scrolled || open ? "border-gray-200/50 bg-white/80 shadow-2xl shadow-black/5 backdrop-blur-sm" : "bg-white/0",
    )}>
      <div className="w-full md:my-auto">
        <div className="relative flex items-center justify-between">
          <Link href="/" aria-label={`${APP_NAME} — início`}><BrandWordmark className="text-gray-900" /></Link>
          <nav aria-label="Seções" className="hidden sm:block md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
            <div className="flex items-center gap-10 font-medium">
              {LINKS.map((l) => <a key={l.href} className="px-2 py-1 text-gray-900" href={l.href}>{l.label}</a>)}
            </div>
          </nav>
          <SiteButton asChild variant="secondary" className="hidden h-10 font-semibold sm:inline-flex">
            <Link href="/entrar">Entrar</Link>
          </SiteButton>
          <SiteButton onClick={() => setOpen(!open)} variant="secondary" className="p-1.5 sm:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open}>
            {open ? <RiCloseFill className="size-6 shrink-0 text-gray-900" aria-hidden /> : <RiMenuFill className="size-6 shrink-0 text-gray-900" aria-hidden />}
          </SiteButton>
        </div>
        <nav aria-label="Seções (mobile)" className={cx("mt-6 flex flex-col gap-6 text-lg sm:hidden", open ? "" : "hidden")}>
          <ul className="space-y-4 font-medium">
            {LINKS.map((l) => <li key={l.href}><a href={l.href} onClick={() => setOpen(false)}>{l.label}</a></li>)}
          </ul>
          <SiteButton asChild variant="secondary" className="text-lg"><Link href="/entrar">Entrar</Link></SiteButton>
        </nav>
      </div>
    </header>
  );
}
