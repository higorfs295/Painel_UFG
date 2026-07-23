// Página pública. É um Server Component: o HTML sai pronto do servidor e só as seções
// que precisam de interação (header fixo, acordeão, animações) hidratam no cliente.
// É a divisão que o next-partial-prerendering demonstra — casca estática, ilhas dinâmicas.
import type { Metadata } from "next";
import { Cta, Faq, Features, Hero, HowItWorks, SiteFooter, SiteHeader } from "@/components/marketing/sections";
import { APP_TAGLINE } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Acompanhe sua formatura",
  description: APP_TAGLINE,
};

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
