// FASE 0 — mapa de proteção das rotas da UI (F-29..F-33) e comportamento dos guards. A UI NÃO é
// fronteira de segurança (o backend recusa de qualquer jeito); estes testes impedem que o redesign
// mova uma tela para fora do seu guard. Autorização REAL: ver backend (tests/integration).
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateRouteAccess, can, type Permission } from "../../src/auth/permissions";
import { hasFeature, type TenantFeature } from "../../src/auth/features";
import { AuthContext, type AuthContextValue } from "../../src/contexts/AuthContext";
import { RequireFeature, RequirePermission } from "../../src/routes/RequirePermission";
import { router } from "../../src/routes";
import { ROUTES } from "../../src/constants/routes";
import type { AuthUser } from "../../src/types/auth";
import { ADMIN, GESTOR, STAFF, SUPPORT_READ_ONLY, VENDEDOR, makeUser } from "./support/harness";

afterEach(cleanup);

interface Guards {
  features: string[];
  permissions: string[];
}

/** Percorre o elemento de rota e coleta os guards (`RequireFeature`/`RequirePermission`) aninhados. */
function guardsOf(node: ReactNode, acc: Guards = { features: [], permissions: [] }): Guards {
  if (Array.isArray(node)) {
    node.forEach((n) => guardsOf(n, acc));
    return acc;
  }
  if (!isValidElement(node)) return acc;
  const el = node as ReactElement<{ children?: ReactNode; feature?: string; permission?: string }>;
  if (el.type === RequireFeature && el.props.feature) acc.features.push(el.props.feature);
  if (el.type === RequirePermission && el.props.permission) acc.permissions.push(el.props.permission);
  return guardsOf(el.props.children, acc);
}

interface FlatRoute {
  path?: string;
  element?: ReactNode;
  children?: FlatRoute[];
}
function flatten(routes: FlatRoute[], out: Map<string, ReactNode> = new Map()) {
  for (const r of routes) {
    if (r.path && r.element) out.set(r.path, r.element);
    if (r.children) flatten(r.children, out);
  }
  return out;
}
const table = flatten(router.routes as unknown as FlatRoute[]);
const guards = (path: string) => guardsOf(table.get(path));

