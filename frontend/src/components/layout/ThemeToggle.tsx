// Alterna html[data-theme] e persiste via PATCH /me/settings (RF-15).
// Ícone em vez de emoji: emoji herda a fonte do sistema e desalinha entre plataformas.
import { useAuth, applyTheme } from "../../store/auth";
import { me } from "../../api/endpoints";
import { IconSun, IconMoon } from "../ui/Icons";

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
    <button onClick={toggle} title="Alternar tema" aria-label="Alternar tema"
      className="icon-btn border-input rounded-lg border">
      {theme === "dark" ? <IconSun /> : <IconMoon />}
    </button>
  );
}
