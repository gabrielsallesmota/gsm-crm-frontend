import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth";
import { leadsService } from "../services/LeadsService";
import { tasksService } from "../services/TasksService";
import { usersService } from "../services/UsersService";
import { integrationsService } from "../services/IntegrationsService";
import { hasFeature } from "../auth/features";
import {
  EMPTY_ONBOARDING_STATE,
  onboardingKey,
  onboardingProgress,
  onboardingStepsFor,
  readOnboardingState,
  withVisited,
  writeOnboardingState,
  type OnboardingProgress,
  type OnboardingSignals,
  type OnboardingState,
  type OnboardingStepId,
} from "../utils/onboarding";

const UNKNOWN: OnboardingSignals = {
  leadCount: null,
  taskCount: null,
  teamSize: null,
  integrationCount: null,
};

async function count(fn: () => Promise<number>): Promise<number | null> {
  try {
    return await fn();
  } catch {
    // Um sinal indisponível (403, rede) só deixa aquele passo em aberto.
    return null;
  }
}

/**
 * Estado do checklist de primeiros passos (Etapa 4). Consulta o servidor
 * UMA vez por montagem, com `page_size=1` (só o total), e só os sinais
 * dos passos que este papel vê. Pulado → não consulta nada.
 */
export function useOnboarding(): {
  visible: boolean;
  loading: boolean;
  progress: OnboardingProgress;
  dismiss: () => void;
} {
  const { user } = useAuth();
  const key = user ? onboardingKey(user.id, user.tenantId) : null;
  const steps = useMemo(() => onboardingStepsFor(user), [user]);
  const [state, setState] = useState<OnboardingState>(() =>
    key ? readOnboardingState(key) : EMPTY_ONBOARDING_STATE,
  );
  const [signals, setSignals] = useState<OnboardingSignals>(UNKNOWN);
  const [loading, setLoading] = useState(true);

  const ids = steps.map((s) => s.id).join(",");
  const skip = !user || state.dismissed || steps.length === 0;
  useEffect(() => {
    if (skip || !user) return;
    let cancelled = false;
    const wants = new Set(ids.split(","));
    const none = Promise.resolve(null);
    void Promise.all([
      wants.has("leads")
        ? count(async () => (await leadsService.list({ page: 1, pageSize: 1 })).total)
        : none,
      wants.has("task")
        ? count(async () => (await tasksService.list({ scope: "all", page: 1, pageSize: 1 })).total)
        : none,
      wants.has("team") ? count(async () => (await usersService.directory()).length) : none,
      wants.has("integration")
        ? count(async () => {
            const [keys, hooks] = await Promise.all([
              hasFeature(user, "api") ? integrationsService.listCredentials() : Promise.resolve([]),
              hasFeature(user, "webhooks") ? integrationsService.listWebhooks() : Promise.resolve([]),
            ]);
            return keys.filter((k) => k.status === "active").length + hooks.length;
          })
        : none,
    ]).then(([leadCount, taskCount, teamSize, integrationCount]) => {
      if (cancelled) return;
      setSignals({ leadCount, taskCount, teamSize, integrationCount });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, ids, skip]);

  const dismiss = useCallback(() => {
    if (!key) return;
    const next = { ...state, dismissed: true };
    writeOnboardingState(key, next);
    setState(next);
  }, [key, state]);

  const progress = onboardingProgress(steps, signals, state);
  return { visible: !skip, loading: !skip && loading, progress, dismiss };
}

/** Marca uma tela como "já vista" no checklist (ex.: abriu o Pipeline). */
export function useMarkOnboardingVisit(id: OnboardingStepId): void {
  const { user } = useAuth();
  const userId = user?.id;
  const tenantId = user?.tenantId;
  useEffect(() => {
    if (!userId) return;
    const key = onboardingKey(userId, tenantId);
    const current = readOnboardingState(key);
    const next = withVisited(current, id);
    if (next !== current) writeOnboardingState(key, next);
  }, [userId, tenantId, id]);
}

/** Reexibe o checklist (Perfil → "Mostrar primeiros passos"). */
export function resetOnboarding(userId: string, tenantId: string | null | undefined): void {
  const key = onboardingKey(userId, tenantId);
  writeOnboardingState(key, { ...readOnboardingState(key), dismissed: false });
}
