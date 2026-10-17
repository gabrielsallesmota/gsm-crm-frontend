// E2E da importação CSV em lotes contra a API REAL (banco isolado). Nada é simulado no servidor:
// as falhas são injetadas NA REDE (entre navegador e API) e o estado final é conferido na API.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { Api, phoneOf } from "./support/api";
import {
  chooseFile,
  importButton,
  importDialog,
  loginUi,
  openImport,
  openPipeline,
  progressBar,
  progressValue,
  stateText,
  summaryNumbers,
} from "./support/app";
import { file, holdBatches, injectFaults, toCsv, validCsv } from "./support/csv";
import { tenantOf } from "./support/env";

async function begin(page: Page, tenant: number) {
  await loginUi(page, tenant);
  await openPipeline(page);
  await openImport(page);
}

const uniquePhones = async (api: Api) => {
  const leads = await api.leads();
  return { total: leads.length, unique: new Set(leads.map((l) => l.phone)).size };
};

test.describe("Importação — volumes e lotes", () => {
  test("1 registro: prévia, importação e relatório; o lead aparece no pipeline @cross", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 24);
    await begin(page, tenant);
    await chooseFile(page, file(validCsv(1, 20)), 1);
    const preview = importDialog(page).getByRole("region", { name: "Pré-importação" });
    await expect(preview).toContainText("Válidas: 1");
    await expect(preview).toContainText("Lotes: 1");
    await importButton(page).click();
    await expect(stateText(page, "Concluído")).toBeVisible();
    expect((await summaryNumbers(page))["Criados"]).toBe(1);
    await importDialog(page).getByRole("button", { name: "Ver no pipeline" }).click();
    await expect(page.getByRole("button", { name: "Abrir Lead 00000" })).toBeVisible();
    expect(await (await Api.login(tenant)).leadCount()).toBe(1);
  });

  const volumes: [number, number, number][] = [
    [500, 1, 25],
    [501, 2, 26],
    [1000, 2, 27],
  ];
  for (const [rows, batches, tenantNo] of volumes) {
    test(`${rows} registros: ${batches} lote(s) de até 500; tudo gravado e contado @cross`, async ({ page }, testInfo) => {
      const tenant = tenantOf(testInfo, tenantNo);
      const requests: number[] = [];
      page.on("request", (r) => {
        if (r.url().endsWith("/leads/bulk-import")) requests.push(JSON.parse(r.postData() ?? "{}").rows.length);
      });
      await begin(page, tenant);
      await chooseFile(page, file(validCsv(rows, 21 + tenantNo)), rows);
      await expect(importDialog(page).getByRole("region", { name: "Pré-importação" })).toContainText(`Lotes: ${batches}`);
      await importButton(page).click();
      await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 120_000 });
      expect(requests.length).toBe(batches);
      expect(Math.max(...requests)).toBeLessThanOrEqual(500);
      expect(requests.reduce((a, b) => a + b, 0)).toBe(rows);
      expect((await summaryNumbers(page))["Criados"]).toBe(rows);
      const api = await Api.login(tenant);
      expect(await uniquePhones(api)).toEqual({ total: rows, unique: rows });
    });
  }

  for (const [rows, batches, tenantNo] of [
    [2000, 4, 28],
    [2001, 5, 29],
  ] as const) {
    test(`${rows} registros (limite do servidor por requisição = 2.000): ${batches} lotes`, async ({ page }, testInfo) => {
      test.setTimeout(420_000);
      const tenant = tenantOf(testInfo, tenantNo);
      await begin(page, tenant);
      await chooseFile(page, file(validCsv(rows, 21 + tenantNo)), rows);
      await importButton(page).click();
      await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 360_000 });
      expect((await summaryNumbers(page))["Criados"]).toBe(rows);
      expect(await uniquePhones(await Api.login(tenant))).toEqual({ total: rows, unique: rows });
    });
  }

  test("10.000 registros em ambiente isolado: 20 lotes, progresso real e nenhum registro perdido ou repetido", async ({ page }, testInfo) => {
    test.setTimeout(1_500_000);
    const tenant = tenantOf(testInfo, 30);
    const seenProgress: number[] = [];
    await begin(page, tenant);
    await chooseFile(page, file(validCsv(10_000, 50)), 10_000);
    await expect(importDialog(page).getByRole("region", { name: "Pré-importação" })).toContainText("Lotes: 20");
    await importButton(page).click();
    // amostra o progresso enquanto roda: nunca regride e sempre é múltiplo de 500 (lotes confirmados)
    const sampler = (async () => {
      for (;;) {
        if ((await progressBar(page).count()) === 0) return;
        const { value } = await progressValue(page).catch(() => ({ value: -1 }));
        if (value >= 0) seenProgress.push(value);
        await page.waitForTimeout(1000);
      }
    })();
    await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 1_400_000 });
    await sampler;
    expect(seenProgress.length).toBeGreaterThan(3);
    expect(seenProgress).toEqual([...seenProgress].sort((a, b) => a - b));
    expect(seenProgress.every((v) => v % 500 === 0)).toBe(true);
    expect((await summaryNumbers(page))["Criados"]).toBe(10_000);
    expect(await uniquePhones(await Api.login(tenant))).toEqual({ total: 10_000, unique: 10_000 });
  });

  test("10.001 registros: bloqueado antes de enviar qualquer coisa", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 31);
    let sent = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/leads/bulk-import")) sent++;
    });
    await begin(page, tenant);
    await importDialog(page).getByLabel("Arquivo CSV com os leads").setInputFiles(file(validCsv(10_001, 51)));
    await expect(importDialog(page).getByText(/limite é 10\.000/)).toBeVisible({ timeout: 60_000 });
    await expect(importDialog(page).getByText(/Nada foi importado/)).toBeVisible();
    await expect(importButton(page)).toBeDisabled();
    expect(sent).toBe(0);
    expect(await (await Api.login(tenant)).leadCount()).toBe(0);
  });

  test("arquivo acima de 5 MB é recusado antes de processar", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 32);
    await begin(page, tenant);
    const big = toCsv([["Nome", "Telefone"], ["x".repeat(5 * 1024 * 1024 + 10), "11999990000"]]);
    await importDialog(page).getByLabel("Arquivo CSV com os leads").setInputFiles(file(big));
    await expect(importDialog(page).getByText(/limite é 5 MB/)).toBeVisible({ timeout: 30_000 });
    expect(await (await Api.login(tenant)).leadCount()).toBe(0);
  });
});

