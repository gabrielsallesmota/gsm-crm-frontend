# 01 — Resumo executivo da Fase 1B

**Branch:** `feat/gsm-crm-ux-phase-1b` (frontend e backend). **Nada commitado, sem push/merge/deploy.**

## O que mudou

1. **Ordenação global do Pipeline (PIP-02)**: agora feita pelo servidor; antes só ordenava os 25 cards carregados. Corrigido também um defeito real de paginação no backend (sem desempate/nulos, podia repetir ou pular leads).
2. **Importação CSV em lotes (D-10)**: até 10.000 linhas e 5 MB, lotes de 500, pré-importação, progresso real, cancelar, retomar, relatório por linha (com download), idempotente por lote (`Idempotency-Key`) — **sem migration**.
3. **Acessibilidade**: reordenar etapas por teclado (PIP-04), mover lead sem arrastar descobrível (PIP-05), alvos de toque (PIP-12), `ProspectImportModal` acessível e rótulos na Prospecção.

## Decisões

- Arquitetura A+ (lotes pelo cliente + idempotência durável existente) em vez de job assíncrono (B) ou upload (C): atende aos requisitos sem estrutura nova (`04`).
- API compatível: header opcional e campo `reason` opcional; limite de 2.000/requisição mantido.

## Qualidade

Backend 2689 testes verdes (+35 novos); frontend 259 Node (+20) e 405 UI (+40); lint, tipos e build limpos (`06`).

## Riscos principais

Corrida entre importações simultâneas sem índice único; relatório detalhado só na sessão; validação em navegador real pendente (`09`).

## Próximo passo

Revisar e autorizar o commit da 1B (backend primeiro), executar as verificações manuais de `09` em homologação e então seguir ao redesign (`10`).
