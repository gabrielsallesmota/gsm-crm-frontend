import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CRM_NAV, navSections } from "../src/layouts/navigation.ts";
import { ROUTES } from "../src/constants/routes.ts";
import {
  EMPTY_ONBOARDING_STATE,
  onboardingKey,
  onboardingProgress,
  onboardingStepsFor,
  readOnboardingState,
  withVisited,
  writeOnboardingState,
  type KeyValueStore,
  type OnboardingSignals,
} from "../src/utils/onboarding.ts";
import { emailError, isValidEmail, phoneError } from "../src/utils/validation.ts";
import { invalidateShared, sharedRequest } from "../src/utils/requestCache.ts";
import { readableDetail, translateValidationMessage } from "../src/utils/apiErrors.ts";
import { copyright, pageTitle, resolveBrand, DEFAULT_BRAND } from "../src/config/brand.ts";
import type { AuthUser } from "../src/types/auth.ts";

function user(over: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "ana@cliente.com",
    name: "Ana Souza",
    role: "admin",
    mustChangePassword: false,
    accountId: "a1",
    tenantId: "t1",
    isPlatformStaff: false,
    features: { crm: true, dashboard: true, reports: true, api: true, webhooks: false },
    ...over,
  };
}

const labels = (u: AuthUser) =>
  navSections(u).flatMap((s) => s.items.map((i) => `${s.id}:${i.label}`));

describe("navegação (cenários A, C e D)", () => {
  it("admin do cliente vê o CRM na ordem combinada e nada interno da GSM", () => {
    const sections = navSections(user());
    assert.equal(sections.length, 1, "sem grupo interno para cliente");
    assert.deepEqual(
      sections[0]!.items.map((i) => i.label),
      [
        "Dashboard",
        "Pipeline",
        "Leads",
        "Tarefas",
        "Agenda",
        "Relatórios",
        "Equipe",
        "Integrações",
        "Configurações",
      ],
    );
  });

  it("vendedor não vê administração (Equipe, Integrações, Configurações)", () => {
    const got = labels(user({ role: "vendedor" }));
    assert.ok(!got.some((l) => /Equipe|Integrações|Configurações|GSM|SDR/.test(l)));
    assert.ok(got.includes("crm:Leads") && got.includes("crm:Tarefas"));
  });

  it("gestor vê Equipe e Configurações, mas não Integrações", () => {
    const got = labels(user({ role: "gestor" }));
    assert.ok(got.includes("crm:Equipe") && got.includes("crm:Configurações"));
    assert.ok(!got.includes("crm:Integrações"));
  });

  it("Integrações some sem API nem Webhooks contratados", () => {
    const got = labels(user({ features: { crm: true, api: false, webhooks: false } }));
    assert.ok(!got.includes("crm:Integrações"));
  });

  it("staff GSM vê o grupo interno separado (Clientes, SDR, Plataforma)", () => {
    const sections = navSections(user({ isPlatformStaff: true }));
    assert.equal(sections.length, 2);
    assert.equal(sections[1]!.id, "gsm");
    assert.deepEqual(
      sections[1]!.items.map((i) => i.label),
      ["Clientes GSM", "SDR", "Plataforma GSM"],
    );
  });

  it("em sessão de suporte o staff não vê o grupo interno", () => {
    const sections = navSections(
      user({
        isPlatformStaff: true,
        impersonation: { sessionId: "s", mode: "read_only", expiresAt: "2099-01-01T00:00:00Z" } as never,
      }),
    );
    assert.equal(sections.length, 1);
  });

  it("Equipe aponta para /equipe", () => {
    assert.equal(CRM_NAV.find((i) => i.label === "Equipe")?.to, ROUTES.equipe);
  });
});

const NONE: OnboardingSignals = { leadCount: 0, taskCount: 0, teamSize: 1, integrationCount: 0 };

describe("onboarding (cenário A)", () => {
  it("admin tem os 5 passos; vendedor só leads, pipeline e tarefa", () => {
    assert.deepEqual(
      onboardingStepsFor(user()).map((s) => s.id),
      ["leads", "pipeline", "team", "task", "integration"],
    );
    assert.deepEqual(
      onboardingStepsFor(user({ role: "vendedor" })).map((s) => s.id),
      ["leads", "pipeline", "task"],
    );
    assert.deepEqual(onboardingStepsFor(null), []);
  });

  it("sem integração contratada, o passo de integração não aparece", () => {
    const ids = onboardingStepsFor(user({ features: { crm: true, api: false, webhooks: false } }));
    assert.ok(!ids.some((s) => s.id === "integration"));
  });

  it("passos são marcados pelo dado real", () => {
    const steps = onboardingStepsFor(user());
    const empty = onboardingProgress(steps, NONE, EMPTY_ONBOARDING_STATE);
    assert.equal(empty.doneCount, 0);
    assert.equal(empty.complete, false);

    const done = onboardingProgress(
      steps,
      { leadCount: 3, taskCount: 1, teamSize: 2, integrationCount: 1 },
      withVisited(EMPTY_ONBOARDING_STATE, "pipeline"),
    );
    assert.equal(done.doneCount, 5);
    assert.equal(done.complete, true);
  });

  it("equipe só conta com mais alguém além de você; sinal desconhecido não conta", () => {
    const steps = onboardingStepsFor(user());
    const p = onboardingProgress(
      steps,
      { leadCount: null, taskCount: null, teamSize: 1, integrationCount: null },
      EMPTY_ONBOARDING_STATE,
    );
    assert.equal(p.steps.find((s) => s.id === "team")!.done, false);
    assert.equal(p.steps.find((s) => s.id === "leads")!.done, false);
  });

  it("visitar Leads conta mesmo sem lead (vendedor sem carteira)", () => {
    const steps = onboardingStepsFor(user({ role: "vendedor" }));
    const p = onboardingProgress(steps, NONE, withVisited(EMPTY_ONBOARDING_STATE, "leads"));
    assert.equal(p.steps.find((s) => s.id === "leads")!.done, true);
  });

  it("pular tutorial fica salvo por usuário + organização", () => {
    const mem = new Map<string, string>();
    const store: KeyValueStore = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
    };
    const key = onboardingKey("u1", "t1");
    assert.notEqual(key, onboardingKey("u1", "t2"));
    writeOnboardingState(key, { dismissed: true, visited: ["pipeline"] }, store);
    assert.deepEqual(readOnboardingState(key, store), { dismissed: true, visited: ["pipeline"] });
    assert.deepEqual(readOnboardingState(onboardingKey("u1", "t2"), store), EMPTY_ONBOARDING_STATE);
  });

  it("storage corrompido ou indisponível não quebra", () => {
    const broken: KeyValueStore = {
      getItem: () => "{nao-e-json",
      setItem: () => {
        throw new Error("quota");
      },
    };
    assert.deepEqual(readOnboardingState("k", broken), EMPTY_ONBOARDING_STATE);
    assert.doesNotThrow(() => writeOnboardingState("k", EMPTY_ONBOARDING_STATE, broken));
    assert.deepEqual(readOnboardingState("k", null), EMPTY_ONBOARDING_STATE);
  });

  it("withVisited não duplica", () => {
    const once = withVisited(EMPTY_ONBOARDING_STATE, "pipeline");
    assert.equal(withVisited(once, "pipeline"), once);
  });
});

