// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.

/**
 * Deduplicação de leituras compartilhadas (Etapa 4). Pipelines, tags e o
 * diretório da equipe são pedidos por vários componentes ao mesmo tempo
 * (página + drawer do lead + modal de tarefa). Aqui, chamadas com a mesma
 * chave dentro de `ttlMs` reaproveitam a MESMA promessa — uma requisição
 * só. Erro não fica em cache. `reload()` de cada hook invalida a chave,
 * então recarregar continua buscando dado novo.
 *
 * Não é um cache de dados de negócio: o TTL é curto de propósito.
 */
interface Entry {
  promise: Promise<unknown>;
  at: number;
}

const entries = new Map<string, Entry>();

export function sharedRequest<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = 15_000,
  now: () => number = Date.now,
): Promise<T> {
  const hit = entries.get(key);
  if (hit && now() - hit.at < ttlMs) return hit.promise as Promise<T>;
  const promise = fn();
  entries.set(key, { promise, at: now() });
  promise.catch(() => {
    if (entries.get(key)?.promise === promise) entries.delete(key);
  });
  return promise;
}

/** Remove as chaves que começam com `prefix` (ou todas, sem prefixo). */
export function invalidateShared(prefix = ""): void {
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}
