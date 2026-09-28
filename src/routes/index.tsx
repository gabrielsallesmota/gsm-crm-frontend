import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import type { Permission } from "../auth/permissions";
import { ProtectedRoute } from "./ProtectedRoute";
import { NotFoundPage, RequirePermission, RouteLoading as Loading } from "./RequirePermission";
import { LoginPage } from "../pages/LoginPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { ForcedPasswordChangePage } from "../pages/ForcedPasswordChangePage";
import { DashboardPage } from "../pages/DashboardPage";
import { PipelinePage } from "../pages/PipelinePage";
import { LeadsPage } from "../pages/LeadsPage";
import { TasksPage } from "../pages/TasksPage";
import { AgendaPage } from "../pages/AgendaPage";
import { ReportsPage } from "../pages/ReportsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { UsersPage } from "../pages/UsersPage";
import { ProfilePage } from "../pages/ProfilePage";
import { KioskGate } from "../components/operations/KioskGate";

/**
 * Carrega uma página sob demanda (chunk próprio). Usado para tudo que NÃO
 * é produto do cliente: SDR, Clientes GSM e o painel legado Terapeuta da
 * Vez — quem não chega nessas rotas nunca baixa esse código. Isso reduz
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
const SdrDashboardPage = lazyPage(() => import("../pages/SdrDashboardPage"), "SdrDashboardPage");
const TerapeutaDaVezPage = lazyPage(
  () => import("../pages/TerapeutaDaVezPage"),
  "TerapeutaDaVezPage",
);
const TerapeutaDaVezGestaoPage = lazyPage(
  () => import("../pages/TerapeutaDaVezGestaoPage"),
  "TerapeutaDaVezGestaoPage",
);

function guarded(permission: Permission, page: ReactNode) {
  return (
    <RequirePermission permission={permission}>
      <Suspense fallback={<Loading />}>{page}</Suspense>
    </RequirePermission>
  );
}

const internal = (page: ReactNode) => guarded("platform.internal", page);

export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  { path: ROUTES.forgotPassword, element: <ForgotPasswordPage /> },
  { path: ROUTES.resetPassword, element: <ResetPasswordPage /> },
  { path: ROUTES.forcedPasswordChange, element: <ForcedPasswordChangePage /> },
  // Painel legado "Terapeuta da Vez" (cliente específico, fora do produto
  // CRM) — sem login do CRM (pedido do cliente), mas o terminal precisa ser
  // PAREADO com o código do dispositivo antes de qualquer chamada: o
  // backend não responde mais nada dessas rotas sem credencial.
  {
    path: ROUTES.terapeutaDaVez,
    element: (
      <KioskGate>
        <Suspense fallback={<Loading />}>
          <TerapeutaDaVezPage />
        </Suspense>
      </KioskGate>
    ),
  },
  // Gestão: continua com a senha própria (ver `TerapeutaDaVezGestaoPage`).
  {
    path: ROUTES.terapeutaDaVezGestao,
    element: (
      <Suspense fallback={<Loading />}>
        <TerapeutaDaVezGestaoPage />
      </Suspense>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <Navigate to={ROUTES.dashboard} replace /> },
      { path: ROUTES.dashboard, element: <DashboardPage /> },
      { path: ROUTES.pipeline, element: <PipelinePage /> },
      { path: ROUTES.leads, element: <LeadsPage /> },
      { path: `${ROUTES.leads}/:id`, element: <LeadsPage /> },
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
      { path: ROUTES.tarefas, element: <TasksPage /> },
      { path: ROUTES.agenda, element: <AgendaPage /> },
      { path: ROUTES.relatorios, element: <ReportsPage /> },
      { path: ROUTES.configuracoes, element: guarded("settings.manage", <SettingsPage />) },
      { path: ROUTES.usuarios, element: guarded("users.view", <UsersPage />) },
      { path: ROUTES.perfil, element: <ProfilePage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
