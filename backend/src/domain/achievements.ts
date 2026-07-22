// RF-23 — conquistas (gamificação leve, tema cerrado): derivadas do progresso, nunca persistidas.
// Puro e determinístico: mesma entrada => mesmas conquistas. A UI exibe earned/locked.

export type AchievementInput = {
  pct: number;               // % integralizado (0..100, já capado)
  doneCount: number;         // disciplinas aprovadas
  enrolledCount: number;     // cursando agora
  milestonesReached: number; // marcos de CH alcançados
  milestonesTotal: number;
  extrasDone: number;        // componentes extras concluídos
  mga: number | null;        // média global (null sem notas lançadas)
  termsCount: number;        // períodos com registro no histórico
  scenarios: number;         // cenários de grade criados
};

export type Achievement = {
  key: string; icon: string; label: string; desc: string; earned: boolean;
};

export function achievements(i: AchievementInput): Achievement[] {
  const A = (key: string, icon: string, label: string, desc: string, earned: boolean): Achievement =>
    ({ key, icon, label, desc, earned });
  return [
    A("primeira-luz", "🌅", "Primeira luz", "Aprove a primeira disciplina", i.doneCount >= 1),
    A("em-movimento", "🚶", "Em movimento", "Tenha disciplinas cursando agora", i.enrolledCount >= 1),
    A("trilheiro", "🥾", "Trilheiro", "10 disciplinas aprovadas", i.doneCount >= 10),
    A("caminho-aberto", "🛤️", "Caminho aberto", "25 disciplinas aprovadas", i.doneCount >= 25),
    A("raiz-profunda", "🌳", "Raiz profunda", "25% da carga horária integralizada", i.pct >= 25),
    A("meio-do-cerrado", "🌵", "Meio do cerrado", "50% da carga horária integralizada", i.pct >= 50),
    A("reta-final", "🎯", "Reta final", "75% da carga horária integralizada", i.pct >= 75),
    A("horizonte", "🌄", "Horizonte", "100% — integralização completa", i.pct >= 100),
    A("marco-zero", "🗿", "Marco zero", "Alcance o primeiro marco de horas", i.milestonesReached >= 1),
    A("todos-os-marcos", "🏁", "Todos os marcos", "Alcance todos os marcos do curso",
      i.milestonesTotal > 0 && i.milestonesReached >= i.milestonesTotal),
    A("colecionador", "🎒", "Colecionador", "3 componentes extras concluídos", i.extrasDone >= 3),
    A("notavel", "📚", "Notável", "Média global 8,0 ou mais", i.mga != null && i.mga >= 8),
    A("constante", "🔥", "Constante", "Histórico com 4 períodos registrados", i.termsCount >= 4),
    A("arquiteto", "🗺️", "Arquiteto de grade", "Crie um cenário de cronograma", i.scenarios >= 1),
  ];
}
