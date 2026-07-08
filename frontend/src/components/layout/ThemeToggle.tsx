// Alterna html[data-theme] e persiste via PATCH /me/settings (RF-15).
import { useAuth, applyTheme } from "../../store/auth";
import { me } from "../../api/endpoints";
import Button from "../ui/Button";

export default function ThemeToggle() {
  const user = useAuth((s) => s.user);
  const patchUser = useAuth((s) => s.patchUser);
  const theme = user?.theme ?? "dark";

  async function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    patchUser({ theme: next });
    try { await me.updateSettings({ theme: next }); } catch { /* persiste na próxima */ }
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} title="Alternar tema" aria-label="Alternar tema">
      {theme === "dark" ? "☀️" : "🌙"}
    </Button>
  );
}
