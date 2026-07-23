"use client";

// Convite / redefinição de senha: o usuário define a própria senha (POST /auth/invite/accept).
// A rota é dinâmica porque o token vai na URL enviada por e-mail (RF-02/18).
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/api/endpoints";
import Button from "@/components/ui/button";
import { Field, inputCls } from "@/components/ui";
import { IconCheck } from "@/components/ui/icons";

export default function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params); // no Next 15 os params de rota são uma promise
  const router = useRouter();
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
      setTimeout(() => router.replace("/entrar"), 1800);
    } catch {
      setErr("Convite inválido ou expirado. Peça um novo link ao administrador.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <span className="bg-savanna/15 text-savanna mx-auto grid size-12 place-items-center rounded-full">
          <IconCheck />
        </span>
        <h1 className="mt-5 text-2xl">Senha definida</h1>
        <p className="text-muted-foreground mt-2 text-sm">Levando você para a tela de entrada…</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl">Definir senha</h1>
      <p className="text-muted-foreground mt-2 text-sm">Escolha a senha da sua conta para concluir o convite.</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Nova senha (mínimo 10 caracteres)">
          <input type="password" required minLength={10} autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••••" />
        </Field>
        <Field label="Confirmar senha">
          <input type="password" required autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} className={inputCls} placeholder="••••••••••" />
        </Field>

        {err && <p className="text-lock text-sm" role="alert">{err}</p>}

        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Salvando…" : "Definir senha"}</Button>
      </form>

      <p className="text-muted-foreground mt-8 text-sm">
        <Link href="/entrar" className="text-primary font-medium hover:underline">Voltar para a entrada</Link>
      </p>
    </>
  );
}