describe("formulários", () => {
  it("e-mail", () => {
    assert.equal(isValidEmail("ana@empresa.com"), true);
    assert.equal(isValidEmail("ana@empresa"), false);
    assert.equal(emailError(""), null, "opcional vazio é ok");
    assert.match(emailError("", { required: true }) ?? "", /Informe/);
    assert.match(emailError("ana.com") ?? "", /inválido/);
  });

  it("telefone BR com DDD", () => {
    assert.equal(phoneError(""), null);
    assert.equal(phoneError("(11) 91234-5678"), null);
    assert.equal(phoneError("1133334444"), null);
    assert.match(phoneError("91234-5678") ?? "", /DDD/);
    assert.match(phoneError("", { required: true }) ?? "", /Informe/);
  });
});

describe("mensagens de erro para o usuário", () => {
  it("traduz mensagens comuns do Pydantic", () => {
    assert.equal(translateValidationMessage("Field required"), "campo obrigatório");
    assert.equal(
      translateValidationMessage("String should have at least 1 character"),
      "precisa ter pelo menos 1 caractere(s)",
    );
    assert.equal(translateValidationMessage("Extra inputs are not permitted"), "campo não permitido");
    assert.equal(
      translateValidationMessage("value is not a valid email address: An email address must have an @-sign."),
      "e-mail inválido",
    );
  });

  it("mantém mensagem do backend em português e esconde inglês desconhecido", () => {
    assert.equal(
      translateValidationMessage("Value error, Nome não pode ficar em branco"),
      "Nome não pode ficar em branco",
    );
    assert.equal(translateValidationMessage("Some unexpected internal thing"), "valor inválido");
  });

  it("422 vira uma frase com o nome do campo em português", () => {
    const detail = [{ loc: ["body", "email"], msg: "value is not a valid email address", type: "value_error" }];
    assert.equal(readableDetail(detail, "x"), "E-mail: e-mail inválido");
    const extra = [{ loc: ["body", "tenant_id"], msg: "Extra inputs are not permitted" }];
    assert.equal(readableDetail(extra, "x"), "tenant_id: campo não permitido");
  });
});

describe("requisições compartilhadas (sem duplicar)", () => {
  it("mesma chave dentro do TTL = uma chamada só", async () => {
    invalidateShared();
    let calls = 0;
    const fn = async () => ++calls;
    let t = 0;
    const clock = () => t;
    const [a, b] = await Promise.all([
      sharedRequest("k", fn, 1000, clock),
      sharedRequest("k", fn, 1000, clock),
    ]);
    assert.equal(calls, 1);
    assert.equal(a, b);
    t = 1500;
    await sharedRequest("k", fn, 1000, clock);
    assert.equal(calls, 2, "expirou → busca de novo");
  });

  it("invalidate força nova busca; erro não fica em cache", async () => {
    invalidateShared();
    let calls = 0;
    await sharedRequest("p:1", async () => ++calls);
    invalidateShared("p:");
    await sharedRequest("p:1", async () => ++calls);
    assert.equal(calls, 2);

    let fails = 0;
    await assert.rejects(sharedRequest("e", async () => Promise.reject(new Error(String(++fails)))));
    await new Promise((r) => setTimeout(r, 0));
    await assert.rejects(sharedRequest("e", async () => Promise.reject(new Error(String(++fails)))));
    assert.equal(fails, 2);
  });
});

describe("marca", () => {
  it("título da aba e rodapé saem da configuração central", () => {
    assert.equal(pageTitle("Leads"), `Leads · ${DEFAULT_BRAND.productName}`);
    assert.equal(pageTitle(""), DEFAULT_BRAND.productName);
    assert.equal(copyright(2030), `© 2030 ${DEFAULT_BRAND.companyName}`);
  });

  it("personalização por organização ainda não existe (sempre a marca padrão)", () => {
    assert.equal(resolveBrand({ brand: { productName: "Outro" } }), DEFAULT_BRAND);
  });
});
