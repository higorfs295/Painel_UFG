// Rodapé — Footer do tremorlabs/template-solar (MIT): guias tracejadas, faixa hachurada
// entre bordas tracejadas, marca + redes à esquerda e colunas de links. Só links reais.
import Link from "next/link";
import { RiGithubFill } from "@remixicon/react";
import { BrandWordmark } from "@/components/brand";
import { APP_NAME } from "@/lib/branding";
import { DashedGuide, DiagonalPattern } from "./feature-divider";

const REPO = "https://github.com/higorfs295/Painel_UFG";
const SECTIONS = [
  {
    title: "Painel",
    items: [
      { label: "Entrar", href: "/entrar" }, { label: "Criar conta", href: "/cadastro" },
      { label: "Recursos", href: "#recursos" }, { label: "Mapa curricular", href: "#mapa" },
    ],
  },
  {
    title: "Projeto",
    items: [
      { label: "Código-fonte", href: REPO, external: true },
      { label: "Licença MIT", href: `${REPO}/blob/main/LICENSE`, external: true },
      { label: "Reportar um problema", href: `${REPO}/issues`, external: true },
      { label: "Política de segurança", href: `${REPO}/blob/main/SECURITY.md`, external: true },
    ],
  },
];

export function Footer() {
  return (
    <div className="px-4 xl:px-0">
      <footer id="rodape" className="relative mx-auto flex max-w-6xl flex-wrap pt-4 pb-16">
        <div className="pointer-events-none inset-0">
          <DashedGuide mask="linear-gradient(transparent, white 5rem)" />
          <DashedGuide className="right-0" mask="linear-gradient(transparent, white 5rem)" />
        </div>
        <div className="relative mb-10 h-20 w-full border-y border-dashed border-gray-300">
          <DiagonalPattern id="footer-hatch" stroke="stroke-gray-300" />
        </div>
        <div className="mr-auto flex w-full justify-between lg:w-fit lg:flex-col">
          <Link href="/" className="ml-2 flex items-center font-medium text-gray-700 select-none sm:text-sm" aria-label={`${APP_NAME} — início`}>
            <BrandWordmark className="text-gray-900" />
          </Link>
          <div>
            <div className="mt-4 flex items-center">
              <a href={REPO} target="_blank" rel="noopener noreferrer" aria-label="Repositório no GitHub"
                className="rounded-sm p-2 text-gray-700 transition-colors duration-200 hover:bg-gray-200 hover:text-gray-900">
                <RiGithubFill className="size-5" aria-hidden="true" />
              </a>
            </div>
            <div className="ml-2 hidden text-sm text-gray-700 lg:inline">
              © {new Date().getFullYear()} {APP_NAME} · código aberto
            </div>
          </div>
        </div>
        {SECTIONS.map((section) => (
          <div key={section.title} className="mt-10 min-w-44 pl-2 lg:mt-0 lg:pl-0">
            <h3 className="mb-4 font-medium text-gray-900 sm:text-sm">{section.title}</h3>
            <ul className="space-y-4">
              {section.items.map((item) => (
                <li key={item.label} className="text-sm">
                  {"external" in item && item.external ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer"
                      className="text-gray-600 transition-colors duration-200 hover:text-gray-900">{item.label}</a>
                  ) : (
                    <Link href={item.href} className="text-gray-600 transition-colors duration-200 hover:text-gray-900">{item.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </footer>
    </div>
  );
}
