/**
 * Garante que só UMA execução de `task` esteja em andamento por vez: quem
 * chamar enquanto ela roda recebe a MESMA promise. Terminada (sucesso ou
 * erro), a próxima chamada dispara uma execução nova.
 *
 * Usado na renovação de sessão: o backend rotaciona o refresh token a cada
 * uso (o antigo é revogado na hora). Sem isto, N requisições que recebem
 * 401 ao mesmo tempo tentavam N refreshes com o MESMO token — a primeira
 * vencia e todas as outras falhavam, deslogando o usuário (auditoria
 * FE-P1-01).
 */
export function singleFlight<T>(task: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (!inFlight) {
      inFlight = task().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
