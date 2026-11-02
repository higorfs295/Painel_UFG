// Ícones das páginas: os mesmos nomes das versões anteriores, agora apontando para o
// Remix Icon (o conjunto usado pelos templates da Tremor). Tamanho padrão 18 px, sempre
// decorativos (aria-hidden) — o texto ao lado é quem dá o nome.
import type { SVGProps } from "react";
import {
  RiAlarmWarningLine, RiArrowDownSLine, RiArrowRightSLine, RiArrowRightUpLine, RiBarChart2Line,
  RiBookOpenLine, RiCalendarCheckLine, RiCalendarLine, RiCheckboxCircleLine, RiCloseLine,
  RiCommandLine, RiComputerLine, RiDownload2Line, RiFileTextLine, RiFireLine, RiFocus3Line,
  RiGitMergeLine, RiInformationLine, RiListCheck2, RiLockLine, RiLogoutBoxRLine, RiMailLine,
  RiMegaphoneLine, RiMenuLine, RiMoonLine, RiNotification3Line, RiPaletteLine, RiPulseLine,
  RiRestartLine, RiSearchLine, RiSendPlaneLine, RiServerLine, RiSettings5Line, RiShieldCheckLine,
  RiSidebarFoldLine, RiSeedlingLine, RiSparkling2Line, RiSunLine, RiTableLine, RiTeamLine,
  RiTimeLine, RiDeleteBinLine, RiStickyNoteLine,
  type RemixiconComponentType,
} from "@remixicon/react";

type P = SVGProps<SVGSVGElement>;
const w = (C: RemixiconComponentType) =>
  function Icon(props: P) {
    // Remix aceita as props de SVG; o tamanho padrão anterior era 18
    return <C size={18} aria-hidden="true" {...(props as object)} />;
  };

export const IconSun = w(RiSunLine);
export const IconBook = w(RiBookOpenLine);
export const IconSprout = w(RiSeedlingLine);
export const IconGrid = w(RiTableLine);
export const IconSliders = w(RiSettings5Line);
export const IconShield = w(RiShieldCheckLine);
export const IconOut = w(RiLogoutBoxRLine);
export const IconClock = w(RiTimeLine);
export const IconFlame = w(RiFireLine);
export const IconTarget = w(RiFocus3Line);
export const IconCheck = w(RiCheckboxCircleLine);
export const IconUsers = w(RiTeamLine);
export const IconCal = w(RiCalendarCheckLine);
export const IconMenu = w(RiMenuLine);
export const IconX = w(RiCloseLine);
export const IconStar = w(RiSparkling2Line);
export const IconMail = w(RiMailLine);
export const IconServer = w(RiServerLine);
export const IconInfo = w(RiInformationLine);
export const IconSearch = w(RiSearchLine);
export const IconSend = w(RiSendPlaneLine);
export const IconChart = w(RiBarChart2Line);
export const IconCheckList = w(RiListCheck2);
export const IconPulse = w(RiPulseLine);
export const IconMegaphone = w(RiMegaphoneLine);
export const IconTrash = w(RiDeleteBinLine);
export const IconRestore = w(RiRestartLine);
export const IconDownload = w(RiDownload2Line);
export const IconCommand = w(RiCommandLine);
export const IconMoon = w(RiMoonLine);
export const IconBell = w(RiNotification3Line);
export const IconChevronRight = w(RiArrowRightSLine);
export const IconChevronDown = w(RiArrowDownSLine);
export const IconSidebar = w(RiSidebarFoldLine);
export const IconGraph = w(RiGitMergeLine);
export const IconNote = w(RiStickyNoteLine);
export const IconPalette = w(RiPaletteLine);
export const IconDevice = w(RiComputerLine);
export const IconArrowUpRight = w(RiArrowRightUpLine);
export const IconLock = w(RiLockLine);
export const IconFile = w(RiFileTextLine);
export const IconCalendar = w(RiCalendarLine);
export const IconAlert = w(RiAlarmWarningLine);
