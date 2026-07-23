"use client";

// Trilho lateral do painel.
//
// A mecânica (contexto próprio, `sticky` no desktop, `fixed` + overlay no mobile,
// `inert` quando fechado) é a do nextjs-admin-dashboard. A pele é a do projeto: ilha com
// o gradiente do poente e azulejos coloridos por item.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { APP_NAME } from "@/lib/branding";
import { cn, initials } from "@/lib/utils";
import { useAuth } from "@/lib/auth-store";
import { isActive, navFor } from "./nav-data";
import { IconMenu, IconOut, IconX } from "@/components/ui/icons";

type Ctx = {
  open: boolean; setOpen: (v: boolean) => void; toggle: () => void;
  collapsed: boolean; toggleCollapsed: () => void;
  isMobile: boolean;
};
const SidebarContext = createContext<Ctx | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar precisa estar dentro de <SidebarProvider>");
  return ctx;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // a preferência de recolher é local (não vale a pena ir ao servidor por isso)
  useEffect(() => { setCollapsed(localStorage.getItem("side-collapsed") === "1"); }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => { localStorage.setItem("side-collapsed", v ? "0" : "1"); return !v; });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ open, setOpen, toggle: () => setOpen((v) => !v), collapsed, toggleCollapsed, isMobile }),
    [open, collapsed, toggleCollapsed, isMobile],
  );
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

const railBtn =
  "grid cursor-pointer place-items-center rounded-md p-1.5 text-sidebar-foreground/70 " +
  "transition-colors hover:bg-white/15 hover:text-sidebar-foreground";

export function Sidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const { open, setOpen, collapsed, toggleCollapsed, isMobile } = useSidebar();
  const sections = navFor(user?.role);

  // fecha a gaveta a cada navegação
  useEffect(() => { setOpen(false); }, [pathname, setOpen]);

  const mark = APP_NAME.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "P";
  const shrunk = collapsed && !isMobile;

  return (
    <>
      {isMobile && open && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <aside
        style={{ background: "var(--sidebar-gradient)" }}
        aria-label="Barra lateral"
        {...(isMobile && !open ? { inert: "" as unknown as boolean } : {})}
        className={cn(
          "text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex flex-col gap-1 overflow-y-auto p-3 shadow-xl",
          "transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 lg:shadow-none",
          shrunk ? "w-64 lg:w-[76px]" : "w-64",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("flex items-center gap-2.5 px-1 py-2", shrunk && "lg:flex-col lg:gap-3")}>
          <span aria-hidden="true"
            className="font-display grid size-8 shrink-0 place-items-center rounded-lg bg-white/15 text-sm font-bold">
            {mark}
          </span>
          {!shrunk && <span className="font-display truncate text-[0.95rem] font-semibold tracking-tight">{APP_NAME}</span>}

          <button onClick={toggleCollapsed} className={cn(railBtn, "ml-auto hidden lg:grid", shrunk && "lg:ml-0")}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
            <IconMenu />
          </button>
          <button onClick={() => setOpen(false)} className={cn(railBtn, "ml-auto lg:hidden")} aria-label="Fechar menu">
            <IconX />
          </button>
        </div>

        {/* o rótulo acessível vai no <nav> (é ele a navegação), não no <aside> */}
        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-5 py-2">
          {sections.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              {!shrunk && (
                <span className="text-sidebar-foreground/45 px-3 pb-1.5 text-[0.6rem] font-semibold tracking-[0.18em] uppercase">
                  {section.label}
                </span>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item);
                return (
                  <Link key={item.href} href={item.href} title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium",
                      "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                      // indicador lateral: o fundo sozinho é sutil demais sobre o gradiente
                      "before:absolute before:top-1/2 before:left-0 before:h-5 before:w-0.5 before:-translate-y-1/2",
                      "before:rounded-r before:bg-white before:transition-transform",
                      active ? "before:scale-y-100" : "before:scale-y-0",
                      shrunk && "lg:justify-center lg:px-1.5",
                      active
                        ? "bg-white/15 text-sidebar-foreground shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground",
                    )}>
                    <span aria-hidden="true"
                      style={{ background: `color-mix(in srgb, ${item.color} 22%, transparent)`, color: item.color }}
                      className="grid size-7 shrink-0 place-items-center rounded-md transition-transform group-hover:scale-105">
                      <Icon />
                    </span>
                    {!shrunk && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={cn("mt-auto flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2",
          shrunk && "lg:flex-col lg:gap-2")}>
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-[0.7rem] font-bold">
            {initials(user?.name)}
          </span>
          {!shrunk && (
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <strong className="truncate text-[0.8rem] font-semibold">{user?.name}</strong>
              <small className="text-sidebar-foreground/60 truncate text-[0.68rem]">
                {user?.role === "ADMIN" ? "administra o sistema" : user?.email}
              </small>
            </span>
          )}
          <button onClick={onLogout} className={railBtn} title="Sair" aria-label="Sair"><IconOut /></button>
        </div>
      </aside>
    </>
  );
}