test.describe("Importação — progresso real, cancelar e retomar", () => {
  test("o progresso só avança quando o SERVIDOR confirma o lote (resposta retida na rede)", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 33);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    const batches = await holdBatches(page);
    await chooseFile(page, file(validCsv(1000, 52)), 1000);
    await importButton(page).click();
    const first = await batches.next(); // o servidor já gravou o lote 1…
    expect(first.status).toBe(200);
    expect(await api.leadCount()).toBe(500);
    expect(await progressValue(page)).toEqual({ value: 0, max: 1000 }); // …mas a tela ainda não foi avisada
    await expect(importDialog(page).getByText(/Enviando lote 1 de 2/)).toBeVisible();
    await first.release();
    await expect.poll(async () => (await progressValue(page)).value).toBe(500);
    const second = await batches.next();
    expect(await api.leadCount()).toBe(1000);
    expect((await progressValue(page)).value).toBe(500);
    await second.release();
    await expect(stateText(page, "Concluído")).toBeVisible();
    await batches.stop();
  });

  test("cancelar termina o lote em andamento, não envia o seguinte e permite retomar sem duplicar", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 34);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    const batches = await holdBatches(page);
    await chooseFile(page, file(validCsv(1000, 53)), 1000);
    // estratégia "duplicar": se a retomada reenviasse o lote 1, haveria 1.500 leads
    await importDialog(page).getByLabel("Se o telefone já existir").selectOption("duplicate");
    await importButton(page).click();
    const first = await batches.next();
    await importDialog(page).getByRole("button", { name: "Cancelar importação" }).click();
    await first.release();
    await expect(stateText(page, "Cancelada")).toBeVisible();
    expect(await api.leadCount()).toBe(500); // o lote 2 NUNCA foi enviado
    await expect(importDialog(page).getByText(/Não processado/).first()).toBeVisible();
    await batches.stop();
    await importDialog(page).getByRole("button", { name: "Retomar importação" }).click();
    await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 60_000 });
    expect(await uniquePhones(api)).toEqual({ total: 1000, unique: 1000 });
  });

  test("recarregar a página no meio e reenviar a MESMA planilha retoma sem duplicar (idempotência do servidor)", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const tenant = tenantOf(testInfo, 35);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    // lote 1 passa; lote 2 cai (3 tentativas) → "Falhou"
    const faults = await injectFaults(page, (_, key) => (key.endsWith("-0000") ? { kind: "pass" } : { kind: "abort-before" }));
    await chooseFile(page, file(validCsv(1000, 54)), 1000);
    await importDialog(page).getByLabel("Se o telefone já existir").selectOption("duplicate");
    await importButton(page).click();
    await expect(stateText(page, "Falhou")).toBeVisible({ timeout: 60_000 });
    expect(await api.leadCount()).toBe(500);
    const firstKey = faults.log.find((l) => l.fault === "pass")!.key;
    await faults.stop();
    // "fecha a aba": recarrega e refaz o fluxo com a mesma planilha e os mesmos parâmetros
    await page.reload();
    await openPipeline(page);
    await openImport(page);
    const replays: boolean[] = [];
    page.on("response", (r) => {
      if (r.url().endsWith("/leads/bulk-import")) replays.push(r.headers()["idempotent-replayed"] === "true");
    });
    await chooseFile(page, file(validCsv(1000, 54)), 1000);
    await importDialog(page).getByLabel("Se o telefone já existir").selectOption("duplicate");
    await importButton(page).click();
    await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 60_000 });
    await expect(importDialog(page).getByText(/retomou uma importação interrompida/)).toBeVisible();
    expect(replays).toEqual([true, false]); // lote 1: reconhecido pelo servidor (não regravado); lote 2: gravado agora
    expect(await uniquePhones(api)).toEqual({ total: 1000, unique: 1000 });
    expect(firstKey).toMatch(/^imp-.*-0000$/);
  });

  test("sair da tela no meio da importação: ela para depois do lote em voo e depois pode ser retomada", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 59);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    const held = await holdBatches(page);
    await chooseFile(page, file(validCsv(1500, 18)), 1500);
    await importDialog(page).getByLabel("Se o telefone já existir").selectOption("duplicate");
    await importButton(page).click();
    const first = await held.next();
    // navegação interna (SPA) para outra rota enquanto o lote 1 está em voo
    await page.evaluate(() => {
      window.history.pushState({}, "", "/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page).toHaveURL(/dashboard/);
    await first.release();
    // nenhum lote novo pode sair depois de a tela ter sido deixada (espera deliberada: provar a AUSÊNCIA)
    await page.waitForTimeout(2500);
    await held.stop();
    expect(await api.leadCount()).toBe(500);
    // voltar e refazer com a mesma planilha retoma sem regravar o lote 1
    await openPipeline(page);
    await openImport(page);
    await chooseFile(page, file(validCsv(1500, 18)), 1500);
    await importDialog(page).getByLabel("Se o telefone já existir").selectOption("duplicate");
    await importButton(page).click();
    await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 90_000 });
    expect(await uniquePhones(api)).toEqual({ total: 1500, unique: 1500 });
  });

  test("retomada VENCIDA (início há mais de 20 h): bloqueada, nada é reenviado e a pessoa é avisada", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 36);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    const faults = await injectFaults(page, (_, key) => (key.endsWith("-0000") ? { kind: "pass" } : { kind: "abort-before" }));
    await chooseFile(page, file(validCsv(1000, 55)), 1000);
    await importDialog(page).getByLabel("Se o telefone já existir").selectOption("duplicate");
    await importButton(page).click();
    await expect(stateText(page, "Falhou")).toBeVisible({ timeout: 60_000 });
    await faults.stop();
    await page.reload();
    // envelhece o registro guardado: como se a 1ª tentativa fosse de 25 h atrás
    await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (!key.startsWith("gsm.leadImport.")) continue;
        const record = JSON.parse(localStorage.getItem(key)!);
        localStorage.setItem(key, JSON.stringify({ ...record, startedAt: Date.now() - 25 * 3600 * 1000 }));
      }
    });
    await openPipeline(page);
    await openImport(page);
    let sent = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/leads/bulk-import")) sent++;
    });
    await chooseFile(page, file(validCsv(1000, 55)), 1000);
    await importDialog(page).getByLabel("Se o telefone já existir").selectOption("duplicate");
    await importButton(page).click();
    const alert = importDialog(page).getByRole("alert").filter({ hasText: "venceu" });
    await expect(alert).toContainText("podem já ter sido importados");
    await expect(alert).toContainText("Nada foi reenviado");
    expect(sent).toBe(0);
    expect(await api.leadCount()).toBe(500);
    // a recuperação NÃO oferece "duplicar": a estratégia vira "ignorar"
    await alert.getByRole("button", { name: "Preparar nova importação" }).click();
    await expect(importDialog(page).getByLabel("Se o telefone já existir")).toHaveValue("skip");
    await importButton(page).click();
    await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 60_000 });
    // os 500 já gravados foram IGNORADOS (não duplicados); os outros 500 entraram
    expect(await uniquePhones(api)).toEqual({ total: 1000, unique: 1000 });
  });
});

