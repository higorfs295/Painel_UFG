"use client";

// Fronteira de erro do App Router. Reporta ao monitoramento (padrão do rollbar-vercel,
// aqui opcional) e oferece o caminho de volta em vez de uma tela em branco.
import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/button";
import { reportError } from "@/lib/monitoring";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error); }, [error]);

  return (
    <main className="grid min-h-svh place-items-center p-6 text-center">
      <div>
        <span className="eyebrow">erro</span>
        <h1 className="mt-2">Algo quebrou por aqui</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
          A falha foi registrada. Você pode tentar de novo — se persistir, volte ao painel e siga por outro caminho.
        </p>
        {error.digest && (
          <p className="text-subtle-foreground mt-2 font-mono text-xs">referência: {error.digest}</p>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={reset}>Tentar novamente</Button>
          <Link href="/painel"><Button variant="outline">Voltar ao painel</Button></Link>
        </div>
      </div>
    </main>
  );
}
