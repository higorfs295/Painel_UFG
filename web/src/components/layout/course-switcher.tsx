"use client";

// Seletor de curso no topo da sidebar — o "WorkspacesDropdown" do tremorlabs/template-
// dashboard (MIT), onde cada workspace virou uma matrícula. O subtítulo mostra o período
// letivo corrente (RF-20, calendário global mantido pelos admins).
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RiAddLine, RiArrowRightSLine, RiExpandUpDownLine } from "@remixicon/react";
import { me } from "@/lib/api/endpoints";
import { useApp, useAuth } from "@/lib/auth-store";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/tremor/Dropdown";
import { cx, focusInput } from "@/lib/utils";
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

function usePeriodLine() {
  const user = useAuth((s) => s.user);
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: me.profile, staleTime: 5 * 60_000 });
  const period = profile?.period ?? user?.period;
  if (!period) return "";
  return period.onBreak ? `Férias · próximo ${period.nextTerm}` : `Período ${period.label}`;
}

function Tile({ text, className }: { text: string; className?: string }) {
  return (
    <span aria-hidden="true"
      className={cx("flex aspect-square items-center justify-center rounded-sm bg-orange-700 p-2 text-xs font-medium text-white dark:bg-orange-500 dark:text-gray-950", className)}>
      {text}
    </span>
  );
}

function Items({ enrollments }: { enrollments: Enrollment[] }) {
  const { enrollmentId, setEnrollment } = useApp();
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Cursos ({enrollments.length})</DropdownMenuLabel>
        {enrollments.map((e) => (
          <DropdownMenuItem key={e.id} onSelect={() => setEnrollment(e.id)}>
            <div className="flex w-full items-center gap-x-2.5">
              <Tile text={courseInitials(e.course.name)} className="size-8" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">{shortCourse(e.course.name)}</p>
                <p className="text-xs text-gray-700 dark:text-gray-400">
                  {e.course.slug}{e.id === enrollmentId ? " · selecionado" : ""}
                </p>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
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
  const user = useAuth((s) => s.user);
  const enrollmentId = useApp((s) => s.enrollmentId);
  const periodLine = usePeriodLine();
  const isAdmin = user?.role === "ADMIN";
  const current = enrollments.find((e) => e.id === enrollmentId);

  const title = isAdmin ? "Administração" : current ? shortCourse(current.course.name) : "Sem curso";
  const subtitle = isAdmin ? (periodLine || "Administrador") : periodLine || "Aluno";
  const initials = isAdmin ? "AD" : current ? courseInitials(current.course.name) : "PA";

  const trigger = (
    <button
      className={cx(
        "flex w-full items-center gap-x-2.5 rounded-md border border-gray-300 bg-white p-2 text-left text-sm shadow-xs transition-all hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900",
        focusInput,
      )}
      aria-label={isAdmin ? "Área de administração" : "Trocar de curso"}>
      <Tile text={initials} className="size-8" />
      <div className="flex w-full items-center justify-between gap-x-4 truncate">
        <div className="truncate">
          <p className="truncate text-sm font-medium whitespace-nowrap text-gray-900 dark:text-gray-50">{title}</p>
          <p className="text-left text-xs whitespace-nowrap text-gray-700 dark:text-gray-300">{subtitle}</p>
        </div>
        {!isAdmin && <RiExpandUpDownLine className="size-5 shrink-0 text-gray-500" aria-hidden="true" />}
      </div>
    </button>
  );

  if (isAdmin) return <div className="pointer-events-none">{trigger}</div>;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="!min-w-[var(--radix-dropdown-menu-trigger-width)]">
        <Items enrollments={enrollments} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CourseSwitcherMobile({ enrollments }: { enrollments: Enrollment[] }) {
  const user = useAuth((s) => s.user);
  const enrollmentId = useApp((s) => s.enrollmentId);
  const isAdmin = user?.role === "ADMIN";
  const current = enrollments.find((e) => e.id === enrollmentId);
  const title = isAdmin ? "Administração" : current ? shortCourse(current.course.name) : "Painel";
  const initials = isAdmin ? "AD" : current ? courseInitials(current.course.name) : "PA";

  const trigger = (
    <button className="flex min-w-0 items-center gap-x-1.5 rounded-md p-2 hover:bg-gray-100 focus:outline-hidden dark:hover:bg-gray-900"
      aria-label={isAdmin ? "Área de administração" : "Trocar de curso"}>
      <Tile text={initials} className="size-7" />
      <RiArrowRightSLine className="size-4 shrink-0 text-gray-500" aria-hidden="true" />
      <div className="flex w-full min-w-0 items-center justify-between gap-x-3 truncate">
        <p className="truncate text-sm font-medium whitespace-nowrap text-gray-900 dark:text-gray-50">{title}</p>
        {!isAdmin && <RiExpandUpDownLine className="size-4 shrink-0 text-gray-500" aria-hidden="true" />}
      </div>
    </button>
  );
  if (isAdmin) return <div className="pointer-events-none min-w-0">{trigger}</div>;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent className="!min-w-72">
        <Items enrollments={enrollments} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
