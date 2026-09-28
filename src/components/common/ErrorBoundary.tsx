import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
  /** "page": falha fica restrita ao conteúdo (menu continua usável);
   * "app": última rede de proteção, fora do layout. */
  scope: "page" | "app";
}

interface State {
  error: Error | null;
}

/**
 * Error Boundary (Etapa 1): um erro de RENDER numa tela não derruba o app
 * inteiro em tela branca. Mostra uma mensagem neutra — nunca a stack nem a
 * mensagem técnica — e oferece tentar de novo / recarregar. Erros de ações
 * assíncronas NÃO passam por aqui: esses viram toast (`toastError`).
 * O layout remonta o boundary a cada troca de rota (`key`), então navegar
 * para outra tela já sai do estado de erro.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Só console: ainda não há coletor de erros (ver relatório da Etapa 1).
    console.error("Erro de renderização capturado pelo ErrorBoundary", error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className={this.props.scope === "app" ? styles.full : styles.page}>
        <div className={styles.card}>
          <h2 className={styles.title}>Algo deu errado nesta tela</h2>
          <p className={styles.text}>
            Não foi possível exibir este conteúdo. Seus dados não foram alterados. Tente novamente
            ou recarregue a página.
          </p>
          <div className={styles.actions}>
            {this.props.scope === "page" && (
              <button type="button" className={styles.secondary} onClick={this.reset}>
                Tentar novamente
              </button>
            )}
            <button
              type="button"
              className={styles.primary}
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