test.describe("Importação — falhas e recuperação", () => {
  const rows = (n: number, prefix: number) => validCsv(n, prefix);

  test("falha no PRIMEIRO lote: nada gravado, 'Falhou' e retomar conclui", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 37);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    const faults = await injectFaults(page, () => ({ kind: "status", status: 403, body: { detail: "Sem permissão" } }));
    await chooseFile(page, file(rows(1000, 56)), 1000);
    await importButton(page).click();
    await expect(stateText(page, "Falhou")).toBeVisible({ timeout: 30_000 });
    expect(faults.log).toHaveLength(1); // 403 não é repetido
    expect(await api.leadCount()).toBe(0);
    await expect(importDialog(page).getByRole("alert").filter({ hasText: "Sem permissão" })).toContainText("lote 1 de 2");
    await faults.stop();
    await importDialog(page).getByRole("button", { name: "Retomar importação" }).click();
    await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 60_000 });
    expect(await uniquePhones(api)).toEqual({ total: 1000, unique: 1000 });
  });

  test("falha no SEGUNDO lote: o primeiro permanece, o relatório marca os 500 não confirmados com os números originais", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 38);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    const faults = await injectFaults(page, (_, key) =>
      key.endsWith("-0000") ? { kind: "pass" } : { kind: "status", status: 403, body: { detail: "Bloqueado" } },
    );
    await chooseFile(page, file(rows(1000, 57)), 1000);
    await importButton(page).click();
    await expect(stateText(page, "Falhou")).toBeVisible({ timeout: 60_000 });
    expect(await api.leadCount()).toBe(500);
    const counts = await summaryNumbers(page);
    expect(counts["Criados"]).toBe(500);
    expect(counts["Não confirmadas"]).toBe(500);
    const list = importDialog(page).getByLabel("Linhas que precisam de atenção");
    await expect(list).toContainText("Linha 502 (Lead 00500) — Erro de processamento");
    await faults.stop();
  });

  test("falha no ÚLTIMO lote (3 lotes): os dois primeiros permanecem e retomar grava só o terceiro", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 39);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    const faults = await injectFaults(page, (_, key) =>
      key.endsWith("-0002") ? { kind: "status", status: 403 } : { kind: "pass" },
    );
    await chooseFile(page, file(rows(1200, 58)), 1200);
    await importDialog(page).getByLabel("Se o telefone já existir").selectOption("duplicate");
    await importButton(page).click();
    await expect(stateText(page, "Falhou")).toBeVisible({ timeout: 90_000 });
    expect(await api.leadCount()).toBe(1000);
    await faults.stop();
    await importDialog(page).getByRole("button", { name: "Retomar importação" }).click();
    await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 60_000 });
    expect(await uniquePhones(api)).toEqual({ total: 1200, unique: 1200 });
  });

  test("TIMEOUT depois de gravar (a resposta se perde): o reenvio com a mesma chave NÃO duplica, nem com a estratégia 'duplicar'", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 40);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    // 1ª tentativa do lote 1: o servidor GRAVA e confirma, mas a resposta é derrubada
    const faults = await injectFaults(page, (attempt) => (attempt === 1 ? { kind: "abort-after" } : { kind: "pass" }));
    await chooseFile(page, file(rows(500, 59)), 500);
    await importDialog(page).getByLabel("Se o telefone já existir").selectOption("duplicate");
    await importButton(page).click();
    await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 60_000 });
    expect(faults.log.map((l) => l.fault)).toEqual(["abort-after", "pass"]);
    expect(faults.log[0]!.key).toBe(faults.log[1]!.key); // MESMA chave
    expect(faults.log[1]!.replayed).toBe(true); // o servidor reconheceu e devolveu o lote já gravado
    expect(await uniquePhones(api)).toEqual({ total: 500, unique: 500 });
    expect((await summaryNumbers(page))["Criados"]).toBe(500); // contado UMA vez
  });

  test("falha ANTES de gravar (conexão cai): o reenvio grava o lote uma única vez", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 41);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    const faults = await injectFaults(page, (attempt) => (attempt <= 2 ? { kind: "abort-before" } : { kind: "pass" }));
    await chooseFile(page, file(rows(500, 60)), 500);
    await importDialog(page).getByLabel("Se o telefone já existir").selectOption("duplicate");
    await importButton(page).click();
    await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 60_000 });
    expect(faults.log.map((l) => l.fault)).toEqual(["abort-before", "abort-before", "pass"]);
    expect(faults.log[2]!.replayed).toBe(false);
    expect(await uniquePhones(api)).toEqual({ total: 500, unique: 500 });
  });

  for (const [code, retried, tenantNo] of [
    [429, true, 42],
    [500, true, 43],
    [409, true, 44],
    [422, false, 45],
  ] as const) {
    test(`resposta ${code}: ${retried ? "é repetida com a mesma chave e conclui" : "não é repetida; falha com mensagem"}`, async ({ page }, testInfo) => {
      const tenant = tenantOf(testInfo, tenantNo);
      const api = await Api.login(tenant);
      await begin(page, tenant);
      const faults = await injectFaults(page, (attempt) =>
        attempt === 1
          ? { kind: "status", status: code, headers: code === 429 ? { "Retry-After": "1" } : ({} as Record<string, string>) }
          : { kind: "pass" },
      );
      await chooseFile(page, file(rows(10, 61)), 10);
      await importButton(page).click();
      if (retried) {
        await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 60_000 });
        expect(faults.log).toHaveLength(2);
        expect(faults.log[0]!.key).toBe(faults.log[1]!.key);
        expect(await uniquePhones(api)).toEqual({ total: 10, unique: 10 });
      } else {
        await expect(stateText(page, "Falhou")).toBeVisible({ timeout: 30_000 });
        expect(faults.log).toHaveLength(1);
        expect(await api.leadCount()).toBe(0);
      }
    });
  }
});

