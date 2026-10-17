// CRM-008 — contrato frontend × backend dos Leads: a tela depende do
// mapeamento DTO (snake_case do FastAPI) → `Lead` e dos parâmetros que a
// listagem manda. Uma mudança de nome de campo em qualquer lado quebra aqui,
// não silenciosamente na tela.
import { describe, expect, it, vi } from "vitest";
import { LeadsApiRepository } from "../../src/repositories/api/LeadsApiRepository";

const LEAD_DTO = {
  id: "lead-1",
  tenant_id: "tenant-1",
  name: "Maria Souza",
  company: null,
  position: "Sócia",
  phone: "(11) 91234-5678",
  whatsapp: null,
  phone_normalized: "5511912345678",
  email: "maria@example.com",
  city: "Campinas",
  state: "SP",
  notes: null,
  pipeline_id: "pipe-1",
  stage_id: "stage-1",
  owner_id: null,
  expected_value: null,
  probability: 40,
  origin: "instagram",
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-02T12:00:00Z",
  last_interaction_at: null,
  tags: ["tag-1"],
  last_comment: { text: "Ligou", created_at: "2026-10-02T13:00:00Z" },
};

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(
    async () =>
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function calledUrl(fetchMock: ReturnType<typeof mockFetch>): URL {
  const [input] = fetchMock.mock.calls[0] as unknown as [string];
  return new URL(input);
}

describe("LeadsApiRepository — mapeamento do DTO", () => {
  it("converte snake_case em Lead, com nulos virando valores neutros", async () => {
    mockFetch(LEAD_DTO);
    const lead = await new LeadsApiRepository().get("lead-1");
    expect(lead).toEqual({
      id: "lead-1",
      tenantId: "tenant-1",
      name: "Maria Souza",
      company: "",
      role: "Sócia",
      phone: "(11) 91234-5678",
      whatsapp: "",
      phoneNormalized: "5511912345678",
      email: "maria@example.com",
      city: "Campinas",
      state: "SP",
      notes: "",
      pipelineId: "pipe-1",
      stageId: "stage-1",
      ownerId: null,
      value: 0,
      probability: 40,
      origin: "instagram",
      tags: ["tag-1"],
      lastComment: { text: "Ligou", createdAt: "2026-10-02T13:00:00Z" },
      createdAt: "2026-10-01T12:00:00Z",
      updatedAt: "2026-10-02T12:00:00Z",
      lastInteractionAt: null,
    });
  });

  it("listagem envia os filtros com os nomes que o backend espera", async () => {
    const fetchMock = mockFetch({ items: [LEAD_DTO], total: 1, page: 2, page_size: 25 });
    const page = await new LeadsApiRepository().list({
      pipelineId: "pipe-1",
      stageId: "stage-1",
      tagId: "tag-1",
      origin: "instagram",
      search: "maria",
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
      unassigned: true,
      page: 2,
      pageSize: 25,
    });
    const url = calledUrl(fetchMock);
    expect(url.pathname).toBe("/api/v1/leads");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      pipeline_id: "pipe-1",
      stage_id: "stage-1",
      unassigned: "true",
      tag_id: "tag-1",
      origin: "instagram",
      search: "maria",
      date_from: "2026-10-01",
      date_to: "2026-10-31",
      page: "2",
      page_size: "25",
    });
    expect(page).toMatchObject({ total: 1, page: 2, pageSize: 25 });
    expect(page.items[0]?.id).toBe("lead-1");
  });

  it("filtro por responsável tem prioridade sobre 'sem responsável'", async () => {
    const fetchMock = mockFetch({ items: [], total: 0, page: 1, page_size: 50 });
    await new LeadsApiRepository().list({ ownerId: "user-1", unassigned: true });
    const params = calledUrl(fetchMock).searchParams;
    expect(params.get("owner_id")).toBe("user-1");
    expect(params.has("unassigned")).toBe(false);
  });

  it("mover envia só o stage_id para /move", async () => {
    const fetchMock = mockFetch({ ...LEAD_DTO, stage_id: "stage-2" });
    const moved = await new LeadsApiRepository().move("lead-1", "stage-2");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl(fetchMock).pathname).toBe("/api/v1/leads/lead-1/move");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ stage_id: "stage-2" });
    expect(moved.stageId).toBe("stage-2");
  });

  it("erro do backend sobe como erro (não vira lead vazio)", async () => {
    mockFetch({ detail: "Lead não encontrado" }, 404);
    await expect(new LeadsApiRepository().get("x")).rejects.toMatchObject({ status: 404 });
  });
});

describe("LeadsApiRepository — importação em lotes (Fase 1B)", () => {
  const SUMMARY_DTO = {
    total: 2,
    created: 1,
    updated: 0,
    skipped: 1,
    errors: 0,
    rows: [
      { row_index: 0, outcome: "created", name: "Ana", detail: null },
      { row_index: 1, outcome: "skipped", name: "Bia", detail: "Telefone já cadastrado", reason: "duplicate" },
    ],
  };

  it("envia o header Idempotency-Key do lote e mapeia o `reason` por linha", async () => {
    const fetchMock = mockFetch(SUMMARY_DTO);
    const out = await new LeadsApiRepository().bulkImport(
      [{ name: "Ana" }, { name: "Bia" }],
      "pipe-1",
      "stage-1",
      "user-1",
      "skip",
      "imp-abc-0003",
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("imp-abc-0003");
    expect(calledUrl(fetchMock).pathname).toBe("/api/v1/leads/bulk-import");
    expect(out.rows.map((r) => r.reason)).toEqual([null, "duplicate"]);
    expect(out.rows[1]!.rowIndex).toBe(1);
  });

  it("sem chave (uso antigo) não manda o header", async () => {
    const fetchMock = mockFetch(SUMMARY_DTO);
    await new LeadsApiRepository().bulkImport([{ name: "Ana" }], "pipe-1", "stage-1", "user-1", "skip");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).has("Idempotency-Key")).toBe(false);
  });
});
