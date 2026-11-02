"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { auth } from "@/lib/api/endpoints";
import { setAccessToken } from "@/lib/api/client";
import { markSession } from "@/lib/api/session-hint";
import { useAuth } from "@/lib/auth-store";
import Button from "@/components/ui/button";
import { Field, inputCls } from "@/components/ui";
import { APP_NAME } from "@/lib/branding";

export default function EntrarPage() {
  const router = useRouter();
  const { setUser, status, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // quem já tem sessão não vê a tela de login
  useEffect(() => {
    if (status === "in") router.replace(user?.role === "ADMIN" ? "/admin" : "/painel");
  }, [status, user?.role, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { accessToken, user: u } = await auth.login(email.trim(), password);
      setAccessToken(accessToken);
      markSession();
      setUser(u);
      router.replace(u.role === "ADMIN" ? "/admin" : "/painel");
    } catch {
      // mensagem uniforme: não revela se o e-mail existe
      setErr("E-mail ou senha inválidos.");
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) { setErr("Informe o e-mail para receber o link."); return; }
    try {
      await auth.forgot(email.trim());
      toast.success("Se houver conta com esse e-mail, o link de redefinição foi enviado.");
    } catch {
      toast.error("Não foi possível enviar agora. Tente de novo em instantes.");
    }
  }

  return (
    <>
      <h1 className="mt-4 text-center text-xl font-semibold">Entrar</h1>
      <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">Acesse o {APP_NAME} com a sua conta.</p>

      <form onSubmit={submit} className="mt-10 flex flex-col gap-4">
        <Field label="E-mail">
          <input type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="voce@discente.ufg.br" />
        </Field>
        <Field label="Senha">
          <input type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
        </Field>

        {/* ação secundária como link: um botão do mesmo tamanho competia com o "Entrar" */}
        <button type="button" onClick={forgot}
          className="-mt-2 cursor-pointer self-end text-xs text-gray-500 underline-offset-4 hover:text-orange-700 hover:underline dark:text-gray-400 dark:hover:text-orange-400">
          Esqueci minha senha
        </button>

        {err && <p className="text-sm text-red-700 dark:text-red-400" role="alert">{err}</p>}

        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Não tem conta? <Link href="/cadastro" className="font-medium text-orange-700 hover:underline dark:text-orange-400">Criar conta</Link>
      </p>
    </>
  );
}
