// Herói — Hero do tremorlabs/template-solar (MIT): selo de novidade, título enorme e
// apertado (text-8xl, tracking-tighter) em quatro palavras, subtítulo e o botão com
// degradê; ao fundo, o Jogo da Vida em pontos.
import Link from "next/link";
import { RiArrowRightUpLine } from "@remixicon/react";
import { FadeDiv, FadeSpan } from "./fade";
import { GameOfLife } from "./game-of-life";

export function Hero() {
  return (
    <section aria-label="Apresentação">
      <div className="relative isolate flex flex-col items-center justify-center px-4">
        <FadeDiv i={0} className="mx-auto">
          <a href="#mapa" aria-label="Novidade: mapa curricular" className="mx-auto w-full">
            <div className="inline-flex max-w-full items-center gap-3 rounded-full bg-white/5 px-2.5 py-0.5 pr-3 pl-0.5 font-medium text-gray-900 shadow-lg ring-1 shadow-orange-400/20 ring-black/10 backdrop-blur-[1px] transition-colors hover:bg-orange-500/[2.5%] focus:outline-hidden sm:text-sm">
              <span className="shrink-0 truncate rounded-full border bg-gray-50 px-2.5 py-1 text-sm text-gray-600 sm:text-xs">Novo</span>
              <span className="flex items-center gap-1 truncate">
                <span className="w-full truncate">Mapa curricular com a cadeia de pré-requisitos</span>
                <RiArrowRightUpLine className="size-4 shrink-0 text-gray-700" aria-hidden="true" />
              </span>
            </div>
          </a>
        </FadeDiv>
        <h1 className="mt-8 text-center text-5xl font-semibold tracking-tighter text-gray-900 sm:text-8xl sm:leading-22">
          <FadeSpan i={1}>Do</FadeSpan> <FadeSpan i={2}>calouro</FadeSpan>
          <br />
          <FadeSpan i={3}>ao</FadeSpan> <FadeSpan i={4}>diploma</FadeSpan>
        </h1>
        <p className="mt-5 max-w-xl text-center text-base text-balance text-gray-700 sm:mt-8 sm:text-xl">
          <FadeSpan i={5}>Integralização, pré-requisitos e grade do seu curso na UFG,</FadeSpan>{" "}
          <FadeSpan i={6}>calculados a partir da matriz curricular oficial —</FadeSpan>{" "}
          <FadeSpan i={7}>sem planilha paralela.</FadeSpan>
        </p>
        <FadeDiv i={8} className="flex flex-col items-center">
          {/* degradê do template, com o meio em orange-700: o texto branco fica em 5,23:1 */}
          <Link href="/entrar"
            className="mt-6 inline-flex cursor-pointer flex-row items-center justify-center gap-1 rounded-md border-b-[1.5px] border-orange-800 bg-linear-to-b from-orange-600 via-orange-700 to-orange-700 px-5 py-3 leading-4 font-medium tracking-wide whitespace-nowrap text-white shadow-[0_0_0_2px_rgba(0,0,0,0.04),0_0_14px_0_rgba(255,255,255,0.19)] transition-all duration-200 ease-in-out hover:shadow-orange-300">
            Entrar no painel
          </Link>
          <Link href="/cadastro" className="mt-4 text-sm text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline">
            ou crie sua conta
          </Link>
        </FadeDiv>
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <GameOfLife />
        </div>
      </div>
    </section>
  );
}
