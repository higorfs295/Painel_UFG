// RF-17 — cadastro em tela dividida (hero editorial + formulário de vidro).
import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { auth } from "../api/endpoints";
import { setAccessToken } from "../api/client";
import { useAuth, applyTheme } from "../store/auth";
import { APP_NAME, APP_TAGLINE } from "../branding";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { IconSun, IconBook, IconClock } from "../components/ui/Icons";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { status, setSession } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed") return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (form.password.length < 10) { setErr("A senha precisa ter ao menos 10 caracteres."); return; }
    if (form.password !== form.confirm) { setErr("As senhas não coincidem."); return; }
    setBusy(true);
    try {
      const { accessToken, user } = await auth.register(form.name, form.email, form.password);
      setAccessToken(accessToken);
      setSession(user);
      applyTheme(user.theme);
      navigate("/", { replace: true }); // sem matrícula ainda: o layout oferece a escolha de curso
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setErr(msg.includes("409") || msg.includes("cadastrado")
        ? "Este e-mail já tem conta — use Entrar ou recupere a senha."
        : msg.includes("403") || msg.includes("desabilitado")
          ? "O cadastro público está desabilitado nesta instância. Peça um convite a um administrador."
          : "Não foi possível concluir o cadastro. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  // brilho que segue o cursor no hero (Quantix)
  function heroGlow(e: React.MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <div className="auth-split">
      <section className="auth-hero" aria-hidden="true" onMouseMove={heroGlow}>
        <span className="auth-glow" />
        <div className="auth-brand"><span className="dot" />{APP_NAME}</div>
        <h1 className="auth-headline">Comece hoje a enxergar o seu <em>caminho</em>.</h1>
        <p className="auth-sub">{APP_TAGLINE}</p>
        <div className="auth-points">
          <span className="auth-point"><IconSun /> Visão geral com marcos e progresso real</span>
          <span className="auth-point"><IconBook /> Aprovadas, cursando e simuladas — lado a lado</span>
          <span className="auth-point"><IconClock /> Grade semanal navegável até por teclado</span>
        </div>
      </section>

      <section className="auth-pane">
        <Card className="authcard">
          <h1>Criar conta</h1>
          <form onSubmit={submit} className="stack mt">
            <label className="field">Nome
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} autoFocus />
            </label>
            <label className="field">E-mail
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label className="field">Senha (mín. 10 caracteres)
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </label>
            <label className="field">Confirmar senha
              <input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
            </label>
            {err && <div className="err" role="alert">{err}</div>}
            <Button type="submit" variant="prim" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</Button>
            <p className="mut center" style={{ margin: 0 }}>Já tem conta? <Link to="/login">Entrar</Link></p>
          </form>
        </Card>
      </section>
    </div>
  );
}
