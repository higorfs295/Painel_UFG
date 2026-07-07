// Convite/redefinição: o usuário define a própria senha (POST /auth/invite/accept).
import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { auth } from "../api/endpoints";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

export default function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 10) { setErr("A senha precisa ter ao menos 10 caracteres."); return; }
    if (password !== confirm) { setErr("As senhas não coincidem."); return; }
    setBusy(true);
    try {
      await auth.acceptInvite(token, password);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 1800);
    } catch {
      setErr("Convite inválido ou expirado. Peça um novo link ao administrador.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authwrap">
      <Card className="authcard">
        <div className="brand" style={{ marginBottom: 18 }}><span className="dot" />Painel Acadêmico</div>
        <h1>Definir senha</h1>
        {done ? (
          <p className="ok">Senha definida! Redirecionando para o login… <Link to="/login">Entrar agora</Link></p>
        ) : (
          <>
            <p className="mut">Crie a senha da sua conta para acessar o painel.</p>
            <form onSubmit={submit} className="stack mt">
              <label className="field">Nova senha (mín. 10 caracteres)
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
              </label>
              <label className="field">Confirmar senha
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </label>
              {err && <div className="err">{err}</div>}
              <Button type="submit" variant="prim" disabled={busy}>{busy ? "Salvando…" : "Definir senha"}</Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
