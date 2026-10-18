// E2E do painel do lead (Prompt 07) contra a API real: abrir, editar, comentar, tarefas, mover,
// proteção contra perda, validação, "Ver mais" e celular. Tenants: 60/61 = @cross (3 navegadores);
// 120+ = só Chromium (ver support/env.ts).
import { expect, test, type Page } from "@playwright/test";
import { Api, phoneOf } from "./support/api";
import { column, loginUi, openPipeline } from "./support/app";
import { tenantOf } from "./support/env";

const drawer = (page: Page, name: string) => page.getByRole("dialog", { name: `Lead ${name}` });
const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function seedLead(tenant: number, name: string, extra: { company?: string; email?: string; value?: number } = {}) {
  const api = await Api.login(tenant);
  const [novo] = (await api.defaultPipeline()).stages;
  const me = await api.me();
  const lead = await api.createLead({ name, stageId: novo!.id, ownerId: me.id, phone: phoneOf(tenant, 1), ...extra });
  return { api, lead };
}

test.describe("painel do lead — fluxo comercial completo", () => {
  test("abrir, editar, salvar, comentar, criar e concluir tarefa, mover, fechar, reabrir e conferir persistência @cross", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 60);
    const { api } = await seedLead(tenant, "Maria Painel", { company: "Clínica Sol", email: "maria@example.com", value: 1500 });
    await loginUi(page, tenant);
    await openPipeline(page);
    await page.getByRole("button", { name: "Abrir Maria Painel" }).click();
    const d = drawer(page, "Maria Painel");
    await expect(d).toBeVisible();
    // as 8 perguntas: quem, etapa, responsável, valor, contato, ações
    await expect(d.getByRole("heading", { name: "Maria Painel" })).toBeVisible();
    await expect(d.getByRole("region", { name: "Resumo comercial" })).toContainText("R$ 1.500");
    await expect(d.getByRole("region", { name: "Contato" })).toContainText("maria@example.com");
    await expect(d.getByRole("group", { name: "Ações rápidas" })).toBeVisible();

    // editar + salvar
    await d.getByRole("button", { name: /Editar/ }).click();
    await d.getByLabel("Empresa").fill("Clínica Nova");
    await d.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Lead atualizado com sucesso")).toBeVisible();
    await expect(d.getByText("Clínica Nova")).toBeVisible();

    // comentar
    await d.getByLabel("Novo comentário").fill("Cliente pediu proposta");
    await d.getByRole("button", { name: "Comentar" }).click();
    await expect(d.getByText("Cliente pediu proposta")).toBeVisible();

    // tarefa: criar → próxima ação → concluir
    await d.getByRole("button", { name: "+ Nova tarefa" }).click();
    const task = page.getByRole("dialog", { name: "Nova tarefa" });
    await task.getByLabel(/Título/).fill("Enviar proposta");
    await task.getByRole("button", { name: "Criar tarefa" }).click();
    await expect(d.getByText("Próxima ação")).toBeVisible();
    await expect(d.getByRole("region", { name: "Tarefas" }).getByText("Enviar proposta")).toBeVisible();
    await d.getByRole("button", { name: "Concluir tarefa" }).click();
    await expect(d.getByText(/Sem próxima ação/)).toBeVisible();

    // mover de etapa (grava na hora)
    await d.getByLabel("Etapa").selectOption({ label: "Em contato" });
    await expect(page.getByText("Movido para Em contato")).toBeVisible();

    // fechar, reabrir, conferir
    await d.getByRole("button", { name: "Fechar lead" }).click();
    await expect(d).toHaveCount(0);
    await expect(column(page, "Em contato").getByRole("button", { name: "Abrir Maria Painel" })).toBeVisible();
    await column(page, "Em contato").getByRole("button", { name: "Abrir Maria Painel" }).click();
    await expect(d.getByText("Clínica Nova")).toBeVisible();
    await expect(d.getByText("Cliente pediu proposta")).toBeVisible();
    await expect(d.getByLabel("Etapa")).toHaveValue(/.+/);
    const leads = await api.leads();
    expect(leads.map((l) => l.company)).toEqual(["Clínica Nova"]);
  });

  test("fechar com edição não salva pede confirmação; Cancelar mantém o rascunho e Descartar fecha sem gravar", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 120);
    const { api } = await seedLead(tenant, "Rascunho Um");
    await loginUi(page, tenant);
    await openPipeline(page);
    await page.getByRole("button", { name: "Abrir Rascunho Um" }).click();
    const d = drawer(page, "Rascunho Um");
    await d.getByRole("button", { name: /Editar/ }).click();
    await d.getByLabel("Nome").fill("Outro Nome");
    await page.keyboard.press("Escape"); // Esc não descarta
    await expect(d).toBeVisible();
    await d.getByRole("button", { name: "Fechar lead" }).click();
    const confirm = page.getByRole("dialog", { name: "Descartar alterações?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(d.getByLabel("Nome")).toHaveValue("Outro Nome");
    await d.getByRole("button", { name: "Fechar lead" }).click();
    await page.getByRole("dialog", { name: "Descartar alterações?" }).getByRole("button", { name: "Descartar" }).click();
    await expect(d).toHaveCount(0);
    expect((await api.leads()).map((l) => l.name)).toEqual(["Rascunho Um"]);
  });

  test("marcar como perdido pede confirmação (D-03): recusar não move, confirmar move", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 121);
    const { api } = await seedLead(tenant, "Perdido Talvez");
    await loginUi(page, tenant);
    await openPipeline(page);
    await page.getByRole("button", { name: "Abrir Perdido Talvez" }).click();
    const d = drawer(page, "Perdido Talvez");
    await d.getByLabel("Etapa").selectOption({ label: "Perdido (perdido)" });
    const confirm = page.getByRole("dialog", { name: "Marcar como perdido?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(d.getByLabel("Etapa")).not.toHaveValue(/perd/i);
    expect(await api.leadCount({ stage_id: (await api.defaultPipeline()).stages[3]!.id })).toBe(0);
    await d.getByLabel("Etapa").selectOption({ label: "Perdido (perdido)" });
    await page.getByRole("dialog", { name: "Marcar como perdido?" }).getByRole("button", { name: "Marcar como perdido" }).click();
    await expect(page.getByText("Negócio marcado como perdido")).toBeVisible();
    await expect.poll(async () => api.leadCount({ stage_id: (await api.defaultPipeline()).stages[3]!.id })).toBe(1);
  });

  test("validação ao lado do campo: e-mail inválido bloqueia o salvamento e leva o foco ao campo", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 122);
    await seedLead(tenant, "Valida Email");
    await loginUi(page, tenant);
    await openPipeline(page);
    await page.getByRole("button", { name: "Abrir Valida Email" }).click();
    const d = drawer(page, "Valida Email");
    await d.getByRole("button", { name: /Editar/ }).click();
    await d.getByLabel("E-mail", { exact: true }).fill("sem-arroba");
    await d.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(d.getByText(/Informe um e-mail válido/)).toBeVisible();
    await expect(d.getByLabel("E-mail", { exact: true })).toBeFocused();
    await expect(d.getByLabel("E-mail", { exact: true })).toHaveAttribute("aria-invalid", "true");
  });

  test("timeline longa: 'Ver mais' revela o restante sem perder eventos", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 123);
    const { api, lead } = await seedLead(tenant, "Historia Longa");
    for (let i = 1; i <= 12; i++) await api.comment(lead.id, `Comentário ${String(i).padStart(2, "0")}`);
    await loginUi(page, tenant);
    await openPipeline(page);
    await page.getByRole("button", { name: "Abrir Historia Longa" }).click();
    const d = drawer(page, "Historia Longa");
    const items = d.getByRole("region", { name: "Atividades" }).getByRole("listitem");
    await expect(items).toHaveCount(10);
    await d.getByRole("button", { name: /Ver mais \(3\)/ }).click();
    await expect(items).toHaveCount(13); // 12 comentários + criação do lead
    await expect(d.getByText("Comentário 12")).toBeVisible();
    await expect(d.getByText("Comentário 01")).toBeVisible();
  });

  test("celular 390×844: painel sem rolagem horizontal, ações à vista e rodapé de edição fixo", async ({ page }, testInfo) => {
    const tenant = tenantOf(testInfo, 124);
    await seedLead(tenant, "Cliente Celular", { company: "Empresa com um nome bem comprido para testar quebra de linha", email: "cliente.celular.com.nome.longo@example.com" });
    await page.setViewportSize({ width: 390, height: 844 });
    await loginUi(page, tenant);
    await openPipeline(page);
    await page.getByRole("button", { name: "Abrir Cliente Celular" }).click();
    const d = drawer(page, "Cliente Celular");
    await expect(d).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
    expect((await d.boundingBox())!.width).toBeLessThanOrEqual(390);
    await expect(d.getByRole("button", { name: "Fechar lead" })).toBeVisible();
    await d.getByRole("button", { name: /Editar/ }).click();
    const save = d.getByRole("button", { name: "Salvar alterações" });
    await expect(save).toBeInViewport(); // rodapé fixo: não precisa rolar para salvar
    await d.getByLabel("Notas").scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    expect(await horizontalOverflow(page)).toBe(0);
  });
});

test.describe("criar lead e comentar logo em seguida (regressão do 404)", () => {
  // eslint-disable-next-line no-empty-pattern
  test("sem 404 mesmo com várias criações simultâneas, cada comentário por outra conexão", async ({}, testInfo) => {
    const tenant = tenantOf(testInfo, 125);
    const creator = await Api.login(tenant);
    const commenter = await Api.login(tenant);
    const [novo] = (await creator.defaultPipeline()).stages;
    const me = await creator.me();
    const worker = async (n: number) => {
      for (let i = 0; i < 8; i++) {
        const lead = await creator.createLead({ name: `Corrida ${n}-${i}`, stageId: novo!.id, ownerId: me.id });
        // sem repetição: um 404 aqui é falha (o helper não tenta de novo)
        await commenter.comment(lead.id, "logo em seguida");
      }
    };
    await Promise.all(Array.from({ length: 6 }, (_, n) => worker(n)));
    expect(await creator.leadCount()).toBe(48);
  });
});
