// Isolamento multi-tenant, papéis e idempotência no NAVEGADOR + API reais. A UI nunca é a fronteira:
// todo teste confere também o que o SERVIDOR responde/grava.
import { expect, test } from "@playwright/test";
import { Api, phoneOf } from "./support/api";
import { cardNames, column, columnTotal, loginUi, openPipeline } from "./support/app";
import { tenantOf } from "./support/env";

const rows = (n: number, prefix: number, label = "Lead") =>
  Array.from({ length: n }, (_, i) => ({ name: `${label} ${i}`, phone: phoneOf(prefix, i) }));

test.describe("multi-tenant", () => {
  test("cada tenant enxerga só os próprios leads, mesmo com nomes e telefones IGUAIS @cross", async ({ page }, testInfo) => {
    const [a, b] = [tenantOf(testInfo, 85), tenantOf(testInfo, 86)];
    const apiA = await Api.login(a);
    const apiB = await Api.login(b);
    await apiA.seed(rows(3, 30, "Compartilhado"), (await apiA.defaultPipeline()).stages[0]!.id);
    await apiB.seed(rows(5, 30, "Compartilhado"), (await apiB.defaultPipeline()).stages[0]!.id);
    await loginUi(page, a);
    await openPipeline(page);
    expect(await columnTotal(page, "Novo")).toBe(3);
    expect(await cardNames(page, "Novo")).toHaveLength(3);
    // o mesmo vale pela API, com o token do tenant A
    expect(await apiA.leadCount()).toBe(3);
    expect(await apiB.leadCount()).toBe(5);
  });

  test("um lead de outro tenant não é lido, alterado, movido nem apagado (404)", async ({ page }, testInfo) => {
    const [a, b] = [tenantOf(testInfo, 87), tenantOf(testInfo, 88)];
    const apiA = await Api.login(a);
    const apiB = await Api.login(b);
    await apiB.seed(rows(1, 31, "Alheio"), (await apiB.defaultPipeline()).stages[0]!.id);
    const foreign = (await apiB.leads())[0]!;
    const stageA = (await apiA.defaultPipeline()).stages[1]!.id;
    expect((await apiA.request("GET", `/api/v1/leads/${foreign.id}`)).status).toBe(404);
    expect((await apiA.request("PATCH", `/api/v1/leads/${foreign.id}`, { name: "Invadido" })).status).toBe(404);
    expect((await apiA.request("PATCH", `/api/v1/leads/${foreign.id}/move`, { stage_id: stageA })).status).toBe(404);
    expect((await apiA.request("DELETE", `/api/v1/leads/${foreign.id}`)).status).toBe(404);
    expect((await apiB.leads())[0]!.name).toBe("Alheio 0");
    await loginUi(page, a);
    await openPipeline(page);
    await expect(page.getByText(/Alheio/)).toHaveCount(0);
  });

  test("importar com pipeline, etapa ou responsável de OUTRO tenant é recusado e nada é gravado", async ({ browserName: _browser }, testInfo) => {
    const [a, b] = [tenantOf(testInfo, 89), tenantOf(testInfo, 90)];
    const apiA = await Api.login(a);
    const apiB = await Api.login(b);
    const mine = await apiA.defaultPipeline();
    const theirs = await apiB.defaultPipeline();
    const myId = (await apiA.me()).id;
    const theirId = (await apiB.me()).id;
    const attempts = [
      { pipelineId: theirs.id, stageId: mine.stages[0]!.id, ownerId: myId },
      { pipelineId: mine.id, stageId: theirs.stages[0]!.id, ownerId: myId },
      { pipelineId: mine.id, stageId: mine.stages[0]!.id, ownerId: theirId },
    ];
    for (const [i, attempt] of attempts.entries()) {
      const result = await apiA.importBatch(rows(2, 32), { ...attempt, key: `cross-${i}` });
      expect([404, 422], JSON.stringify(result.body)).toContain(result.status);
    }
    expect(await apiA.leadCount()).toBe(0);
    expect(await apiB.leadCount()).toBe(0);
  });

  test("a MESMA Idempotency-Key em outro tenant ou outro usuário nunca devolve a resposta alheia", async ({ browserName: _browser }, testInfo) => {
    const [a, b] = [tenantOf(testInfo, 91), tenantOf(testInfo, 92)];
    const adminA = await Api.login(a, "admin");
    const gestorA = await Api.login(a, "gestor");
    const adminB = await Api.login(b, "admin");
    const send = async (api: Api) => {
      const pipeline = await api.defaultPipeline();
      return api.importBatch(rows(3, 33), {
        pipelineId: pipeline.id,
        stageId: pipeline.stages[0]!.id,
        ownerId: (await api.me()).id,
        key: "chave-compartilhada",
      });
    };
    const first = await send(adminA);
    const replay = await send(adminA);
    const otherUser = await send(gestorA);
    const otherTenant = await send(adminB);
    expect(first.status).toBe(200);
    expect(first.body.created).toBe(3);
    expect(replay.headers.get("idempotent-replayed")).toBe("true");
    expect(otherUser.headers.get("idempotent-replayed")).toBeNull(); // executou de verdade (viu os 3 existentes)
    expect(otherUser.body.skipped).toBe(3);
    expect(otherTenant.headers.get("idempotent-replayed")).toBeNull();
    expect(otherTenant.body.created).toBe(3); // não herdou nada do tenant A
    expect(await adminA.leadCount()).toBe(3);
    expect(await adminB.leadCount()).toBe(3);
  });
});

