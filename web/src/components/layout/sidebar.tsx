"use client";

// Sidebar do app — Sidebar do tremorlabs/template-dashboard (MIT): no desktop, coluna
// fixa de 18rem, branca com borda; abaixo de `lg`, vira uma barra superior com o seletor
// de curso, o perfil e o botão da gaveta.
import { RiSearchLine } from "@remixicon/react";
import { cx, focusInput } from "@/lib/utils";
import { CourseSwitcherDesktop, CourseSwitcherMobile } from "./course-switcher";
import { UserProfileDesktop, UserProfileMobile } from "./user-profile";
import { MobileSidebar } from "./mobile-sidebar";
import { NavLinks } from "./nav-links";
import { openPalette } from "./command-palette";
import type { Enrollment } from "@/lib/api/types";

export function Sidebar({ enrollments, onLogout }: { enrollments: Enrollment[]; onLogout: () => void }) {
  return (
    <>
      {/* sidebar (lg+) */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <aside aria-label="Barra lateral"
          className="flex grow flex-col gap-y-6 overflow-y-auto border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <CourseSwitcherDesktop enrollments={enrollments} />
          <button type="button" onClick={openPalette} aria-label="Buscar páginas e comandos (Ctrl+K)"
            className={cx(
              "-mt-2 flex w-full items-center gap-2 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-500 shadow-xs transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-900",
              focusInput,
            )}>
            <RiSearchLine className="size-4 shrink-0" aria-hidden="true" />
            Buscar
            <kbd className="ml-auto rounded-sm border border-gray-200 px-1 font-sans text-[0.65rem] text-gray-500 dark:border-gray-800 dark:text-gray-400">Ctrl K</kbd>
          </button>
          <NavLinks />
          <div className="mt-auto">
            <UserProfileDesktop onLogout={onLogout} />
          </div>
        </aside>
      </div>

      {/* barra superior (xs–lg) */}
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-x-2 border-b border-gray-200 bg-white px-2 shadow-xs sm:gap-x-6 sm:px-4 lg:hidden dark:border-gray-800 dark:bg-gray-950">
        <CourseSwitcherMobile enrollments={enrollments} />
        <div className="flex items-center gap-1 sm:gap-2">
          <UserProfileMobile onLogout={onLogout} />
          <MobileSidebar />
        </div>
      </div>
    </>
  );
}
