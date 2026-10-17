// Fase 0 (rede de segurança do redesign) — apoio EXCLUSIVO de testes. Nada aqui é importado
// pelo código de produção. Fixtures neutras (dados fictícios) + renderização com os mesmos
// contextos da aplicação (autenticação, toasts e roteador). Os serviços de API são
// substituídos em cada spec com `vi.mock`: nenhum teste chama rede, n8n ou WhatsApp.
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "../../../src/contexts/AuthContext";
import { ToastProvider } from "../../../src/contexts/ToastProvider";
import { ToastHost } from "../../../src/components/common/ToastHost";
import type { AuthUser } from "../../../src/types/auth";
import type { Lead, LeadMessageTemplate } from "../../../src/types/lead";
import type { Pipeline, PipelineStage } from "../../../src/types/pipeline";
import type { Task } from "../../../src/types/task";
import { invalidateShared } from "../../../src/utils/requestCache";

export function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u-admin",
    email: "admin@example.com",
    name: "Ana Admin",
    role: "admin",
    mustChangePassword: false,
    accountId: "acc-1",
    tenantId: "t1",
    isPlatformStaff: false,
    features: { crm: true, dashboard: true, reports: true },
    ...overrides,
  };
}

export const ADMIN = makeUser();
export const GESTOR = makeUser({ id: "u-gestor", name: "Gil Gestor", role: "gestor" });
export const VENDEDOR = makeUser({ id: "u-vend", name: "Vera Vendedora", role: "vendedor" });
export const STAFF = makeUser({ id: "u-staff", name: "Sam Staff", isPlatformStaff: true });
export const SUPPORT_READ_ONLY = makeUser({
  impersonation: {
    sessionId: "s1",
    mode: "read_only",
    expiresAt: "2099-01-01T00:00:00Z",
    reason: "teste",
  },
});

export function makeStage(id: string, label: string, order: number, extra: Partial<PipelineStage> = {}): PipelineStage {
  return { id, label, color: "#4aa3ff", order, isWon: false, isLost: false, ...extra };
}

export const STAGES: PipelineStage[] = [
  makeStage("s-novo", "Novo", 0),
  makeStage("s-contato", "Em contato", 1),
  makeStage("s-ganho", "Ganho", 2, { isWon: true }),
  makeStage("s-perdido", "Perdido", 3, { isLost: true }),
];

export function makePipeline(overrides: Partial<Pipeline> = {}): Pipeline {
  return {
    id: "p1",
    tenantId: "t1",
    name: "Comercial",
    color: "#4aa3ff",
    isDefault: true,
    active: true,
    stages: STAGES,
    ...overrides,
  };
}

export function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    tenantId: "t1",
    name: "Maria Souza",
    company: "Clínica Sol",
    role: "",
    phone: "(11) 98765-4321",
    whatsapp: "",
    phoneNormalized: "5511987654321",
    email: "maria@example.com",
    city: "Campinas",
    state: "SP",
    notes: "",
    pipelineId: "p1",
    stageId: "s-novo",
    ownerId: "u-admin",
    value: 1800,
    probability: 35,
    origin: "whatsapp",
    tags: [],
    lastComment: null,
    createdAt: "2026-10-10T12:00:00Z",
    updatedAt: "2026-10-10T12:00:00Z",
    lastInteractionAt: null,
    ...overrides,
  };
}

export function makeTemplate(overrides: Partial<LeadMessageTemplate> = {}): LeadMessageTemplate {
  return {
    id: "tpl1",
    stageId: "s-novo",
    origin: null,
    message: "Olá {nome}, tudo bem?",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task1",
    leadId: "l1",
    leadName: "Maria Souza",
    title: "Enviar proposta",
    priority: "media",
    done: false,
    dueAt: "2099-01-01T12:00:00Z",
    assigneeUserId: "u-admin",
    assigneeName: "Ana Admin",
    completedAt: null,
    ...overrides,
  };
}

/** Promessa controlada à mão: permite simular respostas fora de ordem. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function page<T>(items: T[], total = items.length, pageNumber = 1) {
  return { items, total, page: pageNumber, pageSize: 25 };
}

export interface RenderOptions {
  user?: AuthUser | null;
  tenantId?: string;
  route?: string;
}

/** Mesmos contextos da aplicação, sem mexer em nenhum componente de produção. */
export function renderApp(ui: ReactNode, options: RenderOptions = {}) {
  invalidateShared(); // o cache de leituras compartilhadas não pode vazar entre testes
  const { user = ADMIN, tenantId = "t1", route = "/" } = options;
  const value = {
    user,
    loading: false,
    currentTenantId: tenantId,
    availableTenants: [],
  } as unknown as AuthContextValue;
  const tree = (current: AuthContextValue, content: ReactNode) => (
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={current}>
        <ToastProvider>
          {content}
          <ToastHost />
        </ToastProvider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
  const utils = render(tree(value, ui));
  return {
    ...utils,
    /** Troca de tenant/usuário no MESMO componente montado (simula "trocar de empresa"). */
    rerenderAs(next: RenderOptions & { content?: ReactNode }) {
      const nextValue = {
        ...value,
        user: next.user === undefined ? user : next.user,
        currentTenantId: next.tenantId ?? tenantId,
      } as unknown as AuthContextValue;
      utils.rerender(tree(nextValue, next.content ?? ui));
    },
  };
}