test.describe("Importação — dados, relatório e segurança", () => {
  test("dados mistos: válidos, inválidos, duplicados no arquivo, colunas desconhecidas, vazios, UTF-8 e caracteres especiais", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 46);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    const csv = toCsv([
      ["Nome", "Telefone", "Cidade", "Estado (UF)", "Origem", "Coluna Estranha"],
      ["José da Conceição", "11977770001", "São Paulo", "SP", "whatsapp", "zzz"],
      ["Ana, \"a Boa\"", "11977770002", "Brasília", "DF", "Origem Inexistente", ""],
      ["", "11977770003", "", "", "", ""], // sem nome
      ["Estado Inválido", "11977770004", "Rio", "RJX", "", ""], // UF com 3 letras
      ["Repetido No Arquivo", "11977770005", "", "", "", ""],
      ["Repetido No Arquivo 2", "11977770005", "", "", "", ""], // mesmo telefone na mesma planilha
      ["Linha\ncom quebra", "11977770006", "", "", "", ""], // quebra de linha dentro de aspas
      ["Telefone Curto", "123", "", "", "", ""],
      ["Ç Ã Ü — emoji 😀", "11977770007", "", "", "", ""],
    ]);
    await chooseFile(page, file(csv), 9);
    const preview = importDialog(page).getByRole("region", { name: "Pré-importação" });
    await expect(preview).toContainText("Válidas: 7");
    await expect(preview).toContainText("Inválidas: 2");
    await expect(preview).toContainText("origem desconhecida");
    await expect(preview).toContainText("telefone curto");
    await importButton(page).click();
    await expect(stateText(page, "Concluído com erros")).toBeVisible({ timeout: 30_000 });
    const counts = await summaryNumbers(page);
    expect(counts["Criados"]).toBe(6);
    expect(counts["Duplicados ignorados"]).toBe(1); // o 2º "11977770005" na mesma planilha
    expect(counts["Falha de validação"]).toBe(2);
    const list = importDialog(page).getByLabel("Linhas que precisam de atenção");
    await expect(list).toContainText("Linha 4 (sem nome) — Falha de validação: Nome é obrigatório");
    await expect(list).toContainText("Linha 5 (Estado Inválido) — Falha de validação: Estado (UF) deve ter 2 letras");
    await expect(list).toContainText("Linha 7 (Repetido No Arquivo 2) — Duplicado ignorado");
    const names = (await api.leads()).map((l) => l.name).sort();
    expect(names).toContain("José da Conceição");
    expect(names).toContain('Ana, "a Boa"');
    expect(names).toContain("Linha\ncom quebra");
    expect(names).toContain("Ç Ã Ü — emoji 😀");
  });

  test("linha 'venenosa' (valor maior que a coluna do banco): vira erro DA LINHA e as demais entram", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 56);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    const huge = "n".repeat(4001);
    await chooseFile(
      page,
      file(toCsv([["Nome", "Telefone", "Observações"], ["Boa 1", "11977774441", ""], ["Venenosa", "11977774442", huge], ["Boa 2", "11977774443", ""]])),
      3,
    );
    await expect(importDialog(page).getByRole("region", { name: "Pré-importação" })).toContainText("Inválidas: 1");
    await importButton(page).click();
    await expect(stateText(page, "Concluído com erros")).toBeVisible();
    await expect(importDialog(page).getByLabel("Linhas que precisam de atenção")).toContainText(
      "Linha 3 (Venenosa) — Falha de validação: Observações tem 4001 caracteres; o máximo é 4000.",
    );
    expect((await api.leads()).map((l) => l.name).sort()).toEqual(["Boa 1", "Boa 2"]);
    // defesa em profundidade: um cliente que NÃO valide (API direta) também não derruba o lote
    const pipeline = await api.defaultPipeline();
    const direct = await api.importBatch(
      [{ name: "Direta Boa", phone: "11977774444" }, { name: "Direta Venenosa", company: "c".repeat(201) }],
      { pipelineId: pipeline.id, stageId: pipeline.stages[0]!.id, ownerId: (await api.me()).id, key: "poison-direct" },
    );
    expect(direct.status).toBe(200);
    expect(direct.body.created).toBe(1);
    expect(direct.body.errors).toBe(1);
    expect(direct.body.rows.find((r) => r.outcome === "error")!.reason).toBe("validation");
  });

  test("colunas desconhecidas são ignoradas; mapeamento manual define o nome", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 47);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    await chooseFile(page, file(toCsv([["Contato", "Fone", "Outra"], ["Maria", "11977771111", "x"]])), 1);
    await expect(importDialog(page).getByText(/Nome é obrigatório: associe uma coluna/)).toBeVisible();
    await expect(importButton(page)).toBeDisabled();
    await importDialog(page).getByLabel("Campo do lead para a coluna Contato").selectOption("name");
    await importDialog(page).getByLabel("Campo do lead para a coluna Fone").selectOption("phone");
    await expect(importButton(page)).toBeEnabled();
    await importButton(page).click();
    await expect(stateText(page, "Concluído")).toBeVisible();
    const leads = await api.leads();
    expect(leads.map((l) => [l.name, l.phone])).toEqual([["Maria", "11977771111"]]);
  });

  test("relatório CSV baixado: BOM, número original da linha e fórmulas neutralizadas", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 48);
    await begin(page, tenant);
    await chooseFile(
      page,
      file(toCsv([["Nome", "Telefone", "Estado (UF)"], ["=HYPERLINK(\"http://x\")", "11977772222", "SAO"], ["+cmd|calc", "11977772223", "ABC"], ["Normal", "11977772224", "SP"]])),
      3,
    );
    await importButton(page).click();
    await expect(stateText(page, "Concluído com erros")).toBeVisible();
    const download = page.waitForEvent("download");
    await importDialog(page).getByRole("button", { name: "Baixar relatório (CSV)" }).click();
    const saved = await download;
    expect(saved.suggestedFilename()).toBe("relatorio-importacao.csv");
    const content = readFileSync(await saved.path(), "utf8");
    expect(content.charCodeAt(0)).toBe(0xfeff);
    expect(content).toContain("Linha,Nome,Resultado,Motivo");
    expect(content).toContain(`2,"'=HYPERLINK(""http://x"")",Falha de validação`);
    expect(content).toContain("3,'+cmd|calc,Falha de validação");
    expect(content).not.toContain("Normal"); // sucesso não entra no relatório de atenção
    for (const line of content.split("\r\n").slice(1).filter(Boolean)) {
      const name = line.split(",")[1] ?? "";
      expect(/^["']?[=+@-]/.test(name) && !name.startsWith("'") && !name.startsWith(`"'`)).toBe(false);
    }
  });

  test("fórmulas importadas como nome são exportadas neutralizadas pelo servidor", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 49);
    const api = await Api.login(tenant);
    await begin(page, tenant);
    await chooseFile(page, file(toCsv([["Nome", "Telefone"], ["=1+1", "11977773333"], ["@SUM(A1)", "11977773334"]])), 2);
    await importButton(page).click();
    await expect(stateText(page, "Concluído")).toBeVisible();
    const exported = await fetch(`http://127.0.0.1:8110/api/v1/leads/export`, { headers: { Authorization: `Bearer ${api.token}` } });
    const text = await exported.text();
    expect(text).toContain("'=1+1");
    expect(text).toContain("'@SUM(A1)");
  });

  test("vendedor importa sempre para si e não vê o seletor de responsável", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 50);
    await loginUi(page, tenant, "vendedor");
    await openPipeline(page);
    await openImport(page);
    await chooseFile(page, file(validCsv(3, 62)), 3);
    await expect(importDialog(page).getByLabel("Responsável pelos leads novos")).toHaveCount(0);
    await importButton(page).click();
    await expect(stateText(page, "Concluído")).toBeVisible();
    const vendedor = await Api.login(tenant, "vendedor");
    const me = await vendedor.me();
    expect((await vendedor.leads()).every((l) => l.owner_id === me.id)).toBe(true);
  });
});

