// No lugar do "Testimonial" do tremorlabs/template-solar. O original era a citação de uma
// pessoa fictícia sobre uma foto; aqui o bloco tem o mesmo desenho (aspas penduradas,
// frase em negrito + continuação esmaecida, sombra longa) mas diz uma coisa verificável:
// a regra de cálculo do próprio painel (RN-03 da especificação), sem autor inventado.
import { DiagonalPattern } from "./feature-divider";

export function RuleQuote() {
  return (
    <section aria-label="Como a integralização é contada"
      className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 shadow-black/10 ring-black/5">
      <DiagonalPattern id="rule-bg" className="mask-[radial-gradient(white,transparent_75%)] opacity-70" />
      <div className="relative z-20 p-8 sm:p-14 lg:p-24">
        <blockquote className="relative max-w-3xl text-xl leading-relaxed tracking-tight text-gray-900 md:text-2xl lg:text-3xl">
          <p className="before:absolute before:top-0 before:right-full before:content-['“'] after:text-gray-900/70 after:content-['”']">
            <strong className="font-semibold">Cada núcleo soma só até o mínimo que a matriz exige.</strong>{" "}
            <span className="text-gray-900/70">
              O que passa disso aparece como excedente e não infla a sua integralização — a mesma
              conta que a coordenação faz na hora de conferir a sua formatura.
            </span>
          </p>
        </blockquote>
        <div className="mt-14 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="text-base font-medium text-gray-900">Regra de cálculo do painel</div>
          <div className="text-sm text-orange-800">RN-03 · especificação do projeto</div>
        </div>
      </div>
    </section>
  );
}
