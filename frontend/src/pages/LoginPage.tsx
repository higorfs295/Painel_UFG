// Login em tela dividida: hero editorial à esquerda (sol do cerrado), formulário de vidro à direita.
import { useState } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import { auth } from "../api/endpoints";
import { setAccessToken } from "../api/client";
import { useAuth, applyTheme } from "../store/auth";
import { APP_NAME, APP_TAGLINE } from "../branding";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { IconTarget, IconGrid, IconSprout } from "../components/ui/Icons";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { status, setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed") return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      const { accessToken, user } = await auth.login(email, password);
      setAccessToken(accessToken);
      setSession(user);
      applyTheme(user.theme);
      navigate(location.state?.from ?? "/", { replace: true });
    } catch {
      setErr("E-mail ou senha inválidos.");
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setErr(""); setMsg("");
    if (!email) { setErr("Informe o e-mail para recuperar a senha."); return; }
    try {
      await auth.forgot(email);
      setMsg("Se o e-mail existir, um link de redefinição foi gerado (na v1, veja o log do servidor).");
    } catch { setErr("Não foi possível processar agora."); }
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
        <h1 className="auth-headline">Cada aula, um passo rumo ao <em>horizonte</em>.</h1>
        <p className="auth-sub">{APP_TAGLINE}</p>
        <div className="auth-points">
          <span className="auth-point"><IconTarget /> Recomendações pelo que mais destrava a sua matriz</span>
          <span className="auth-point"><IconGrid /> Cenários de grade com códigos do SIGAA</span>
          <span className="auth-point"><IconSprout /> Optativas, Núcleo Livre e horas complementares no lugar</span>
        </div>
      </section>

      <section className="auth-pane">
        <Card className="authcard">
          <h1>Entrar</h1>
          <form onSubmit={submit} className="stack mt">
            <label className="field">E-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label className="field">Senha
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {err && <div className="err" role="alert">{err}</div>}
            {msg && <div className="ok">{msg}</div>}
            <Button type="submit" variant="prim" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
            <button type="button" className="btn ghost sm" onClick={forgot}>Esqueci minha senha</button>
            <p className="mut center" style={{ margin: 0 }}>
              Não tem conta? <Link to="/cadastro">Criar conta</Link>
            </p>
          </form>
        </Card>
      </section>
    </div>
  );
}
