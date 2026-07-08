// Ajustes: perfil, tema (RF-15) e backup export/import (RF-16).
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { me } from "../api/endpoints";
import { useAuth, applyTheme } from "../store/auth";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

export default function SettingsPage() {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const patchUser = useAuth((s) => s.patchUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function setTheme(theme: "dark" | "light") {
    applyTheme(theme); patchUser({ theme });
    try { await me.updateSettings({ theme }); } catch { /* silencioso */ }
  }

  async function doExport() {
    setErr(""); setMsg("");
    try {
      const data = await me.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `painel-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      setMsg("Backup exportado.");
    } catch { setErr("Falha ao exportar."); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(""); setMsg("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const res = await me.importBackup(data);
      qc.invalidateQueries();
      setMsg(`Backup importado: ${res.restored} curso(s) restaurado(s)` +
        (res.skippedCourses.length ? `; ignorados: ${res.skippedCourses.join(", ")}` : "") + ".");
    } catch { setErr("Arquivo inválido ou falha ao importar."); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="stack">
      <h1>Ajustes</h1>

      <Card>
        <h3>Conta</h3>
        <p className="mut">{user?.name} · {user?.email} · perfil <span className="badge">{user?.role}</span></p>
      </Card>

      <Card>
        <h3>Tema</h3>
        <div className="row" style={{ gap: 8 }}>
          <Button variant={user?.theme === "dark" ? "prim" : "default"} onClick={() => setTheme("dark")}>🌙 Escuro</Button>
          <Button variant={user?.theme === "light" ? "prim" : "default"} onClick={() => setTheme("light")}>☀️ Claro</Button>
        </div>
      </Card>

      <Card>
        <h3>Backup</h3>
        <p className="mut">Exporte todos os seus dados (status, extras, cenários, tema) em JSON, ou reimporte para reconstruir o estado.</p>
        <div className="row" style={{ gap: 8 }}>
          <Button onClick={doExport}>Exportar JSON</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>Importar JSON</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
        </div>
        {msg && <div className="ok mt">{msg}</div>}
        {err && <div className="err mt">{err}</div>}
      </Card>
    </div>
  );
}
