// Login (POST /auth/login) + "esqueci a senha" (POST /auth/password/forgot).
import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { auth } from "../api/endpoints";
import { setAccessToken } from "../api/client";
import { useAuth, applyTheme } from "../store/auth";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

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

  return (
    <div className="authwrap">
      <Card className="authcard">
        <div className="brand mt" style={{ marginBottom: 18 }}><span className="dot" />Painel Acadêmico</div>
        <h1>Entrar</h1>
        <p className="mut">Acompanhe sua integralização, simulações e cronograma.</p>
        <form onSubmit={submit} className="stack mt">
          <label className="field">E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label className="field">Senha
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {err && <div className="err">{err}</div>}
          {msg && <div className="ok">{msg}</div>}
          <Button type="submit" variant="prim" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
          <button type="button" className="btn ghost sm" onClick={forgot}>Esqueci minha senha</button>
        </form>
      </Card>
    </div>
  );
}
