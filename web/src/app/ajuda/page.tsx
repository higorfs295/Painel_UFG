"use client";

// Ajuda / Sobre — explica as regras do painel (integralização, estados, SIGAA).
// Conteúdo estático, visível para os dois papéis.
import type { ComponentType, SVGProps } from "react";
import { useAuth } from "@/lib/auth-store";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import { Card, PageHead } from "@/components/ui";
import { IconBook, IconClock, IconGrid, IconInfo, IconSprout, IconStar, IconTarget } from "@/components/ui/icons";

const FAQ: { icon: ComponentType<SVGProps<SVGSVGElement>>; q: string; a: string }[] = [
  { icon: IconTarget, q: "Como o total integralizado é calculado?",
    a: "Cada composição (Núcleo Comum, Específico, Optativo, Núcleo Livre, Atividades Complementares) contribui limitada ao seu mínimo — horas além do mínimo de uma composição não adiantam a formatura em outra. Por isso a barra trava em 100%, mas o valor real e o excedente ficam registrados." },
  { icon: IconBook, q: "O que significam Aprovada, Cursando e Simulada?",
    a: "Aprovada conta no total oficial. Cursando (em andamento) e Simulada contam só na projeção (\"como fico se tudo der certo\"), não no oficial. Sem marcação, a disciplina fica pendente." },
  { icon: IconSprout, q: "Como funcionam os Extras e a reclassificação?",
    a: "Optativas fora da matriz, Núcleo Livre, Atividades Complementares e registros. Cada extra tem um estado (planejado / em andamento / concluído) e uma categoria editável — um Núcleo Livre pode ser reclassificado como NC, NE ou NE optativa e passa a somar na composição certa." },
  { icon: IconStar, q: "Como as recomendações são ranqueadas?",
    a: "Pelo quanto cada disciplina disponível destrava na matriz (efeito transitivo), com as que liberam obrigatórias vindo primeiro." },
  { icon: IconGrid, q: "O que é o código do SIGAA no cronograma?",
    a: "É o código de horário da UFG (ex.: 24M12 = seg/qua, matutino, aulas 1–2). O sistema o interpreta para montar a grade e detectar conflitos entre cenários." },
  { icon: IconClock, q: "De onde vem o período letivo / férias?",
    a: "De um calendário acadêmico global gerido pelos administradores (agendável por data). Sem calendário cadastrado, o sistema sugere pelo mês corrente." },
];

export default function AjudaPage() {
  const user = useAuth((s) => s.user);

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="como funciona" title="Ajuda & sobre" />

      <Card className="border-l-primary border-l-4">
        <span className="eyebrow">{APP_NAME}</span>
        <p className="font-display mt-1 text-2xl font-semibold tracking-tight">{APP_TAGLINE}</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Você está conectado como <b className="text-foreground">{user?.name}</b>
          {user?.role === "ADMIN" ? " (administrador)" : ""}. Abaixo, as perguntas mais comuns sobre como o
          painel calcula e organiza o seu progresso.
        </p>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        {FAQ.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.q}>
              <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-lg"><Icon /></span>
              <h3 className="font-display mt-3 text-base font-semibold tracking-tight">{f.q}</h3>
              <p className="text-muted-foreground mt-2 text-sm">{f.a}</p>
            </Card>
          );
        })}
      </div>

      <Card>
        <h3 className="section-label flex items-center gap-2"><IconInfo /> Precisa de mais?</h3>
        <p className="text-muted-foreground text-sm">
          As regras completas (integralização, composições, importação de matrizes) estão documentadas no
          repositório do projeto, em <code>docs/DOMINIO.md</code>. Dúvidas específicas da sua matrícula podem
          ser tratadas com a coordenação do curso.
        </p>
      </Card>
    </div>
  );
}
