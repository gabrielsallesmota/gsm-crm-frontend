// CRM-008 — componentes reais renderizados (antes só a função `can()` era
// testada, nunca o guard que decide o que aparece na tela).
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { WhatsappButton } from "../../src/components/leads/WhatsappButton";
import { AuthContext, type AuthContextValue } from "../../src/contexts/AuthContext";
import { RequireFeature, RequirePermission } from "../../src/routes/RequirePermission";
import type { AuthUser } from "../../src/types/auth";
import type { Lead, LeadMessageTemplate } from "../../src/types/lead";

afterEach(cleanup);

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "a@example.com",
    name: "Ana",
    role: "admin",
    mustChangePassword: false,
    accountId: "acc",
    tenantId: "t1",
    isPlatformStaff: false,
    ...overrides,
  };
}

function renderAs(principal: AuthUser | null, ui: ReactNode) {
  const value = { user: principal, loading: false } as unknown as AuthContextValue;
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  );
}

const SECRET = <p>conteúdo protegido</p>;

describe("RequirePermission", () => {
  it("mostra a tela para quem tem a permissão", () => {
    renderAs(user({ role: "gestor" }), <RequirePermission permission="settings.manage">{SECRET}</RequirePermission>);
    expect(screen.getByText("conteúdo protegido")).toBeTruthy();
  });

  it("papel sem permissão vê 'Acesso restrito', nunca o conteúdo", () => {
    renderAs(user({ role: "vendedor" }), <RequirePermission permission="settings.manage">{SECRET}</RequirePermission>);
    expect(screen.queryByText("conteúdo protegido")).toBeNull();
    expect(screen.getByText("Acesso restrito")).toBeTruthy();
  });

  it("gestor não acessa Integrações (só admin)", () => {
    renderAs(user({ role: "gestor" }), <RequirePermission permission="integrations.manage">{SECRET}</RequirePermission>);
    expect(screen.queryByText("conteúdo protegido")).toBeNull();
  });

  it("área interna da GSM 'não existe' para cliente (404, não 403)", () => {
    renderAs(user({ role: "admin" }), <RequirePermission permission="platform.internal">{SECRET}</RequirePermission>);
    expect(screen.queryByText("conteúdo protegido")).toBeNull();
    expect(screen.getByText("Página não encontrada")).toBeTruthy();
    expect(screen.queryByText("Acesso restrito")).toBeNull();
  });

  it("platform staff em sessão de suporte perde a área interna", () => {
    const staffSupporting = user({
      isPlatformStaff: true,
      impersonation: { sessionId: "s" } as unknown as AuthUser["impersonation"],
    });
    renderAs(staffSupporting, <RequirePermission permission="platform.internal">{SECRET}</RequirePermission>);
    expect(screen.queryByText("conteúdo protegido")).toBeNull();
  });

  it("sem usuário nada é liberado", () => {
    renderAs(null, <RequirePermission permission="users.view">{SECRET}</RequirePermission>);
    expect(screen.queryByText("conteúdo protegido")).toBeNull();
  });
});

describe("RequireFeature", () => {
  it("módulo contratado aparece", () => {
    renderAs(user({ features: { reports: true } }), <RequireFeature feature="reports">{SECRET}</RequireFeature>);
    expect(screen.getByText("conteúdo protegido")).toBeTruthy();
  });

  it("módulo não contratado mostra o aviso, não a tela", () => {
    renderAs(user({ features: { reports: false } }), <RequireFeature feature="reports">{SECRET}</RequireFeature>);
    expect(screen.queryByText("conteúdo protegido")).toBeNull();
    expect(screen.getByText("Relatórios não contratado")).toBeTruthy();
  });

  it("sem flag explícita vale o padrão do catálogo (webhooks desligado)", () => {
    renderAs(user(), <RequireFeature feature="webhooks">{SECRET}</RequireFeature>);
    expect(screen.queryByText("conteúdo protegido")).toBeNull();
  });
});

describe("WhatsappButton do lead", () => {
  const lead = {
    id: "l1",
    name: "Maria",
    company: "Clínica",
    city: "Campinas",
    state: "SP",
    stageId: "s1",
    origin: "instagram",
    phoneNormalized: "5511912345678",
  } as Lead;
  const templates: LeadMessageTemplate[] = [
    { id: "t", stageId: "s1", origin: null, message: "Oi {nome}", createdAt: "", updatedAt: "" },
  ];

  it("abre o wa.me com a mensagem do template", () => {
    renderAs(user(), <WhatsappButton lead={lead} templates={templates} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://wa.me/5511912345678?text=Oi%20Maria");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("sem telefone ou sem template o botão não aparece", () => {
    const { container: noPhone } = renderAs(user(), (
      <WhatsappButton lead={{ ...lead, phoneNormalized: "" }} templates={templates} />
    ));
    expect(noPhone.querySelector("a")).toBeNull();
    cleanup();
    const { container: noTemplate } = renderAs(user(), <WhatsappButton lead={lead} templates={[]} />);
    expect(noTemplate.querySelector("a")).toBeNull();
  });
});
