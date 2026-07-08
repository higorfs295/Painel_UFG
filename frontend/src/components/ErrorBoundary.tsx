// Captura erros de renderização e mostra um fallback amigável em vez de tela branca.
import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("Erro na interface:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="authwrap">
          <div className="card authcard center" role="alert">
            <div className="brand" style={{ justifyContent: "center", marginBottom: 12 }}>
              <span className="dot" />Painel Acadêmico
            </div>
            <h1>Algo deu errado</h1>
            <p className="mut">Ocorreu um erro inesperado na interface. Tente recarregar a página.</p>
            <button className="btn prim" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