test.describe("Importação — concorrência entre importações independentes (R1)", () => {
  test("duas ABAS do mesmo usuário importando a mesma planilha (ignorar): cada telefone existe UMA vez", async ({ browser }, testInfo) => {
    test.setTimeout(300_000);
    const tenant = tenantOf(testInfo, 51);
    const api = await Api.login(tenant);
    const csv = validCsv(600, 63);
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    await Promise.all(pages.map((p) => begin(p, tenant)));
    await Promise.all(pages.map((p) => chooseFile(p, file(csv), 600)));
    await Promise.all(pages.map((p) => importButton(p).click()));
    await Promise.all(pages.map((p) => expect(stateText(p, "Concluído")).toBeVisible({ timeout: 240_000 })));
    expect(await uniquePhones(api)).toEqual({ total: 600, unique: 600 });
    const created = await Promise.all(pages.map(async (p) => (await summaryNumbers(p))["Criados"] ?? 0));
    expect(created[0]! + created[1]!).toBe(600); // soma dos relatórios = realidade, sem criar a mais
    await Promise.all(contexts.map((c) => c.close()));
  });

  test("dois USUÁRIOS do mesmo tenant (admin e gestor) importando a mesma planilha: sem duplicar", async ({ browser }, testInfo) => {
    test.setTimeout(300_000);
    const tenant = tenantOf(testInfo, 52);
    const api = await Api.login(tenant);
    const csv = validCsv(600, 64);
    const [ctxA, ctxB] = await Promise.all([browser.newContext(), browser.newContext()]);
    const [a, b] = await Promise.all([ctxA.newPage(), ctxB.newPage()]);
    await loginUi(a, tenant, "admin");
    await loginUi(b, tenant, "gestor");
    await Promise.all([a, b].map(async (p) => { await openPipeline(p); await openImport(p); await chooseFile(p, file(csv), 600); }));
    await Promise.all([a, b].map((p) => importButton(p).click()));
    await Promise.all([a, b].map((p) => expect(stateText(p, "Concluído")).toBeVisible({ timeout: 240_000 })));
    expect(await uniquePhones(api)).toEqual({ total: 600, unique: 600 });
    await Promise.all([ctxA.close(), ctxB.close()]);
  });

  test("estratégia 'duplicar' continua permitindo duplicação INTENCIONAL entre importações simultâneas", async ({ browser }, testInfo) => {
    test.setTimeout(300_000);
    const tenant = tenantOf(testInfo, 53);
    const api = await Api.login(tenant);
    const csv = validCsv(100, 65);
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    await Promise.all(pages.map((p) => begin(p, tenant)));
    await Promise.all(pages.map(async (p) => { await chooseFile(p, file(csv), 100); await importDialog(p).getByLabel("Se o telefone já existir").selectOption("duplicate"); }));
    await Promise.all(pages.map((p) => importButton(p).click()));
    await Promise.all(pages.map((p) => expect(stateText(p, "Concluído")).toBeVisible({ timeout: 120_000 })));
    expect(await uniquePhones(api)).toEqual({ total: 200, unique: 100 });
    await Promise.all(contexts.map((c) => c.close()));
  });

  test("tenants diferentes importando ao mesmo tempo não se bloqueiam nem se enxergam", async ({ browser }, testInfo) => {
    test.setTimeout(300_000);
    const [t1, t2] = [tenantOf(testInfo, 54), tenantOf(testInfo, 55)];
    const csv = validCsv(300, 66);
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    await Promise.all([begin(pages[0]!, t1), begin(pages[1]!, t2)]);
    await Promise.all(pages.map((p) => chooseFile(p, file(csv), 300)));
    await Promise.all(pages.map((p) => importButton(p).click()));
    await Promise.all(pages.map((p) => expect(stateText(p, "Concluído")).toBeVisible({ timeout: 120_000 })));
    for (const t of [t1, t2]) expect(await uniquePhones(await Api.login(t))).toEqual({ total: 300, unique: 300 }); // mesmo telefone nos dois: nenhum é "duplicado" do outro
    await Promise.all(contexts.map((c) => c.close()));
  });
});

// Mantém a referência usada só para documentação de fixtures.
void phoneOf;
