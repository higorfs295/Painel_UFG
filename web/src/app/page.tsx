// Página pública — a home do tremorlabs/template-solar (MIT): mesmas seções, mesmos
// espaçamentos (pt-56 no herói, mt-52/mt-32 entre blocos, divisores com pontos).
// Server Component: o HTML sai pronto; só a barra (rolagem) e o canvas do herói hidratam.
// O site é claro por desenho (como o template), mesmo com o sistema no escuro.
import type { Metadata } from "next";
import { APP_TAGLINE } from "@/lib/branding";
import { NavBar } from "@/components/site/navbar";
import { Hero } from "@/components/site/hero";
import { Features } from "@/components/site/features";
import { RuleQuote } from "@/components/site/rule";
import { CurriculumMap } from "@/components/site/curriculum-map";
import { Analytics } from "@/components/site/analytics";
import { AdminSection } from "@/components/site/admin-section";
import { CallToAction } from "@/components/site/cta";
import { Footer } from "@/components/site/footer";
import { FeatureDivider } from "@/components/site/feature-divider";

export const metadata: Metadata = {
  title: "Acompanhe sua formatura",
  description: APP_TAGLINE,
};

export default function LandingPage() {
  return (
    <div data-accent="orange" className="font-geist min-h-screen overflow-x-hidden bg-gray-50 text-gray-900 antialiased [color-scheme:light]">
      <NavBar />
      <main className="relative mx-auto flex flex-col">
        <div className="pt-40 sm:pt-56"><Hero /></div>
        <div className="mt-40 px-4 sm:mt-52 xl:px-0"><Features /></div>
        <div className="mt-32 px-4 xl:px-0"><RuleQuote /></div>
        <FeatureDivider className="my-16 max-w-6xl" />
        <div className="px-4 xl:px-0"><CurriculumMap /></div>
        <FeatureDivider className="my-16 max-w-6xl" />
        <div className="mt-12 px-4 xl:px-0"><Analytics /></div>
        <FeatureDivider className="my-16 max-w-6xl" />
        <div className="mb-40 px-4 xl:px-0"><AdminSection /></div>
        <div className="mt-10 mb-40 px-4 xl:px-0"><CallToAction /></div>
      </main>
      <Footer />
    </div>
  );
}
