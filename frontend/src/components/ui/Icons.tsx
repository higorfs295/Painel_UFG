// Ícones de traço fino (24px, stroke 1.8, cantos redondos) — desenhados à mão para o tema:
// sol do cerrado, livro, broto, grade, ajustes, escudo, saída, relógio, chama e alvo.
import type { SVGProps } from "react";

function I({ children, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {children}
    </svg>
  );
}

export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" /></I>
);
export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z" /><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" /><path d="M9 7.5h7M9 11h5" /></I>
);
export const IconSprout = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M12 21v-8" /><path d="M12 13c0-3.5 2.6-6 6.5-6 0 3.6-2.7 6-6.5 6Z" /><path d="M12 10C12 7 9.8 5 6.5 5 6.5 8 8.7 10 12 10Z" /><path d="M7 21h10" /></I>
);
export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8.8 9.5V20.5M14.2 9.5V20.5M3.5 15h17" /></I>
);
export const IconSliders = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M4 7h9M17.5 7H20M4 12h3M11.5 12H20M4 17h13M20 17h0" /><circle cx="15" cy="7" r="2.2" /><circle cx="9" cy="12" r="2.2" /><circle cx="18.5" cy="17" r="2.2" /></I>
);
export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M12 3 5 5.8v5.4c0 4.5 3 7.9 7 9.8 4-1.9 7-5.3 7-9.8V5.8Z" /><path d="m9.2 12 2 2 3.6-4" /></I>
);
export const IconOut = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M4 12h11M11 8l4 4-4 4" /></I>
);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.4" /></I>
);
export const IconFlame = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M12 21c3.9 0 6.5-2.4 6.5-6 0-3.3-2.4-5.4-4-8-.6 1.4-1 2.5-2.5 3.6C10.3 8.3 10 5.8 10.6 3 7.5 5.3 5.5 9 5.5 12.5c0 5 2.9 8.5 6.5 8.5Z" /><path d="M12 21c-1.8 0-3-1.4-3-3.2 0-1.6 1.2-2.7 3-4.3 1.8 1.6 3 2.7 3 4.3 0 1.8-1.2 3.2-3 3.2Z" /></I>
);
export const IconTarget = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.8" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /></I>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="m8.2 12.2 2.6 2.6 5-5.6" /></I>
);
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M15.5 5.8a3.2 3.2 0 0 1 0 5.4M17.8 14.9c1.6.8 2.5 2.4 2.8 4.6" /></I>
);
export const IconCal = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 2.8V6.5M16 2.8V6.5" /><path d="m9.5 15 2 2 3.5-4" /></I>
);
export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M4 7h16M4 12h16M4 17h10" /></I>
);
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="m6 6 12 12M18 6 6 18" /></I>
);
export const IconStar = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="m12 3.2 2.5 5.2 5.7.8-4.1 4 1 5.7L12 21l-5.1 2.7 1-5.7-4.1-4 5.7-.8Z" /></I>
);
export const IconMail = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><rect x="3.2" y="5" width="17.6" height="14" rx="2.6" /><path d="m4 7 8 5.6L20 7" /></I>
);
export const IconServer = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><rect x="3.5" y="4" width="17" height="7" rx="2" /><rect x="3.5" y="13" width="17" height="7" rx="2" /><path d="M7 7.5h0M7 16.5h0" /></I>
);
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5M12 7.6h0" /></I>
);
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><circle cx="10.5" cy="10.5" r="6.3" /><path d="m15.4 15.4 4 4" /></I>
);
export const IconSend = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M21 4 3 11l6.5 2.5L12 20l3-6L21 4Z" /><path d="m9.5 13.5 3-3" /></I>
);
export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M4 20V5" /><path d="M4 20h16" /><path d="M8 20v-5.5M12.5 20V9M17 20v-8" /></I>
);
export const IconCheckList = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="m3.6 6.6 1.6 1.6 3-3.2M3.6 13.4 5.2 15l3-3.2M3.6 20.2l1.6 1.6 3-3.2" /><path d="M12 6.5h8.5M12 13.4h8.5M12 20.2h8.5" /></I>
);
export const IconPulse = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M2.5 12.5h4l2-6 3.5 12 2.5-7.5 1.8 3.5h5.2" /></I>
);
export const IconMegaphone = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M4 10.5v3a2 2 0 0 0 2 2h1.5L18 20V4L7.5 8.5H6a2 2 0 0 0-2 2Z" /><path d="M20.5 10v4M7.5 15.5V20" /></I>
);
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M4 6.5h16M9.5 6.5V4.5h5v2" /><path d="M6 6.5 7 20a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20l1-13.5" /><path d="M10 10.5v7M14 10.5v7" /></I>
);
export const IconRestore = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3 4v5h5" /></I>
);
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M12 3.5v11" /><path d="M8 11l4 4 4-4" /><path d="M4 17.5v1.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" /></I>
);
export const IconCommand = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M7.5 4.5a2.5 2.5 0 1 0 2.5 2.5v10a2.5 2.5 0 1 0 2.5-2.5H7a2.5 2.5 0 1 0 2.5 2.5" /><path d="M14.5 9.5h2A2.5 2.5 0 1 0 14 7v10a2.5 2.5 0 1 0 2.5-2.5h-2" /></I>
);
export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.8 8.8 0 1 0 11.3 11.3Z" /></I>
);
export const IconFilter = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}><path d="M3.5 5.5h17l-6.6 7.7V20l-3.8-2.2v-4.6z" /></I>
);
