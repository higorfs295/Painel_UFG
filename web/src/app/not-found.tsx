import Link from "next/link";
import Button from "@/components/ui/button";
import { APP_NAME } from "@/lib/branding";

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center p-6 text-center">
      <div>
        <span className="eyebrow">404</span>
        <h1 className="mt-2">Esta página não existe</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
          O endereço pode ter mudado, ou o link que você seguiu está desatualizado.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/painel"><Button variant="primary">Ir para o painel</Button></Link>
          <Link href="/"><Button variant="outline">Página inicial do {APP_NAME}</Button></Link>
        </div>
      </div>
    </main>
  );
}
