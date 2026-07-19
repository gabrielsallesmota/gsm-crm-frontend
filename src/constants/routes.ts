export const ROUTES = {
  login: "/login",
  dashboard: "/dashboard",
  pipeline: "/pipeline",
  leads: "/leads",
  leadDetail: (id: string) => `/leads/${id}`,
  tarefas: "/tarefas",
  agenda: "/agenda",
  relatorios: "/relatorios",
  configuracoes: "/configuracoes",
  usuarios: "/usuarios",
  perfil: "/perfil",
} as const;
