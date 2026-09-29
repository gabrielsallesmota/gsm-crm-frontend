import { useEffect } from "react";
import { pageTitle } from "../config/brand";

/** Título da aba por tela (Etapa 4): ajuda quem trabalha com várias abas e
 * é o primeiro texto anunciado pelo leitor de tela ao trocar de página. */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);
}