// ---------------------------------------------------------------------------------------------
describe("F-32 mapa de guards por rota (o que cada tela exige)", () => {
  const expected: [string, Guards][] = [
    [ROUTES.dashboard, { features: ["dashboard"], permissions: [] }],
    [ROUTES.pipeline, { features: ["crm"], permissions: [] }],
    [ROUTES.leads, { features: ["crm"], permissions: [] }],
    [`${ROUTES.leads}/:id`, { features: ["crm"], permissions: [] }],
    [ROUTES.tarefas, { features: ["crm"], permissions: [] }],
    [ROUTES.agenda, { features: ["crm"], permissions: [] }],
    [ROUTES.relatorios, { features: ["reports"], permissions: [] }],
    [ROUTES.configuracoes, { features: [], permissions: ["settings.manage"] }],
    [ROUTES.integracoes, { features: [], permissions: ["integrations.manage"] }],
    [ROUTES.automacoes, { features: ["crm"], permissions: ["automations.view"] }],
    [ROUTES.notificacoes, { features: ["notifications"], permissions: ["notifications.view"] }],
    [ROUTES.minhasNotificacoes, { features: ["notifications"], permissions: [] }],
    [ROUTES.minhasConexoes, { features: ["calendar_task_integrations"], permissions: [] }],
    [ROUTES.conexoesRetorno, { features: ["calendar_task_integrations"], permissions: [] }],
    [ROUTES.equipe, { features: [], permissions: ["users.view"] }],
    [ROUTES.clientes, { features: ["clients"], permissions: [] }],
    [`${ROUTES.clientes}/:id`, { features: ["clients"], permissions: [] }],
    [ROUTES.sdrCampanhas, { features: [], permissions: ["platform.internal"] }],
    [ROUTES.sdrCandidates, { features: [], permissions: ["platform.internal"] }],
    [ROUTES.sdrDashboard, { features: [], permissions: ["platform.internal"] }],
    [ROUTES.sdrProspectarHoje, { features: [], permissions: ["platform.internal"] }],
    ["/sdr/*", { features: [], permissions: ["platform.internal"] }],
  ];

  it.each(expected)("%s exige exatamente os guards esperados", (path, want) => {
    expect(table.has(path), `rota ${path} existe`).toBe(true);
    const got = guards(path);
    expect(got.features.sort()).toEqual([...want.features].sort());
    expect(got.permissions.sort()).toEqual([...want.permissions].sort());
  });

  it("nenhuma rota de negócio fica SEM guard além das de acesso, perfil e redirecionamentos", () => {
    const open = [...table.keys()].filter((p) => {
      const g = guards(p);
      return g.features.length === 0 && g.permissions.length === 0;
    });
    // abertas por desenho: autenticação, perfil, raiz/redirecionamentos, 404 e o control plane (layout próprio)
    const allowedOpen = [
      ROUTES.login,
      ROUTES.forgotPassword,
      ROUTES.resetPassword,
      ROUTES.forcedPasswordChange,
      ROUTES.perfil,
      ROUTES.usuarios,
      "/",
      "*",
      ROUTES.platform,
      ROUTES.platformOrganizations,
      ROUTES.platformOrganizationNew,
      "/platform/organizations/:id",
      ROUTES.platformAudit,
      ROUTES.platformSessions,
      "/platform/*",
    ];
    expect(open.filter((p) => !allowedOpen.includes(p)).sort()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
describe("F-32/F-33 decisão de acesso por papel, feature e sessão", () => {
  const allow = (user: AuthUser, path: string) => {
    const g = guards(path);
    const featureOk = g.features.every((f) => hasFeature(user, f as TenantFeature));
    const permOk = g.permissions.every((p) => evaluateRouteAccess(user, p as Permission) === "allow");
    return featureOk && permOk;
  };
  const full = (extra: Partial<AuthUser> = {}) =>
    makeUser({ features: { crm: true, dashboard: true, reports: true, notifications: true, calendar_task_integrations: true }, ...extra });

  it("admin com todas as features acessa as telas do cliente, nunca as internas da GSM", () => {
    const admin = full();
    for (const p of [ROUTES.pipeline, ROUTES.leads, ROUTES.configuracoes, ROUTES.integracoes, ROUTES.automacoes, ROUTES.notificacoes, ROUTES.equipe]) {
      expect(allow(admin, p), p).toBe(true);
    }
    for (const p of [ROUTES.sdrCampanhas, "/sdr/*"]) expect(allow(admin, p), p).toBe(false);
    expect(allow(admin, ROUTES.clientes)).toBe(true); // Clientes é de todos os tenants
  });

  it("gestor: configura o funil e consulta automações, mas não vê Integrações", () => {
    const gestor = full({ role: "gestor" });
    expect(allow(gestor, ROUTES.configuracoes)).toBe(true);
    expect(allow(gestor, ROUTES.automacoes)).toBe(true);
    expect(allow(gestor, ROUTES.equipe)).toBe(true);
    expect(allow(gestor, ROUTES.integracoes)).toBe(false);
  });

  it("vendedor: só as telas operacionais (sem Configurações, Equipe, Integrações, Automações)", () => {
    const vend = full({ role: "vendedor" });
    for (const p of [ROUTES.pipeline, ROUTES.leads, ROUTES.tarefas, ROUTES.agenda]) expect(allow(vend, p), p).toBe(true);
    for (const p of [ROUTES.configuracoes, ROUTES.equipe, ROUTES.integracoes, ROUTES.automacoes, ROUTES.notificacoes]) {
      expect(allow(vend, p), p).toBe(false);
    }
    expect(allow(vend, ROUTES.minhasNotificacoes)).toBe(true); // com a feature, qualquer papel
  });

  it("staff da GSM: acessa as áreas internas; em SESSÃO DE SUPORTE perde o acesso interno", () => {
    expect(allow(STAFF, ROUTES.sdrCampanhas)).toBe(true);
    const supporting = makeUser({ isPlatformStaff: true, impersonation: SUPPORT_READ_ONLY.impersonation });
    expect(allow(supporting, ROUTES.sdrCampanhas)).toBe(false);
    // Clientes é o produto do tenant: a sessão de suporte enxerga como o cliente enxerga
    expect(allow(supporting, ROUTES.clientes)).toBe(true);
  });

  it("features desligadas bloqueiam a tela mesmo para admin (ex.: sem 'reports', sem Relatórios)", () => {
    const admin = makeUser({ features: { crm: true, reports: false, dashboard: false } });
    expect(allow(admin, ROUTES.relatorios)).toBe(false);
    expect(allow(admin, ROUTES.dashboard)).toBe(false);
    expect(allow(admin, ROUTES.pipeline)).toBe(true);
  });

  it("padrões do catálogo quando o backend não informa features: crm/dashboard/reports ligados; notificações e conexões desligadas", () => {
    const old = makeUser({ features: undefined });
    expect(allow(old, ROUTES.pipeline)).toBe(true);
    expect(allow(old, ROUTES.notificacoes)).toBe(false);
    expect(allow(old, ROUTES.minhasConexoes)).toBe(false);
  });

  it("papel desconhecido nunca vira admin: nenhuma permissão", () => {
    const stranger = full({ role: "superuser" });
    for (const p of ["users.view", "settings.manage", "integrations.manage", "automations.manage"] as const) {
      expect(can(stranger, p), p).toBe(false);
    }
  });

  it("sessão de suporte somente leitura (UI): consulta, mas não gerencia usuários, notificações nem automações", () => {
    const user = makeUser({ impersonation: SUPPORT_READ_ONLY.impersonation });
    expect(can(user, "settings.manage")).toBe(true);
    expect(can(user, "automations.view")).toBe(true);
    for (const p of ["users.create", "notifications.manage", "automations.manage"] as const) {
      expect(can(user, p), p).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------------
describe("guards renderizados (o que a pessoa vê)", () => {
  const renderAs = (user: AuthUser | null, ui: ReactNode) => {
    const value = { user, loading: false } as unknown as AuthContextValue;
    return render(
      <MemoryRouter>
        <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
      </MemoryRouter>,
    );
  };

  it("área interna para quem não é staff aparece como 'não encontrada' (não revela que existe)", () => {
    renderAs(ADMIN, <RequirePermission permission="platform.internal">segredo</RequirePermission>);
    expect(screen.getByText("Página não encontrada")).toBeTruthy();
    expect(screen.queryByText("segredo")).toBeNull();
  });

  it("tela de papel superior mostra 'Acesso restrito' com caminho de volta", () => {
    renderAs(VENDEDOR, <RequirePermission permission="settings.manage">conteúdo</RequirePermission>);
    expect(screen.getByText("Acesso restrito")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toBeTruthy();
  });

  it("módulo não contratado mostra o nome do módulo e orienta falar com a GSM", () => {
    renderAs(makeUser({ features: { reports: false } }), <RequireFeature feature="reports">x</RequireFeature>);
    expect(screen.getByText("Relatórios não contratado")).toBeTruthy();
    expect(screen.getByText(/Fale com a GSM/)).toBeTruthy();
  });

  it("sem usuário (sessão expirada) nenhum conteúdo protegido aparece", () => {
    renderAs(null, <RequirePermission permission="users.view">x</RequirePermission>);
    expect(screen.queryByText("x")).toBeNull();
  });

  it("gestor e admin passam em settings.manage; vendedor não", () => {
    for (const [user, ok] of [[ADMIN, true], [GESTOR, true], [VENDEDOR, false]] as const) {
      const { unmount } = renderAs(user, <RequirePermission permission="settings.manage">ok-conteudo</RequirePermission>);
      expect(Boolean(screen.queryByText("ok-conteudo"))).toBe(ok);
      unmount();
    }
  });
});
