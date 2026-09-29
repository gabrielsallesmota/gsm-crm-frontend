import { integrationsService } from "../services/IntegrationsService";
import type { Page } from "../types/common";
import type {
  ApiCredential,
  ApiScopeDefinition,
  WebhookDelivery,
  WebhookDeliveryDetail,
  WebhookEndpoint,
  WebhookEventDefinition,
} from "../types/integrations";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";

/** Leituras de Configurações → Integrações (Etapa 3). Mutações chamam
 * `integrationsService` direto nos componentes da tela. */
export function useApiCredentials(): AsyncResourceState<{
  credentials: ApiCredential[];
  scopes: ApiScopeDefinition[];
}> {
  return useAsyncResource(async () => {
    const [credentials, scopes] = await Promise.all([
      integrationsService.listCredentials(),
      integrationsService.scopes(),
    ]);
    return { credentials, scopes };
  }, []);
}

export function useWebhooks(): AsyncResourceState<{
  endpoints: WebhookEndpoint[];
  events: WebhookEventDefinition[];
}> {
  return useAsyncResource(async () => {
    const [endpoints, events] = await Promise.all([
      integrationsService.listWebhooks(),
      integrationsService.events(),
    ]);
    return { endpoints, events };
  }, []);
}

export function useWebhookDeliveries(
  endpointId: string,
  status: string | null,
  page: number,
): AsyncResourceState<Page<WebhookDelivery>> {
  return useAsyncResource(
    () => integrationsService.listDeliveries(endpointId, status, page),
    [endpointId, status, page],
  );
}

export function useWebhookDelivery(id: string | null): AsyncResourceState<WebhookDeliveryDetail | null> {
  return useAsyncResource(async () => (id ? integrationsService.getDelivery(id) : null), [id]);
}
