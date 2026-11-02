"use client";

// Perfil no rodapé da sidebar — UserProfile + DropdownUserProfile do tremorlabs/template-
// dashboard (MIT). O submenu de tema (Claro / Escuro / Sistema) agora PERSISTE na conta
// (RF-15), então a escolha acompanha a pessoa entre dispositivos.
import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  RiArrowRightUpLine, RiComputerLine, RiMoonLine, RiMore2Fill, RiSunLine,
} from "@remixicon/react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSubMenu,
  DropdownMenuSubMenuContent, DropdownMenuSubMenuTrigger, DropdownMenuTrigger,
} from "@/components/tremor/Dropdown";
import { Button } from "@/components/tremor/Button";
import { me } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth-store";
import { reportError } from "@/lib/monitoring";
import { cx, focusRing, initials } from "@/lib/utils";
import type { Theme } from "@/lib/api/types";

const REPO = "https://github.com/higorfs295/Painel_UFG";

function DropdownUserProfile({ children, align = "start", onLogout }: {
  children: React.ReactNode; align?: "center" | "start" | "end"; onLogout: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const user = useAuth((s) => s.user);
  const patchUser = useAuth((s) => s.patchUser);
  React.useEffect(() => setMounted(true), []);

  function pick(value: string) {
    const t = value as Theme;
    setTheme(t);
    patchUser({ theme: t });
    me.updateSettings({ theme: t }).catch(reportError); // se falhar, vale ao menos nesta sessão
  }

  if (!mounted) return <>{children}</>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuSubMenu>
            <DropdownMenuSubMenuTrigger>Tema</DropdownMenuSubMenuTrigger>
            <DropdownMenuSubMenuContent>
              <DropdownMenuRadioGroup value={theme} onValueChange={pick}>
                <DropdownMenuRadioItem aria-label="Usar o tema claro" value="light" iconType="check">
                  <RiSunLine className="size-4 shrink-0" aria-hidden="true" /> Claro
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem aria-label="Usar o tema escuro" value="dark" iconType="check">
                  <RiMoonLine className="size-4 shrink-0" aria-hidden="true" /> Escuro
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem aria-label="Seguir o tema do sistema" value="system" iconType="check">
                  <RiComputerLine className="size-4 shrink-0" aria-hidden="true" /> Sistema
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubMenuContent>
          </DropdownMenuSubMenu>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild><Link href="/config">Ajustes</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/ajuda">Ajuda</Link></DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={REPO} target="_blank" rel="noopener noreferrer">
              Código-fonte
              <RiArrowRightUpLine className="mb-1 ml-1 size-2.5 shrink-0 text-gray-500" aria-hidden="true" />
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onLogout}>Sair</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserProfileDesktop({ onLogout }: { onLogout: () => void }) {
  const user = useAuth((s) => s.user);
  return (
    <DropdownUserProfile onLogout={onLogout}>
      <Button aria-label="Menu da conta" variant="ghost"
        className={cx(focusRing,
          "group flex w-full items-center justify-between rounded-md p-2 text-sm font-medium text-gray-900 hover:bg-gray-100 data-[state=open]:bg-gray-100 dark:hover:bg-gray-400/10 dark:data-[state=open]:bg-gray-400/10")}>
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            {initials(user?.name)}
          </span>
          <span className="truncate">{user?.name}</span>
        </span>
        <RiMore2Fill className="size-4 shrink-0 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-400" aria-hidden="true" />
      </Button>
    </DropdownUserProfile>
  );
}

export function UserProfileMobile({ onLogout }: { onLogout: () => void }) {
  const user = useAuth((s) => s.user);
  return (
    <DropdownUserProfile align="end" onLogout={onLogout}>
      <Button aria-label="Menu da conta" variant="ghost"
        className="group flex items-center rounded-md p-1 text-sm font-medium text-gray-900 hover:bg-gray-100 data-[state=open]:bg-gray-100 dark:hover:bg-gray-400/10 dark:data-[state=open]:bg-gray-400/10">
        <span aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          {initials(user?.name)}
        </span>
      </Button>
    </DropdownUserProfile>
  );
}
