"use client";

// Lista de links da navegação — o miolo da Sidebar/MobileSidebar do tremorlabs/template-
// dashboard (MIT): item ativo em texto de acento, hover em gray-100, grupos com rótulo
// pequeno (o "Shortcuts" do template).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-store";
import { useAnnouncements } from "@/hooks/use-announcements";
import { DrawerClose } from "@/components/tremor/Drawer";
import { cx, focusRing } from "@/lib/utils";
import { isActive, navFor, type NavItem } from "./nav-data";

function Item({ item, mobile, unread }: { item: NavItem; mobile?: boolean; unread: number }) {
  const pathname = usePathname();
  const active = isActive(pathname, item);

  const link = (
    <Link href={item.href} aria-current={active ? "page" : undefined}
      className={cx(
        active
          ? "text-brand-700 dark:text-brand-400"
          : "text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
        "flex items-center gap-x-2.5 rounded-md px-2 py-1.5 font-medium transition hover:bg-gray-100 dark:hover:bg-gray-900",
        mobile ? "text-base sm:text-sm" : "text-sm",
        focusRing,
      )}>
      <item.icon className={cx("shrink-0", mobile ? "size-5" : "size-4")} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
      {item.badge && unread > 0 && (
        <span className="ml-auto rounded-sm bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-800 tabular-nums ring-1 ring-brand-500/30 dark:bg-brand-400/10 dark:text-brand-400 dark:ring-brand-400/30"
          aria-label={`${unread} não lido${unread > 1 ? "s" : ""}`}>
          {unread}
        </span>
      )}
    </Link>
  );
  return <li>{mobile ? <DrawerClose asChild>{link}</DrawerClose> : link}</li>;
}

export function NavLinks({ mobile }: { mobile?: boolean }) {
  const role = useAuth((s) => s.user?.role);
  const pathname = usePathname();
  // o badge conta só o que não foi visto; o admin só tem feed quando está na área de aluno
  const { unread } = useAnnouncements(role !== "ADMIN" || pathname.startsWith("/painel"));
  return (
    <nav aria-label="Navegação principal" className="flex flex-1 flex-col space-y-7">
      {navFor(role, pathname).map((section) => (
        <div key={section.label || "principal"}>
          {section.label && (
            <span className={cx("font-medium leading-6 text-gray-500 dark:text-gray-400", mobile ? "text-sm sm:text-xs" : "text-xs")}>
              {section.label}
            </span>
          )}
          <ul role="list" aria-label={section.label || undefined} className={mobile ? "space-y-1.5" : "space-y-0.5"}>
            {section.items.map((item) => <Item key={item.href} item={item} mobile={mobile} unread={unread} />)}
          </ul>
        </div>
      ))}
    </nav>
  );
}
