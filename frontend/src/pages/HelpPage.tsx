// Ajuda / Sobre — explica como o Painel funciona (regras de integralização, estados, SIGAA).
// Visível para todos os papéis; conteúdo estático, sem chamadas de API.
import { useAuth } from "../store/auth";
import { APP_NAME, APP_TAGLINE } from "../branding";
import Card from "../components/ui/Card";
import Reveal from "../components/ui/Reveal";
import {
  IconTarget, IconBook, IconSprout, IconGrid, IconClock, IconStar, IconInfo,
} from "../components/ui/Icons";

const FAQ: { icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element; q: string; a: string }[] = [
  { icon: IconTarget, q: "Como o total integralizado é calculado?", a: "Cada composição (Núcleo Comum, Específico, Optativo, Núcleo Livre, Atividades Complementares) contribui limitada ao seu mínimo — horas além do mínimo de uma composição não adiantam a formatura em outra. Por isso a barra trava em 100%, mas o valor real e o excedente ficam registrados." },
  { icon: IconBook, q: "O que significam Aprovada, Cursando e Simulada?", a: "Aprovada conta no total oficial. Cursando (em andamento) e Simulada contam só na projeção (\"como fico se tudo der certo\"), não no oficial. Sem marcação, a disciplina fica pendente." },
  { icon: IconSprout, q: "Como funcionam os Extras e a reclassificação?", a: "Optativas fora da matriz, Núcleo Livre, Atividades Complementares e registros. Cada extra tem um estado (planejado / em andamento / concluído) e uma categoria editável — um Núcleo Livre pode ser reclassificado como NC, NE ou NE optativa e passa a somar na composição certa." },
  { icon: IconStar, q: "Como as recomendações são ranqueadas?", a: "Pelo quanto cada disciplina disponível destrava na matriz (efeito transitivo), com as que liberam obrigatórias vindo primeiro." },
  { icon: IconGrid, q: "O que é o código do SIGAA no cronograma?", a: "É o código de horário da UFG (ex.: 24M12 = seg/qua, matutino, aulas 1–2). O sistema o interpreta para montar a grade e detectar conflitos entre cenários." },
  { icon: IconClock, q: "De onde vem o período letivo / férias?", a: "De um calendário acadêmico global gerido pelos administradores (agendável por data). Sem calendário cadastrado, o sistema sugere pelo mês corrente." },
];

export default function HelpPage() {
  const user = useAuth((s) => s.user);
  return (
    <div className="stack">
      <header className="page-head">
        <span className="eyebrow">como funciona</span>
        <h1>Ajuda &amp; <em>sobre</em></h1>
      </header>

      <div className="callout">
        <div className="callout-body">
          <span className="eyebrow">{APP_NAME}</span>
          <strong className="callout-big">{APP_TAGLINE}</strong>
          <span className="mut">
            Você está logado como <b>{user?.name}</b>{user?.role === "ADMIN" ? " (administrador)" : ""}.
            {" "}Abaixo, as perguntas mais comuns sobre como o painel calcula e organiza o seu progresso.
          </span>
        </div>
      </div>

      <div className="bento">
        {FAQ.map((f, i) => (
          <Reveal className="sp6" delay={i * 60} key={f.q}>
            <section className="b-cell" style={{ height: "100%" }}>
              <span className="stat-ico" style={{ marginBottom: 12 }}><f.icon /></span>
              <h3 style={{ marginBottom: 8 }}>{f.q}</h3>
              <p className="mut" style={{ margin: 0, fontSize: ".9rem", lineHeight: 1.6 }}>{f.a}</p>
            </section>
          </Reveal>
        ))}
      </div>

      <Card>
        <h3><IconInfo /> Precisa de mais?</h3>
        <p className="mut" style={{ margin: 0 }}>
          As regras completas (integralização, composições, importação de matrizes) estão documentadas no
          repositório do projeto, em <code>docs/DOMINIO.md</code>. Dúvidas específicas da sua matrícula podem
          ser tratadas com a coordenação do curso.
        </p>
      </Card>
    </div>
  );
}
