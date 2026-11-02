// Casca das telas de entrada — a página de login do tremorlabs/template-overview (MIT,
// © 2025 Tremor Labs, Inc.): coluna estreita centralizada, grade de quadradinhos ao fundo
// com máscara radial e a "placa" com quatro parafusos segurando a marca. Acento laranja.
// Grupo de rota `(auth)`: a URL não ganha segmento.
import Link from "next/link";
import { APP_NAME } from "@/lib/branding";
import { BrandMark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-20 lg:px-6 dark:bg-gray-950">
      <div className="relative w-full sm:mx-auto sm:max-w-sm">
        <div aria-hidden="true"
          className="pointer-events-none absolute -top-[18%] left-1/2 -translate-x-1/2 opacity-60 select-none dark:opacity-90"
          style={{
            maskImage: "radial-gradient(rgba(0, 0, 0, 1) 0%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(rgba(0, 0, 0, 1) 0%, transparent 80%)",
          }}>
          {/* sombra em sRGB (#ff6900 = orange-500): em oklab, perto do limite do gamut, o
              desfoque gerava franjas ciano em alguns rasterizadores */}
          <div className="flex flex-col gap-1">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={`l-${i}`} className="flex gap-2">
                {Array.from({ length: 10 }, (_, j) => (
                  <div key={`c-${i}-${j}`}
                    className="size-7 rounded-md shadow-[0_1px_3px_0_rgb(255_105_0/0.4),0_1px_2px_-1px_rgb(255_105_0/0.4)] ring-1 ring-black/5 dark:shadow-[0_1px_3px_0_rgb(255_137_4/0.2),0_1px_2px_-1px_rgb(255_137_4/0.2)] dark:ring-white/10" />
                ))}
              </div>
            ))}
          </div>
        </div>

        <Link href="/" aria-label={`${APP_NAME} — página inicial`}
          className="relative mx-auto block w-fit rounded-xl bg-gray-50 p-4 shadow-md ring-1 shadow-black/10 ring-black/10 dark:bg-gray-900 dark:ring-gray-800">
          <span className="absolute top-[9%] left-[9%] size-1 rounded-full bg-gray-100 shadow-inner dark:bg-gray-800" />
          <span className="absolute top-[9%] right-[9%] size-1 rounded-full bg-gray-100 shadow-inner dark:bg-gray-800" />
          <span className="absolute bottom-[9%] left-[9%] size-1 rounded-full bg-gray-100 shadow-inner dark:bg-gray-800" />
          <span className="absolute right-[9%] bottom-[9%] size-1 rounded-full bg-gray-100 shadow-inner dark:bg-gray-800" />
          <span className="block w-fit rounded-lg bg-linear-to-b from-orange-500 to-orange-700 p-3 shadow-xs ring-1 shadow-orange-500/50 ring-white/25 ring-inset">
            <BrandMark onAccent className="size-8" />
          </span>
        </Link>

        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
