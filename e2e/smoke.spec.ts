import { expect, test } from "@playwright/test";
import { Api, phoneOf } from "./support/api";
import { tenantOf } from "./support/env";
import { cardNames, columnTotal, loginUi, openPipeline } from "./support/app";

test("smoke: login, pipeline vazio e primeiro lead @cross", async ({ page }, testInfo) => {
  const tenant = tenantOf(testInfo, 1);
  const api = await Api.login(tenant);
  const pipeline = await api.defaultPipeline();
  await loginUi(page, tenant);
  await openPipeline(page);
  await expect(page.getByText("Seu funil ainda está vazio")).toBeVisible();
  await api.seed([{ name: "Ana Teste", phone: phoneOf(1, 1) }], pipeline.stages[0]!.id);
  await page.reload();
  await expect(page.getByRole("button", { name: "Abrir Ana Teste" })).toBeVisible();
  expect(await columnTotal(page, "Novo")).toBe(1);
  expect(await cardNames(page, "Novo")).toEqual(["Ana Teste"]);
});
