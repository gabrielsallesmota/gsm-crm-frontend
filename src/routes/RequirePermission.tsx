import type { ReactNode } from "react";
import { evaluateRouteAccess, type Permission } from "../auth/permissions";
import { hasFeature, FEATURE_LABELS, type TenantFeature } from "../auth/features";
import { EmptyState } from "../components/common/EmptyState";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";
import { SkeletonRows } from "../components/common/Skeleton";

/**
 * Guard de rota por permissão (ver `auth/permissions.ts`). Não é
 * segurança — o backend recusa de qualquer jeito —, mas impede que um
 * usuário de tenant "navegue" para telas internas da GSM ou para telas
 * que o papel dele não usa, e evita renderizar/carregar o código delas
 * (as páginas internas são lazy, então o chunk nem é baixado).
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const access = evaluateRouteAccess(user, permission);

  if (access === "allow") return <>{children}</>;
  if (access === "not_found") return <NotFoundPage />;
  return (
    <EmptyState
      tone="forbidden"
      title="Acesso restrito"
      message="Seu perfil não tem permissão para acessar esta área. Fale com o administrador da sua empresa."
      actions={[{ label: "Voltar ao início", to: ROUTES.dashboard }]}
    />
  );
}

/** Rota de um módulo CONTRATÁVEL (Etapa 2): sem a feature, mostra "não
 * contratado" em vez da tela (o backend responde 403 de qualquer jeito). */
export function RequireFeature({
  feature,
  children,
}: {
  feature: TenantFeature;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (hasFeature(user, feature)) return <>{children}</>;
  return (
    <EmptyState
      tone="forbidden"
      title={`${FEATURE_LABELS[feature]} não contratado`}
      message="Este módulo não faz parte do plano da sua organização. Fale com a GSM para habilitá-lo."
      actions={[{ label: "Voltar ao início", to: ROUTES.dashboard }]}
    />
  );
}

export function NotFoundPage() {
  return (
    <EmptyState
      tone="forbidden"
      title="Página não encontrada"
      message="O endereço acessado não existe ou mudou de lugar."
      actions={[{ label: "Voltar ao início", to: ROUTES.dashboard }]}
    />
  );
}

export function RouteLoading() {
  return <SkeletonRows rows={4} label="Carregando a tela" />;
}
