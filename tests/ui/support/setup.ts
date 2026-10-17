// Fase 0 — configuração global dos testes de UI. Tempo de espera maior para `findBy*`/`waitFor`:
// evita falso negativo quando a máquina está sob carga (ex.: CI ou backend rodando em paralelo).
import { configure } from "@testing-library/react";
import { afterEach } from "vitest";

configure({ asyncUtilTimeout: 4000 });

// O `localStorage` do Node 25 sem `--localstorage-file` válido existe, mas LANÇA ao ser usado. Os
// componentes tratam o armazenamento como opcional (try/catch); os testes que dependem dele
// (ex.: retomada de importação) precisam de um armazenamento funcional e limpo entre os testes.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}
let storageWorks = true;
try {
  window.localStorage.setItem("__probe__", "1");
  window.localStorage.removeItem("__probe__");
} catch {
  storageWorks = false;
}
if (!storageWorks) {
  Object.defineProperty(window, "localStorage", { value: memoryStorage(), configurable: true });
}
afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // nada a limpar
  }
});
