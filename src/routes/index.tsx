import { createBrowserRouter, Navigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { ProtectedRoute } from "./ProtectedRoute";
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
import { TerapeutaDaVezPage } from "../pages/TerapeutaDaVezPage";
import { TerapeutaDaVezGestaoPage } from "../pages/TerapeutaDaVezGestaoPage";

export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  { path: ROUTES.forgotPassword, element: <ForgotPasswordPage /> },
  { path: ROUTES.resetPassword, element: <ResetPasswordPage /> },
  { path: ROUTES.forcedPasswordChange, element: <ForcedPasswordChangePage /> },
  // Painel do quiosque — igual ao login, fora de `ProtectedRoute`: tela
  // cheia, sem sidebar, sem exigir sessão do CRM (pedido explícito do
  // cliente: "deve ser aberto").
  { path: ROUTES.terapeutaDaVez, element: <TerapeutaDaVezPage /> },
  // Gestão também fica FORA do `ProtectedRoute` — pedido explícito do
  // cliente pra não exigir login do CRM aqui, só a senha simples própria
  // (ver `TerapeutaDaVezGestaoPage`/`operationsAuth.ts`).
  { path: ROUTES.terapeutaDaVezGestao, element: <TerapeutaDaVezGestaoPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <Navigate to={ROUTES.dashboard} replace /> },
      { path: ROUTES.dashboard, element: <DashboardPage /> },
      { path: ROUTES.pipeline, element: <PipelinePage /> },
      { path: ROUTES.leads, element: <LeadsPage /> },
      { path: `${ROUTES.leads}/:id`, element: <LeadsPage /> },
      { path: ROUTES.tarefas, element: <TasksPage /> },
      { path: ROUTES.agenda, element: <AgendaPage /> },
      { path: ROUTES.relatorios, element: <ReportsPage /> },
      { path: ROUTES.configuracoes, element: <SettingsPage /> },
      { path: ROUTES.usuarios, element: <UsersPage /> },
      { path: ROUTES.perfil, element: <ProfilePage /> },
      { path: "*", element: <Navigate to={ROUTES.dashboard} replace /> },
    ],
  },
]);
