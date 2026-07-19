import type { Tenant } from "../types/tenant";

export const mockTenants: Tenant[] = [
  {
    id: "c1",
    name: "Clínica Bem Estar",
    category: "Clínica & Estética",
    avatarBg: "rgba(46,230,110,.14)",
    avatarColor: "#2ee66e",
  },
  {
    id: "c2",
    name: "Urban Store",
    category: "Loja / Varejo",
    avatarBg: "rgba(74,163,255,.14)",
    avatarColor: "#4aa3ff",
  },
  {
    id: "c3",
    name: "ProServ Elétrica",
    category: "Prestador de Serviço",
    avatarBg: "rgba(245,177,61,.14)",
    avatarColor: "#f5b13d",
  },
];
