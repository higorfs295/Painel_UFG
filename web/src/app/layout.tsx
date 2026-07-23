import type { Metadata, Viewport } from "next";
import { Fraunces, Sora } from "next/font/google";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import { Providers } from "@/components/providers";
import "./globals.css";

// next/font baixa e auto-hospeda as fontes: sem requisição ao Google no runtime e sem
// o flash de troca que o <link> do app Vite tinha.
const sora = Sora({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-sora", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ee" },
    { media: "(prefers-color-scheme: dark)", color: "#14100a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: o next-themes escreve a classe do tema antes da hidratação
    <html lang="pt-BR" className={`${sora.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
