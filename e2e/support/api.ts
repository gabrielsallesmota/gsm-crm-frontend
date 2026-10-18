// Cliente HTTP mínimo para PREPARAR e CONFERIR dados direto na API real (nunca no lugar da UI
// quando o que se testa é o comportamento da tela).
import { API, email, password, type Role } from "./env";

export interface Stage {
  id: string;
  name: string;
  order: number;
  is_won: boolean;
  is_lost: boolean;
}
export interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
  stages: Stage[];
}
export interface ImportRow {
  name: string;
  phone?: string;
  company?: string;
  email?: string;
  state?: string;
  origin?: string;
}
export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: { row_index: number; outcome: string; name: string; detail: string | null; reason?: string | null }[];
}
export interface LeadDto {
  id: string;
  name: string;
  phone: string | null;
  company?: string | null;
  stage_id: string;
  owner_id: string | null;
}

export class Api {
  readonly token: string;
  readonly tenantNumber: number;
  readonly role: Role;

  private constructor(token: string, tenantNumber: number, role: Role) {
    this.token = token;
    this.tenantNumber = tenantNumber;
    this.role = role;
  }

  static async login(tenantNumber: number, role: Role = "admin"): Promise<Api> {
    const response = await fetch(`${API}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email(tenantNumber, role), password: password() }),
    });
    if (!response.ok) throw new Error(`login ${response.status}: ${await response.text()}`);
    const body = (await response.json()) as { access_token: string };
    return new Api(body.access_token, tenantNumber, role);
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; body: T; headers: Headers }> {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T, headers: response.headers };
  }

  async pipelines(): Promise<Pipeline[]> {
    return (await this.request<Pipeline[]>("GET", "/api/v1/pipelines")).body;
  }

  async defaultPipeline(): Promise<Pipeline> {
    return (await this.pipelines()).find((p) => p.is_default)!;
  }

  async me(): Promise<{ id: string; tenant_id: string }> {
    return (await this.request<{ id: string; tenant_id: string }>("GET", "/api/v1/auth/me")).body;
  }

  async importBatch(
    rows: ImportRow[],
    opts: { pipelineId: string; stageId: string; ownerId: string; strategy?: string; key?: string },
  ) {
    return this.request<ImportSummary>(
      "POST",
      "/api/v1/leads/bulk-import",
      {
        pipeline_id: opts.pipelineId,
        default_stage_id: opts.stageId,
        default_owner_id: opts.ownerId,
        dedupe_strategy: opts.strategy ?? "skip",
        rows,
      },
      opts.key ? { "Idempotency-Key": opts.key } : {},
    );
  }

  /** Semeia leads na etapa indicada, em lotes de 500 (como a tela). Estratégia "duplicar". */
  async seed(rows: ImportRow[], stageId: string): Promise<void> {
    const pipeline = await this.defaultPipeline();
    const me = await this.me();
    for (let i = 0; i < rows.length; i += 500) {
      const result = await this.importBatch(rows.slice(i, i + 500), {
        pipelineId: pipeline.id,
        stageId,
        ownerId: me.id,
        strategy: "duplicate",
      });
      if (result.status !== 200) throw new Error(`seed ${result.status}: ${JSON.stringify(result.body)}`);
    }
  }

  /** Cria um lead pela API (campos completos: valor, empresa, origem…). */
  async createLead(input: {
    name: string;
    stageId: string;
    ownerId: string;
    company?: string;
    phone?: string;
    email?: string;
    value?: number;
    origin?: string;
  }): Promise<{ id: string }> {
    const pipeline = await this.defaultPipeline();
    const created = await this.request<{ id: string }>("POST", "/api/v1/leads", {
      name: input.name,
      pipeline_id: pipeline.id,
      stage_id: input.stageId,
      owner_id: input.ownerId,
      origin: input.origin ?? "manual",
      company: input.company,
      phone: input.phone,
      email: input.email,
      expected_value: input.value,
    });
    if (created.status !== 201) throw new Error(`createLead ${created.status}: ${JSON.stringify(created.body)}`);
    return created.body;
  }

  async comment(leadId: string, text: string): Promise<void> {
    // Sem repetição em 404: "criar e comentar logo em seguida" já foi um bug real (commit depois da
    // resposta, corrigido no backend); um 404 aqui precisa falhar o teste.
    const r = await this.request("POST", `/api/v1/leads/${leadId}/comments`, { text });
    if (r.status !== 201) throw new Error(`comment ${r.status}: ${JSON.stringify(r.body)} (lead ${leadId})`);
  }

  async leadCount(filter: Record<string, string> = {}): Promise<number> {
    const query = new URLSearchParams({ page: "1", page_size: "1", ...filter }).toString();
    const result = await this.request<{ total: number }>("GET", `/api/v1/leads?${query}`);
    return result.body.total;
  }

  async leads(filter: Record<string, string> = {}): Promise<LeadDto[]> {
    const out: LeadDto[] = [];
    for (let page = 1; ; page++) {
      const query = new URLSearchParams({ page: String(page), page_size: "100", ...filter }).toString();
      const result = await this.request<{ items: LeadDto[]; total: number }>("GET", `/api/v1/leads?${query}`);
      out.push(...result.body.items);
      if (out.length >= result.body.total || result.body.items.length === 0) return out;
    }
  }
}

/** Telefones determinísticos e únicos por (prefixo, índice). */
export const phoneOf = (prefix: number, index: number): string =>
  `119${String(prefix).padStart(2, "0")}${String(index).padStart(6, "0")}`;
