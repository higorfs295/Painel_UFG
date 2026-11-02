"use client";

// Ajuda / Sobre — explica as regras do painel (integralização, estados, SIGAA).
// Conteúdo estático, visível para os dois papéis.
import { useAuth } from "@/lib/auth-store";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";

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
];

export default function AjudaPage() {
  const user = useAuth((s) => s.user);

  return (
    <>
      <h1>Ajuda & sobre</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
        {APP_NAME} — {APP_TAGLINE}. Você está conectado como{" "}
        <span className="font-medium text-gray-900 dark:text-gray-50">{user?.name}</span>
        {user?.role === "ADMIN" ? " (administrador)" : ""}. Abaixo, como o painel calcula e organiza o seu progresso.
      </p>

      <dl className="mt-4 max-w-4xl divide-y divide-gray-200 border-y border-gray-200 sm:mt-6 lg:mt-10 dark:divide-gray-800 dark:border-gray-800">
        {FAQ.map((f) => (
          <div key={f.q} className="grid grid-cols-1 gap-x-14 gap-y-2 py-6 md:grid-cols-3">
            <dt className="font-semibold text-gray-900 sm:text-sm dark:text-gray-50">{f.q}</dt>
            <dd className="text-sm leading-6 text-gray-600 md:col-span-2 dark:text-gray-400">{f.a}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
        As regras completas (integralização, composições, importação de matrizes) estão documentadas no
        repositório do projeto, em <code>docs/DOMINIO.md</code>. Dúvidas específicas da sua matrícula podem
        ser tratadas com a coordenação do curso.
      </p>
    </>
  );
}
