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
