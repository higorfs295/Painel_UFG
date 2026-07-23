import { AppShell } from "@/components/layout/app-shell";

// Ajustes serve aluno e admin — daí `any` (sem redirecionamento por papel).
export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  return <AppShell area="any">{children}</AppShell>;
}
