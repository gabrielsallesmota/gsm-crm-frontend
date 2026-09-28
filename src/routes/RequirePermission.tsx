import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { evaluateRouteAccess, type Permission } from "../auth/permissions";
import { EmptyState } from "../components/common/EmptyState";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";

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
      title="Acesso restrito"
      message="Seu perfil não tem permissão para acessar esta área. Fale com o administrador da sua empresa."
    />
  );
}

export function NotFoundPage() {
  return (
    <div>
      <EmptyState title="Página não encontrada" message="O endereço acessado não existe." />
      <p style={{ textAlign: "center" }}>
        <Link to={ROUTES.dashboard}>Voltar ao início</Link>
      </p>
    </div>
  );
}

export function RouteLoading() {
  return <div style={{ padding: 24 }}>Carregando…</div>;
}
