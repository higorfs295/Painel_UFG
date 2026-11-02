// Seção "Para quem administra" (v12) — no desenho do tremorlabs/template-solar: título grande
// e apertado, grade com guias tracejadas e ícones em azulejo laranja. Cada item descreve uma
// tela que existe no painel; o selo de privacidade resume a regra dos relatórios.
import {
  RiBarChartBoxLine, RiCalendar2Line, RiFileShield2Line, RiMegaphoneLine, RiShieldCheckLine, RiTeamLine,
} from "@remixicon/react";

const ITEMS = [
  { icon: RiTeamLine, title: "Convites em lote", text: "Cole a planilha da turma e cada pessoa recebe o próprio convite. Papéis, matrículas e sessões na mesma tela." },
  { icon: RiBarChartBoxLine, title: "Relatórios do curso", text: "Distribuição da integralização, disciplinas com mais alunos aptos e os gargalos da matriz — para planejar a oferta." },
  { icon: RiMegaphoneLine, title: "Avisos agendados", text: "Comunicados para todos, só alunos ou só um curso, com data para entrar e para sair do ar." },
  { icon: RiCalendar2Line, title: "Calendário acadêmico", text: "As viradas de período e as férias numa linha do tempo; o painel de cada aluno acompanha sozinho." },
  { icon: RiFileShield2Line, title: "Auditoria e monitor", text: "Quem fez o quê e quando, com busca; e a saúde da API minuto a minuto." },
  { icon: RiShieldCheckLine, title: "Privacidade por padrão", text: "A administração não vê notas nem o progresso de ninguém: só agregados, e só em cursos com 5 alunos ou mais." },
];

export function AdminSection() {
  return (
    <section aria-labelledby="para-quem-administra" className="relative mx-auto w-full max-w-6xl">
      <p className="text-sm font-semibold tracking-tight text-orange-700">Para coordenações</p>
      <h2 id="para-quem-administra" className="mt-2 max-w-3xl text-4xl font-semibold tracking-tighter text-balance text-gray-900 md:text-5xl">
        Uma área inteira para quem cuida do curso
      </h2>
      <p className="mt-4 max-w-2xl text-lg text-gray-700">
        A mesma conta pode administrar e acompanhar a própria formatura. A gestão tem as ferramentas — e os limites — que um curso precisa.
      </p>
      <div className="mt-12 grid grid-cols-1 border-t border-l border-dashed border-gray-300 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="group relative border-r border-b border-dashed border-gray-300 p-6 sm:p-8">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg bg-gradient-to-b from-orange-500 to-orange-700 text-white shadow-md ring-1 ring-white/25 ring-inset transition group-hover:-translate-y-0.5">
              <Icon className="size-5" />
            </span>
            <h3 className="mt-5 text-base font-semibold text-gray-900">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
