import type { Metadata, Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import { Providers } from "@/components/providers";
import { APPEARANCE_BOOT_SCRIPT } from "@/lib/appearance";
import "./globals.css";

// As fontes dos dois templates de base: Inter no app (tremorlabs/template-dashboard) e
// Geist no site público (tremorlabs/template-solar). next/font auto-hospeda as duas.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: o next-themes escreve a classe do tema antes da hidratação
    <html lang="pt-BR" className={`${inter.variable} ${geist.variable}`} suppressHydrationWarning>
      <head>
        {/* v12: cor de destaque e barra lateral antes da primeira pintura (ver lib/appearance) */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
      </head>
      <body className="overflow-y-scroll scroll-auto">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
