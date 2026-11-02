"use client";

// Seletor no topo da sidebar — o "WorkspacesDropdown" do tremorlabs/template-dashboard (MIT).
// Para o aluno, cada "workspace" é uma matrícula. Para o ADMIN (v12) a lista ganha a área de
// Administração no topo: o mesmo menu leva da gestão para o "Meu painel" de cada curso que o
// admin também cursa — é assim que uma conta de admin passa a ter os dois usos.
// O subtítulo mostra o período letivo corrente (RF-20, calendário global).
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RiAddLine, RiArrowRightSLine, RiExpandUpDownLine, RiShieldUserLine } from "@remixicon/react";
import { me } from "@/lib/api/endpoints";
import { useApp, useAuth } from "@/lib/auth-store";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/tremor/Dropdown";
import { cx, focusInput } from "@/lib/utils";
import { hashTone, tone } from "@/lib/palette";
import type { Enrollment } from "@/lib/api/types";

const STOP = new Set(["de", "da", "do", "das", "dos", "e", "em"]);

/** "Engenharia de Computação — UFG (…)" → "EC". */
export function courseInitials(name: string) {
  const main = name.split(/[—(-]/)[0] ?? name;
  const letters = main.split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase())).map((w) => w[0]!.toUpperCase());
  return letters.slice(0, 2).join("") || "PA";
}

/** Nome do curso sem o sufixo institucional, para caber na sidebar. */
export const shortCourse = (name: string) => (name.split(/\s+[—-]\s+/)[0] ?? name).trim();

/** Rota atual é da área do aluno? (o admin alterna entre as duas) */
export const inStudentArea = (pathname: string) => pathname === "/painel" || pathname.startsWith("/painel/");

function usePeriodLine() {
  const user = useAuth((s) => s.user);
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: me.profile, staleTime: 5 * 60_000 });
  const period = profile?.period ?? user?.period;
  if (!period) return "";
  return period.onBreak ? `Férias · próximo ${period.nextTerm}` : `Período ${period.label}`;
}

/** Azulejo com as iniciais: o curso ganha uma cor estável; a administração, o destaque. */
function Tile({ text, admin, seed, className }: { text: string; admin?: boolean; seed?: string; className?: string }) {
  const color = admin
    ? "bg-brand-700 text-white dark:bg-brand-400 dark:text-gray-950"
    : tone(hashTone(seed ?? text)).solid;
  return (
    <span aria-hidden="true"
      className={cx("flex aspect-square shrink-0 items-center justify-center rounded-sm p-2 text-xs font-semibold", color, className)}>
      {admin ? <RiShieldUserLine className="size-4" /> : text}
    </span>
  );
}

function useWorkspace(enrollments: Enrollment[]) {
  const user = useAuth((s) => s.user);
  const enrollmentId = useApp((s) => s.enrollmentId);
  const pathname = usePathname();
  const isAdmin = user?.role === "ADMIN";
  const current = enrollments.find((e) => e.id === enrollmentId);
  // admin fora do /painel está na área de administração (inclusive em Ajustes/Ajuda)
  const adminMode = isAdmin && !inStudentArea(pathname);
  return { isAdmin, adminMode, current };
}

