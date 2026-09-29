import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import type { Permission } from "../auth/permissions";
import { ProtectedRoute } from "./ProtectedRoute";
import {
  NotFoundPage,
  RequireFeature,
  RequirePermission,
  RouteLoading as Loading,
} from "./RequirePermission";
import type { TenantFeature } from "../auth/features";
import { PlatformLayout } from "../platform/PlatformLayout";
import { LoginPage } from "../pages/LoginPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { ForcedPasswordChangePage } from "../pages/ForcedPasswordChangePage";
import { DashboardPage } from "../pages/DashboardPage";
import { PipelinePage } from "../pages/PipelinePage";
import { LeadsPage } from "../pages/LeadsPage";

/**
 * Carrega uma página sob demanda (chunk próprio). Usado para tudo que NÃO
 * é produto do cliente: SDR e Clientes GSM — quem não chega nessas rotas
 * nunca baixa esse código. Isso reduz
 * superfície e bundle; NÃO é controle de acesso (o backend é quem nega).
 */
function lazyPage<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
): LazyExoticComponent<ComponentType> {
  return lazy(async () => {
    const page: ComponentType = (await load())[name];
    return { default: page };
  });
}

// Etapa 4 — telas do CRM menos usadas no primeiro acesso viram chunks
// próprios (Dashboard, Pipeline e Leads continuam no bundle inicial: são a
// primeira tela e as mais usadas).
const TasksPage = lazyPage(() => import("../pages/TasksPage"), "TasksPage");
const AgendaPage = lazyPage(() => import("../pages/AgendaPage"), "AgendaPage");
const ReportsPage = lazyPage(() => import("../pages/ReportsPage"), "ReportsPage");
const SettingsPage = lazyPage(() => import("../pages/SettingsPage"), "SettingsPage");
const UsersPage = lazyPage(() => import("../pages/UsersPage"), "UsersPage");
const ProfilePage = lazyPage(() => import("../pages/ProfilePage"), "ProfilePage");

const ClientsPage = lazyPage(() => import("../pages/ClientsPage"), "ClientsPage");
const SdrCampaignsPage = lazyPage(() => import("../pages/SdrCampaignsPage"), "SdrCampaignsPage");
const SdrCampaignFormPage = lazyPage(
  () => import("../pages/SdrCampaignFormPage"),
  "SdrCampaignFormPage",
);
const SdrCampaignRunPage = lazyPage(
  () => import("../pages/SdrCampaignRunPage"),
  "SdrCampaignRunPage",
);
const SdrIcpPresetsPage = lazyPage(() => import("../pages/SdrIcpPresetsPage"), "SdrIcpPresetsPage");
const SdrCandidatesPage = lazyPage(() => import("../pages/SdrCandidatesPage"), "SdrCandidatesPage");
const SdrCandidateDetailPage = lazyPage(
  () => import("../pages/SdrCandidateDetailPage"),
  "SdrCandidateDetailPage",
);
const SdrCoveragePage = lazyPage(() => import("../pages/SdrCoveragePage"), "SdrCoveragePage");
const SdrProspectingQueuePage = lazyPage(
  () => import("../pages/SdrProspectingQueuePage"),
  "SdrProspectingQueuePage",
);
// Integrações (Etapa 3) — só Admin; chunk próprio.
const IntegrationsPage = lazyPage(() => import("../pages/IntegrationsPage"), "IntegrationsPage");
const SdrDashboardPage = lazyPage(() => import("../pages/SdrDashboardPage"), "SdrDashboardPage");
function guarded(permission: Permission, page: ReactNode) {
  return (
    <RequirePermission permission={permission}>
      <Suspense fallback={<Loading />}>{page}</Suspense>
    </RequirePermission>
  );
}

const internal = (page: ReactNode) => guarded("platform.internal", page);
const contracted = (feature: TenantFeature, page: ReactNode) => (
  <RequireFeature feature={feature}>
    <Suspense fallback={<Loading />}>{page}</Suspense>
  </RequireFeature>
);

