// Erro de aplicação com status HTTP. Deixa a camada de serviço sinalizar falhas de negócio
// sem depender de `reply` — as rotas ficam finas e o handler central traduz para HTTP.
export class AppError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (msg: string) => new AppError(404, msg);
export const badRequest = (msg: string) => new AppError(400, msg);
