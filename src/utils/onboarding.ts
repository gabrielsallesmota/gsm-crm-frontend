// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import { can } from "../auth/permissions.ts";
import { hasFeature } from "../auth/features.ts";
import { ROUTES } from "../constants/routes.ts";
import type { AuthUser } from "../types/auth.ts";

/**
 * Primeiros passos (Etapa 4) — checklist contextual, NUNCA bloqueante.
 *
 * Cada passo é marcado como feito pelo DADO REAL sempre que possível
 * (existe lead? existe tarefa? há mais alguém na equipe? há credencial ou
 * webhook?). "Pipeline" é conceitual: conta como feito quando a pessoa
 * abre a tela. Os passos dependem do papel — o vendedor não vê "adicionar
 * equipe" nem "integração".
 *
 * Estado local (por usuário + organização): se pulou o tutorial e quais
 * telas já visitou. Nada disso vai para o servidor.
 */
export type OnboardingStepId = "leads" | "pipeline" | "team" | "task" | "integration";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  cta: string;
  to: string;
}

const ALL_STEPS: Record<OnboardingStepId, OnboardingStep> = {
  leads: {
    id: "leads",
    title: "Veja onde ficam seus leads",
    description:
      "Leads são os contatos interessados. Cadastre o primeiro ou importe uma planilha — os que chegam pelo site ou WhatsApp aparecem ali também.",
    cta: "Abrir Leads",
    to: `${ROUTES.leads}?novo=1`,
  },
  pipeline: {
    id: "pipeline",
    title: "Entenda o pipeline",
    description:
      "Cada coluna é uma etapa da venda. Arraste o card (ou use \"Mover para\" no celular) conforme a negociação avança.",
    cta: "Abrir Pipeline",
    to: ROUTES.pipeline,
  },
  team: {
    id: "team",
    title: "Adicione sua equipe",
    description:
      "Convide vendedores e gestores. Cada pessoa recebe um e-mail para criar a própria senha.",
    cta: "Abrir Equipe",
    to: ROUTES.equipe,
  },
  task: {
    id: "task",
    title: "Crie sua primeira tarefa",
    description:
      "Tarefas lembram o próximo contato com um lead (ligar, enviar proposta). Elas aparecem em Tarefas e no próprio lead.",
    cta: "Abrir Tarefas",
    to: ROUTES.tarefas,
  },
  integration: {
    id: "integration",
    title: "Conecte seu site ou WhatsApp",
    description:
      "Com uma integração, os leads do formulário do site ou das automações (n8n) entram sozinhos no CRM.",
    cta: "Abrir Integrações",
    to: ROUTES.integracoes,
  },
};

type Principal = AuthUser | null | undefined;

export function onboardingStepsFor(user: Principal): OnboardingStep[] {
  if (!user) return [];
  const steps: OnboardingStep[] = [];
  if (hasFeature(user, "crm")) steps.push(ALL_STEPS.leads, ALL_STEPS.pipeline);
  if (can(user, "users.create")) steps.push(ALL_STEPS.team);
  if (hasFeature(user, "crm")) steps.push(ALL_STEPS.task);
  if (
    can(user, "integrations.manage") &&
    (hasFeature(user, "api") || hasFeature(user, "webhooks"))
  ) {
    steps.push(ALL_STEPS.integration);
  }
  return steps;
}

/** Sinais vindos do servidor; `null` = ainda não sabemos (carregando ou
 * não consultado para este papel). */
export interface OnboardingSignals {
  leadCount: number | null;
  taskCount: number | null;
  teamSize: number | null;
  integrationCount: number | null;
}

export interface OnboardingState {
  dismissed: boolean;
  visited: OnboardingStepId[];
}

export const EMPTY_ONBOARDING_STATE: OnboardingState = { dismissed: false, visited: [] };

export function isStepDone(
  id: OnboardingStepId,
  signals: OnboardingSignals,
  state: OnboardingState,
): boolean {
  const visited = state.visited.includes(id);
  switch (id) {
    case "leads":
      return (signals.leadCount ?? 0) > 0 || visited;
    case "pipeline":
      return visited;
    case "team":
      return (signals.teamSize ?? 0) > 1;
    case "task":
      return (signals.taskCount ?? 0) > 0;
    case "integration":
      return (signals.integrationCount ?? 0) > 0;
  }
}

export interface OnboardingProgress {
  steps: (OnboardingStep & { done: boolean })[];
  doneCount: number;
  total: number;
  complete: boolean;
}

export function onboardingProgress(
  steps: OnboardingStep[],
  signals: OnboardingSignals,
  state: OnboardingState,
): OnboardingProgress {
  const withDone = steps.map((s) => ({ ...s, done: isStepDone(s.id, signals, state) }));
  const doneCount = withDone.filter((s) => s.done).length;
  return {
    steps: withDone,
    doneCount,
    total: steps.length,
    complete: steps.length > 0 && doneCount === steps.length,
  };
}

// ---- Persistência local ------------------------------------------------

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function onboardingKey(userId: string, tenantId: string | null | undefined): string {
  return `gsm_onboarding:${userId}:${tenantId ?? "-"}`;
}

const STEP_IDS: readonly OnboardingStepId[] = ["leads", "pipeline", "team", "task", "integration"];

export function readOnboardingState(
  key: string,
  store: KeyValueStore | null = defaultStore(),
): OnboardingState {
  try {
    const raw = store?.getItem(key);
    if (!raw) return EMPTY_ONBOARDING_STATE;
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      dismissed: parsed.dismissed === true,
      visited: Array.isArray(parsed.visited)
        ? parsed.visited.filter((v): v is OnboardingStepId => STEP_IDS.includes(v))
        : [],
    };
  } catch {
    return EMPTY_ONBOARDING_STATE;
  }
}

export function writeOnboardingState(
  key: string,
  state: OnboardingState,
  store: KeyValueStore | null = defaultStore(),
): void {
  try {
    store?.setItem(key, JSON.stringify(state));
  } catch {
    // Storage indisponível: o checklist só não lembra entre sessões.
  }
}

export function withVisited(state: OnboardingState, id: OnboardingStepId): OnboardingState {
  return state.visited.includes(id) ? state : { ...state, visited: [...state.visited, id] };
}