// Control plane (Etapa 2) — chunk próprio, nunca baixado por quem não é staff.
const PlatformOverviewPage = lazyPage(
  () => import("../platform/PlatformOverviewPage"),
  "PlatformOverviewPage",
);
const OrganizationsPage = lazyPage(() => import("../platform/OrganizationsPage"), "OrganizationsPage");
const OrganizationNewPage = lazyPage(
  () => import("../platform/OrganizationNewPage"),
  "OrganizationNewPage",
);
const OrganizationDetailPage = lazyPage(
  () => import("../platform/OrganizationDetailPage"),
  "OrganizationDetailPage",
);
const PlatformAuditPage = lazyPage(() => import("../platform/PlatformAuditPage"), "PlatformAuditPage");
const SupportSessionsPage = lazyPage(
  () => import("../platform/SupportSessionsPage"),
  "SupportSessionsPage",
);
const platformPage = (page: ReactNode) => <Suspense fallback={<Loading />}>{page}</Suspense>;

export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  { path: ROUTES.forgotPassword, element: <ForgotPasswordPage /> },
  { path: ROUTES.resetPassword, element: <ResetPasswordPage /> },
  { path: ROUTES.forcedPasswordChange, element: <ForcedPasswordChangePage /> },
  {
    // Área do Super Admin GSM — layout e guard próprios (fora do AppLayout).
    element: <PlatformLayout />,
    children: [
      { path: ROUTES.platform, element: platformPage(<PlatformOverviewPage />) },
      { path: ROUTES.platformOrganizations, element: platformPage(<OrganizationsPage />) },
      { path: ROUTES.platformOrganizationNew, element: platformPage(<OrganizationNewPage />) },
      { path: "/platform/organizations/:id", element: platformPage(<OrganizationDetailPage />) },
      { path: ROUTES.platformAudit, element: platformPage(<PlatformAuditPage />) },
      { path: ROUTES.platformSessions, element: platformPage(<SupportSessionsPage />) },
      { path: "/platform/*", element: <NotFoundPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <Navigate to={ROUTES.dashboard} replace /> },
      { path: ROUTES.dashboard, element: contracted("dashboard", <DashboardPage />) },
      { path: ROUTES.pipeline, element: contracted("crm", <PipelinePage />) },
      { path: ROUTES.leads, element: contracted("crm", <LeadsPage />) },
      { path: `${ROUTES.leads}/:id`, element: contracted("crm", <LeadsPage />) },
      { path: ROUTES.clientes, element: internal(<ClientsPage />) },
      { path: ROUTES.sdrCampanhas, element: internal(<SdrCampaignsPage />) },
      { path: ROUTES.sdrCampanhaNova, element: internal(<SdrCampaignFormPage />) },
      { path: `${ROUTES.sdrCampanhas}/:id`, element: internal(<SdrCampaignFormPage />) },
      {
        path: `${ROUTES.sdrCampanhas}/:id/execucoes/:runId`,
        element: internal(<SdrCampaignRunPage />),
      },
      { path: ROUTES.sdrPresets, element: internal(<SdrIcpPresetsPage />) },
      { path: ROUTES.sdrCandidates, element: internal(<SdrCandidatesPage />) },
      { path: `${ROUTES.sdrCandidates}/:id`, element: internal(<SdrCandidateDetailPage />) },
      { path: ROUTES.sdrCobertura, element: internal(<SdrCoveragePage />) },
      { path: ROUTES.sdrProspectarHoje, element: internal(<SdrProspectingQueuePage />) },
      { path: ROUTES.sdrDashboard, element: internal(<SdrDashboardPage />) },
      // Qualquer outra URL sob /sdr também "não existe" para não-staff.
      { path: "/sdr/*", element: internal(<NotFoundPage />) },
      { path: ROUTES.tarefas, element: contracted("crm", <TasksPage />) },
      { path: ROUTES.agenda, element: contracted("crm", <AgendaPage />) },
      { path: ROUTES.relatorios, element: contracted("reports", <ReportsPage />) },
      { path: ROUTES.configuracoes, element: guarded("settings.manage", <SettingsPage />) },
      { path: ROUTES.integracoes, element: guarded("integrations.manage", <IntegrationsPage />) },
      { path: ROUTES.equipe, element: guarded("users.view", <UsersPage />) },
      { path: ROUTES.usuarios, element: <Navigate to={ROUTES.equipe} replace /> },
      {
        path: ROUTES.perfil,
        element: (
          <Suspense fallback={<Loading />}>
            <ProfilePage />
          </Suspense>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
