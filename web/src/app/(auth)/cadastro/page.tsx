"use client";

// RF-17 — auto-cadastro. Pode estar desligado por instância (ALLOW_REGISTRATION):
// o backend responde 403 e a tela explica o caminho do convite.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, instance } from "@/lib/api/endpoints";
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
  // v12: o admin abre/fecha o cadastro e restringe domínios em runtime (Configurações)
  const { data: settings } = useQuery({ queryKey: ["public-settings"], queryFn: instance.publicSettings, staleTime: 60_000 });
  const domains = settings?.registrationDomains ?? [];
  const domainOk = (email: string) => {
    if (!domains.length) return true;
    const d = email.split("@").pop()?.toLowerCase() ?? "";
    return domains.some((x) => d === x || d.endsWith(`.${x}`));
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (form.password.length < 10) { setErr("A senha precisa ter ao menos 10 caracteres."); return; }
    if (form.password !== form.confirm) { setErr("As senhas não coincidem."); return; }
    if (!domainOk(form.email.trim())) { setErr(`Use um e-mail de: ${domains.map((d) => `@${d}`).join(", ")}.`); return; }

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
        : status === 403 ? (domains.length && !domainOk(form.email.trim())
          ? `Esta instância só aceita e-mails de: ${domains.map((d) => `@${d}`).join(", ")}.`
          : "O cadastro público está desabilitado nesta instância. Peça um convite a um administrador.")
        : "Não foi possível concluir o cadastro. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="mt-4 text-center text-xl font-semibold">Criar conta</h1>
      <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">Depois você escolhe o curso a acompanhar.</p>

      {settings && !settings.registrationOpen ? (
        <div role="status" className="mt-10 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-medium">O cadastro está fechado nesta instância.</p>
          <p className="mt-1">As contas são criadas por convite. Peça o seu a um administrador — o link chega por e-mail ou é repassado por ele.</p>
        </div>
      ) : (
      <form onSubmit={submit} className="mt-10 flex flex-col gap-4">
        <Field label="Nome">
          <input required autoComplete="name" value={form.name} onChange={set("name")} className={inputCls} placeholder="Seu nome" />
        </Field>
        <Field label="E-mail">
          <input type="email" required autoComplete="email" value={form.email} onChange={set("email")}
            className={inputCls} placeholder={domains[0] ? `voce@${domains[0]}` : "voce@discente.ufg.br"} />
          {domains.length > 0 && (
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">Aceitos: {domains.map((d) => `@${d}`).join(", ")}</span>
          )}
        </Field>
        <Field label="Senha (mínimo 10 caracteres)">
          <input type="password" required autoComplete="new-password" minLength={10} value={form.password}
            onChange={set("password")} className={inputCls} placeholder="••••••••••" />
        </Field>
        <Field label="Confirmar senha">
          <input type="password" required autoComplete="new-password" value={form.confirm}
            onChange={set("confirm")} className={inputCls} placeholder="••••••••••" />
        </Field>

        {err && <p className="text-sm text-red-700 dark:text-red-400" role="alert">{err}</p>}

        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</Button>
      </form>
      )}

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Já tem conta? <Link href="/entrar" className="font-medium text-orange-700 hover:underline dark:text-orange-400">Entrar</Link>
      </p>
    </>
  );
}