test.describe("papéis", () => {
  test("vendedor vê só os próprios leads; admin e gestor veem todos @cross", async ({ browser }, testInfo) => {
    const tenant = tenantOf(testInfo, 93);
    const admin = await Api.login(tenant, "admin");
    const vendedor = await Api.login(tenant, "vendedor");
    const stage = (await admin.defaultPipeline()).stages[0]!.id;
    await admin.seed(rows(4, 34, "DoAdmin"), stage);
    await vendedor.seed(rows(2, 35, "DoVendedor"), stage);
    const counts: Record<string, number> = {};
    for (const role of ["admin", "gestor", "vendedor"] as const) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginUi(page, tenant, role);
      await openPipeline(page);
      counts[role] = await columnTotal(page, "Novo");
      await context.close();
    }
    expect(counts).toEqual({ admin: 6, gestor: 6, vendedor: 2 });
  });

  test("vendedor não importa para outro responsável nem enxerga o nome de lead alheio com o mesmo telefone", async ({ browserName: _browser }, testInfo) => {
    const tenant = tenantOf(testInfo, 94);
    const admin = await Api.login(tenant, "admin");
    const vendedor = await Api.login(tenant, "vendedor");
    const pipeline = await admin.defaultPipeline();
    await admin.seed([{ name: "Segredo do Admin", phone: phoneOf(36, 1) }], pipeline.stages[0]!.id);
    const result = await vendedor.importBatch([{ name: "Tentativa", phone: phoneOf(36, 1) }], {
      pipelineId: pipeline.id,
      stageId: pipeline.stages[0]!.id,
      ownerId: (await admin.me()).id, // tenta atribuir ao admin
      strategy: "update",
      key: "papel-1",
    });
    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain("Segredo do Admin");
    expect(result.body.updated).toBe(0);
    const [only] = await admin.leads();
    expect(only!.name).toBe("Segredo do Admin"); // não foi sobrescrito
  });

  test("sem sessão: o pipeline redireciona para o login e a API recusa", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page).toHaveURL(/\/login/);
    const response = await fetch("http://127.0.0.1:8110/api/v1/leads/bulk-import", { method: "POST" });
    expect([401, 403, 422]).toContain(response.status);
  });

  test("a coluna do vendedor não tem controles de reordenar etapas", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 95);
    await loginUi(page, tenant, "vendedor");
    await openPipeline(page);
    await expect(column(page, "Novo").getByRole("button", { name: /Mover etapa/ })).toHaveCount(0);
  });
});

test.describe("limites de campo (Gate Zero — antes era HTTP 500)", () => {
  const limits: [string, number][] = [
    ["company", 200],
    ["position", 120],
    ["phone", 30],
    ["email", 255],
    ["city", 120],
    ["notes", 4000],
  ];

  test("criar e editar lead com campo acima do limite devolve 422 com campo e limite, nunca 500", async ({ browserName: _browser }, testInfo) => {
    const api = await Api.login(tenantOf(testInfo, 96));
    const pipeline = await api.defaultPipeline();
    const me = await api.me();
    const base = { name: "Limite", pipeline_id: pipeline.id, stage_id: pipeline.stages[0]!.id, owner_id: me.id, origin: "manual" };
    for (const [field, limit] of limits) {
      const value = field === "phone" ? "(11) 9".padEnd(limit + 1, "9") : "x".repeat(limit + 1);
      const created = await api.request<{ detail: { loc: string[]; msg: string }[] }>("POST", "/api/v1/leads", { ...base, [field]: value });
      expect(created.status, field).toBe(422);
      expect(created.body.detail[0]!.loc.at(-1)).toBe(field);
      expect(created.body.detail[0]!.msg).toContain(String(limit));
    }
    expect(await api.leadCount()).toBe(0);
    const ok = await api.request<{ id: string }>("POST", "/api/v1/leads", { ...base, company: "c".repeat(200) });
    expect(ok.status).toBe(201); // o limite exato continua válido
    for (const [field, limit] of limits) {
      const value = field === "phone" ? "(11) 9".padEnd(limit + 1, "9") : "x".repeat(limit + 1);
      const patched = await api.request("PATCH", `/api/v1/leads/${ok.body.id}`, { [field]: value });
      expect(patched.status, field).toBe(422);
    }
    const tooManyDigits = await api.request("PATCH", `/api/v1/leads/${ok.body.id}`, { phone: "1".repeat(30) });
    expect(tooManyDigits.status).toBe(422);
    expect(JSON.stringify(tooManyDigits.body)).toContain("dígitos demais");
    expect((await api.leads())[0]!.name).toBe("Limite"); // nada foi alterado
  });
});
