"use client";

// Ajuda / Sobre — explica as regras do painel (integralização, estados, SIGAA), as cores e os
// atalhos. v12: perguntas em acordeão (Accordion da Tremor), legenda de cores e a seção de
// privacidade (o que o administrador vê e o que não vê).
import { RiKeyboardLine, RiPaletteLine, RiQuestionLine, RiShieldCheckLine } from "@remixicon/react";
import { useAuth } from "@/lib/auth-store";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import { compositionTone, SITUATION, tone } from "@/lib/palette";
import { PageBanner } from "@/components/fx/page-banner";
import { Panel } from "@/components/admin/panel";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/tremor/Accordion";
import { cx } from "@/lib/utils";

const FAQ: { q: string; a: string }[] = [
  { q: "Como o total integralizado é calculado?",
    a: "Cada composição (Núcleo Comum, Específico, Optativo, Núcleo Livre, Atividades Complementares) contribui limitada ao seu mínimo — horas além do mínimo de uma composição não adiantam a formatura em outra. Por isso a barra trava em 100%, mas o valor real e o excedente ficam registrados." },
  { q: "O que significam Aprovada, Cursando e Simulada?",
    a: "Aprovada conta no total oficial. Cursando (em andamento) e Simulada contam só na projeção (\"como fico se tudo der certo\"), não no oficial. Sem marcação, a disciplina fica pendente." },
  { q: "Como funcionam os Extras e a reclassificação?",
    a: "Optativas fora da matriz, Núcleo Livre, Atividades Complementares e registros. Cada extra tem um estado (planejado / em andamento / concluído) e uma categoria editável — um Núcleo Livre pode ser reclassificado como NC, NE ou NE optativa e passa a somar na composição certa." },
  { q: "Como as recomendações são ranqueadas?",
    a: "Pelo quanto cada disciplina disponível destrava na matriz (efeito transitivo), com as que liberam obrigatórias vindo primeiro." },
  { q: "O que é o código do SIGAA no cronograma?",
    a: "É o código de horário da UFG (ex.: 24M12 = seg/qua, matutino, aulas 1–2). O sistema o interpreta para montar a grade e detectar conflitos entre cenários." },
  { q: "De onde vem o período letivo / férias?",
    a: "De um calendário acadêmico global gerido pelos administradores (agendável por data). Sem calendário cadastrado, o sistema sugere pelo mês corrente." },
  { q: "Como mudo a cor e a barra lateral?",
    a: "Em Ajustes › Aparência: tema (claro, escuro ou o do sistema), cor de destaque (laranja, azul, violeta, verde ou rosa) e barra lateral (clara, escura ou colorida). A escolha fica salva na sua conta e vale em qualquer aparelho." },
  { q: "Posso administrar e acompanhar o meu curso com a mesma conta?",
    a: "Sim. Um administrador escolhe o curso em \"Meu painel\" (no menu do topo da barra lateral) e passa a ter as duas áreas: a gestão e o próprio progresso." },
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl K", "abre a busca de páginas e comandos"],
  ["a · c · s · l", "Disciplinas com seleção: aprovada, cursando, simular, limpar"],
  ["r · m · e · x", "Usuários com seleção (admin): reenviar convite, matricular, encerrar sessões, remover"],
  ["Esc", "cancela a seleção ou fecha a janela aberta"],
];

export default function AjudaPage() {
  const user = useAuth((s) => s.user);
  const comps = [["NC", "Núcleo Comum"], ["NEO", "Específico obrigatório"], ["OPT", "Específico optativo"], ["NL", "Núcleo Livre"], ["AC", "Complementares"]] as const;

  return (
    <div className="flex flex-col gap-6">
      <PageBanner eyebrow="Ajuda" icon={RiQuestionLine} title="Ajuda & sobre"
        description={<>{APP_NAME} — {APP_TAGLINE}. Você está conectado como <b className="font-medium text-gray-900 dark:text-gray-50">{user?.name}</b>{user?.role === "ADMIN" ? " (administrador)" : ""}. Abaixo, como o painel calcula e organiza o seu progresso.</>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" icon={RiQuestionLine} tone="brand" id="faq" title="Perguntas frequentes">
          <Accordion type="single" collapsible defaultValue={FAQ[0]!.q}>
            {FAQ.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger>{f.q}</AccordionTrigger>
                <AccordionContent><p className="leading-6">{f.a}</p></AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel icon={RiPaletteLine} tone="violet" id="cores" title="O que cada cor quer dizer" description="fixas — não mudam com a cor de destaque">
            <p className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">Situação da disciplina</p>
            <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
              {Object.entries(SITUATION).map(([k, v]) => (
                <li key={k} className="flex items-center gap-2"><span className={cx("size-2.5 rounded-full", tone(v.tone).dot)} aria-hidden="true" />{v.label}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">Composições</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {comps.map(([k, label], i) => (
                <li key={k} className="flex items-center gap-2"><span className={cx("h-2 w-6 rounded-full", tone(compositionTone(k, i)).dot)} aria-hidden="true" />{label} <code className="ml-auto text-xs">{k}</code></li>
              ))}
            </ul>
          </Panel>
          <Panel icon={RiKeyboardLine} tone="cyan" id="atalhos" title="Atalhos de teclado">
            <dl className="flex flex-col gap-3 text-sm">
              {SHORTCUTS.map(([k, v]) => (
                <div key={k} className="flex items-start gap-3">
                  <dt className="shrink-0"><kbd className="rounded-sm border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-sans text-xs text-gray-700 shadow-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">{k}</kbd></dt>
                  <dd className="text-gray-600 dark:text-gray-400">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      <Panel icon={RiShieldCheckLine} tone="emerald" id="privacidade" title="Seus dados e quem vê o quê">
        <ul className="grid gap-4 text-sm leading-6 text-gray-600 md:grid-cols-3 dark:text-gray-400">
          <li><b className="block text-gray-900 dark:text-gray-50">Só você vê o seu progresso</b>Disciplinas marcadas, notas, faltas, anotações, agenda e cenários aparecem apenas na sua conta.</li>
          <li><b className="block text-gray-900 dark:text-gray-50">A administração vê números agregados</b>Os relatórios por curso mostram médias e contagens, nunca uma linha por aluno — e somem em cursos com menos de 5 alunos. Notas não entram.</li>
          <li><b className="block text-gray-900 dark:text-gray-50">O que a administração vê da sua conta</b>Nome, e-mail, matrícula, turno, cursos, data do último login e se há sessão aberta — para convidar, ajustar matrículas e dar suporte.</li>
        </ul>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          As regras completas (integralização, composições, importação de matrizes) estão no repositório do projeto, em <code>docs/DOMINIO.md</code>. Dúvidas da sua matrícula: coordenação do curso.
        </p>
      </Panel>
    </div>
  );
}