function Items({ enrollments, isAdmin, adminMode }: { enrollments: Enrollment[]; isAdmin: boolean; adminMode: boolean }) {
  const { enrollmentId, setEnrollment } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const pick = (id: string) => {
    setEnrollment(id);
    if (!inStudentArea(pathname)) router.push("/painel");
  };
  return (
    <>
      {isAdmin && (
        <>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Gestão</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => router.push("/admin")}>
              <div className="flex w-full items-center gap-x-2.5">
                <Tile text="AD" admin className="size-8" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">Administração</p>
                  <p className="text-xs text-gray-700 dark:text-gray-400">{adminMode ? "área atual" : "usuários, cursos, relatórios"}</p>
                </div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuGroup>
        <DropdownMenuLabel>{isAdmin ? "Meu painel" : "Cursos"} ({enrollments.length})</DropdownMenuLabel>
        {enrollments.map((e) => (
          <DropdownMenuItem key={e.id} onSelect={() => pick(e.id)}>
            <div className="flex w-full items-center gap-x-2.5">
              <Tile text={courseInitials(e.course.name)} seed={e.course.slug} className="size-8" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">{shortCourse(e.course.name)}</p>
                <p className="text-xs text-gray-700 dark:text-gray-400">
                  {e.course.slug}{e.id === enrollmentId && !adminMode ? " · selecionado" : ""}
                </p>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        {isAdmin && enrollments.length === 0 && (
          <DropdownMenuItem onSelect={() => router.push("/painel")}>
            <span className="text-sm text-gray-700 dark:text-gray-300">Acompanhar o meu curso também…</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/config#cursos" className="flex items-center gap-x-2">
          <RiAddLine className="size-4 shrink-0" aria-hidden="true" /> Adicionar curso
        </Link>
      </DropdownMenuItem>
    </>
  );
}

export function CourseSwitcherDesktop({ enrollments }: { enrollments: Enrollment[] }) {
  const { isAdmin, adminMode, current } = useWorkspace(enrollments);
  const periodLine = usePeriodLine();

  const title = adminMode ? "Administração" : current ? shortCourse(current.course.name) : "Sem curso";
  const subtitle = adminMode ? (periodLine || "Administrador") : periodLine || "Aluno";

  const trigger = (
    <button
      className={cx(
        "flex w-full items-center gap-x-2.5 rounded-md border border-gray-300 bg-white p-2 text-left text-sm shadow-xs transition-all hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900",
        focusInput,
      )}
      aria-label={isAdmin ? "Trocar de área ou de curso" : "Trocar de curso"}>
      {adminMode
        ? <Tile text="AD" admin className="size-8" />
        : <Tile text={current ? courseInitials(current.course.name) : "PA"} seed={current?.course.slug} className="size-8" />}
      <div className="flex w-full items-center justify-between gap-x-4 truncate">
        <div className="truncate">
          <p className="truncate text-sm font-medium whitespace-nowrap text-gray-900 dark:text-gray-50">{title}</p>
          <p className="text-left text-xs whitespace-nowrap text-gray-700 dark:text-gray-300">{subtitle}</p>
        </div>
        <RiExpandUpDownLine className="size-5 shrink-0 text-gray-500" aria-hidden="true" />
      </div>
    </button>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="!min-w-[var(--radix-dropdown-menu-trigger-width)]">
        <Items enrollments={enrollments} isAdmin={isAdmin} adminMode={adminMode} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CourseSwitcherMobile({ enrollments }: { enrollments: Enrollment[] }) {
  const { isAdmin, adminMode, current } = useWorkspace(enrollments);
  const title = adminMode ? "Administração" : current ? shortCourse(current.course.name) : "Painel";

  const trigger = (
    <button className="flex min-w-0 items-center gap-x-1.5 rounded-md p-2 hover:bg-gray-100 focus:outline-hidden dark:hover:bg-gray-900"
      aria-label={isAdmin ? "Trocar de área ou de curso" : "Trocar de curso"}>
      {adminMode
        ? <Tile text="AD" admin className="size-7" />
        : <Tile text={current ? courseInitials(current.course.name) : "PA"} seed={current?.course.slug} className="size-7" />}
      <RiArrowRightSLine className="size-4 shrink-0 text-gray-500" aria-hidden="true" />
      <div className="flex w-full min-w-0 items-center justify-between gap-x-3 truncate">
        <p className="truncate text-sm font-medium whitespace-nowrap text-gray-900 dark:text-gray-50">{title}</p>
        <RiExpandUpDownLine className="size-4 shrink-0 text-gray-500" aria-hidden="true" />
      </div>
    </button>
  );
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent className="!min-w-72">
        <Items enrollments={enrollments} isAdmin={isAdmin} adminMode={adminMode} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
