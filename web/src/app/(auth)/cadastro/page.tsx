"use client";

// RF-17 — auto-cadastro. Pode estar desligado por instância (ALLOW_REGISTRATION):
// o backend responde 403 e a tela explica o caminho do convite.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/api/endpoints";
import { ApiError, setAccessToken } from "@/lib/api/client";
import { markSession } from "@/lib/api/session-hint";
import { useAuth } from "@/lib/auth-store";
import Button from "@/components/ui/button";
import { Field, inputCls } from "@/components/ui";

export default function CadastroPage() {
  const router = useRouter();
  const { setUser, status } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (status === "in") router.replace("/painel"); }, [status, router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (form.password.length < 10) { setErr("A senha precisa ter ao menos 10 caracteres."); return; }
    if (form.password !== form.confirm) { setErr("As senhas não coincidem."); return; }

    setBusy(true);
    try {
      const { accessToken, user } = await auth.register(form.name.trim(), form.email.trim(), form.password);
      setAccessToken(accessToken);
      markSession();
      setUser(user);
      router.replace("/painel"); // sem matrícula ainda: a casca oferece a escolha de curso
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setErr(
        status === 409 ? "Este e-mail já tem conta — use Entrar ou recupere a senha."
        : status === 403 ? "O cadastro público está desabilitado nesta instância. Peça um convite a um administrador."
        : "Não foi possível concluir o cadastro. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-3xl">Criar conta</h1>
      <p className="text-muted-foreground mt-2 text-sm">Depois você escolhe o curso a acompanhar.</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Nome">
          <input required autoComplete="name" value={form.name} onChange={set("name")} className={inputCls} placeholder="Seu nome" />
        </Field>
        <Field label="E-mail">
          <input type="email" required autoComplete="email" value={form.email} onChange={set("email")}
            className={inputCls} placeholder="voce@discente.ufg.br" />
        </Field>
        <Field label="Senha (mínimo 10 caracteres)">
          <input type="password" required autoComplete="new-password" minLength={10} value={form.password}
            onChange={set("password")} className={inputCls} placeholder="••••••••••" />
        </Field>
        <Field label="Confirmar senha">
          <input type="password" required autoComplete="new-password" value={form.confirm}
            onChange={set("confirm")} className={inputCls} placeholder="••••••••••" />
        </Field>

        {err && <p className="text-lock text-sm" role="alert">{err}</p>}

        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</Button>
      </form>

      <p className="text-muted-foreground mt-8 text-sm">
        Já tem conta? <Link href="/entrar" className="text-primary font-medium hover:underline">Entrar</Link>
      </p>
    </>
  );
}
