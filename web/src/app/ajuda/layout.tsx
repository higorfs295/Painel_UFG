import { AppShell } from "@/components/layout/app-shell";

export default function AjudaLayout({ children }: { children: React.ReactNode }) {
  return <AppShell area="any">{children}</AppShell>;
}
