# 01 — Resumo executivo: estabilização da Fase 1B

**Conclusão: a Fase 1B está estabilizada e o redesign do Pipeline pode ser liberado, com 3 pendências de baixo risco e 4 decisões suas (`12`).** Os critérios críticos de integridade foram verificados com evidência em navegador e banco reais; nada em produção foi tocado.

## O que a verificação encontrou (a documentação da 1B NÃO bastava)

| # | Defeito | Gravidade | Situação |
|---|---|---|---|
| 1 | **Importações simultâneas duplicavam leads** (298 em vez de 150; 273 em vez de 80) — escondido na 1ª importação do tenant por um efeito colateral | crítico | **corrigido** (lock por tenant) |
| 2 | **Uma linha com campo grande demais derrubava o lote e tornava a importação irrecuperável** (500 em loop) | crítico | **corrigido** (linha vira erro; as demais entram) |
| 3 | **Retomada**: janela renovada a cada tentativa; evidência apagada depois de 24 h (reenviar com "duplicar" regravava em silêncio) | alto | **corrigido** (20 h fixas desde o início; bloqueio com aviso; recuperação sem "duplicar") |
| 4 | Sem timeout: um lote pendurado travava tudo | alto | **corrigido** (120 s) |
| 5 | Importação seguia invisível ao sair da tela | médio | **corrigido** |
| 6 | Seletor "mover" sem contorno de foco | médio | **corrigido** |
| 7 | Teste pré-existente instável (relógio) | baixo | corrigido (só o teste) |

## Evidências

- **E2E Playwright: 135 testes — 134 passam, 0 falham**, em **Chromium, Firefox e WebKit** (20 min). Inclui **10.000 linhas** (20 lotes, 1,9 min, nenhum perdido/repetido), progresso real, cancelar, retomar, falhas no 1º/2º/último lote, timeout depois de gravar, 429/500/409/422, concorrência (abas, usuários, tenants), reinício real do backend (executado à parte), 4 resoluções × 2 temas com axe.
- **Backend: 2.722 testes passam** (+33); frontend: 264 Node + 422 UI; lint, tipos e build limpos.
- Arquitetura **A+ preservada** (sem job/fila/tabela nova); **nenhuma migration**; nenhum contrato de API quebrado.

## Commits

1B (locais, sem push): backend **`0977b50`**, frontend **`f032d65`**. Estabilização: branch `test/gsm-crm-phase-1b-stabilization` nos dois repositórios, **sem commit** (a pedido).

## O que ficou de fora (honesto)

Leitor de tela real não foi executado; arrastar com toque real não é automatizável; importação grande não foi feita em homologação; relatório permanente depois de fechar a página exigiria tabela nova (decisão sua). Achados não-1B: overflow do filtro de período no **WebKit mobile** e contraste do botão **WhatsApp no tema claro**.
