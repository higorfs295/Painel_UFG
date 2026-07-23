import { AppShell } from "@/components/layout/app-shell";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return <AppShell area="student">{children}</AppShell>;
}
