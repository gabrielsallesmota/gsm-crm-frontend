// Fase 0 — configuração global dos testes de UI. Tempo de espera maior para `findBy*`/`waitFor`:
// evita falso negativo quando a máquina está sob carga (ex.: CI ou backend rodando em paralelo).
import { configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 4000 });
