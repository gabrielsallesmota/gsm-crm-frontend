// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { LeadTimelineItem } from "../types/lead.ts";
import { brl } from "./currency.ts";

export interface TimelineView {
  icon: string;
  title: string;
  detail: string | null;
}

const FIELD_LABEL: Record<string, string> = {
  expected_value: "Valor",
  probability: "Probabilidade",
  origin: "Origem",
  name: "Nome",
  company: "Empresa",
  position: "Cargo",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
  city: "Cidade",
  state: "Estado",
  notes: "Notas",
};

const ACTIVITY_LABEL: Record<string, string> = {
  note: "Nota",
  whatsapp: "WhatsApp",
  call: "Ligação",
  email: "E-mail",
  meeting: "Reunião",
  form: "Formulário",
};

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function formatChange(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "expected_value") return `R$ ${brl(Number(value))}`;
  if (field === "probability") return `${String(value)}%`;
  return String(value);
}

/**
 * Texto de um item da timeline COMERCIAL — só o que o backend registrou
 * (nada inventado/retroativo). Tipos desconhecidos (backend mais novo)
 * aparecem de forma neutra em vez de sumir. Testado em
 * `tests/leadTimeline.test.ts`.
 */
export function describeTimelineItem(item: LeadTimelineItem): TimelineView {
  const p = item.payload;
  const toStage = str(p["to_stage_name"]);
  const fromStage = str(p["from_stage_name"]);
  switch (item.type) {
    case "created": {
      const source = str(p["source"]);
      const via =
        source === "api"
          ? "via formulário/integração"
          : source === "import"
            ? "via importação"
            : "manualmente";
      return {
        icon: "✦",
        title: `Lead criado ${via}`,
        detail: toStage ? `Etapa inicial: ${toStage}` : null,
      };
    }
    case "stage_changed":
      return {
        icon: "→",
        title: "Mudou de etapa",
        detail: `${fromStage ?? "—"} → ${toStage ?? "—"}`,
      };
    case "won":
      return { icon: "🏆", title: "Negócio ganho", detail: toStage ? `Etapa: ${toStage}` : null };
    case "lost":
      return { icon: "✕", title: "Negócio perdido", detail: toStage ? `Etapa: ${toStage}` : null };
    case "owner_changed":
      return {
        icon: "👤",
        title: "Responsável alterado",
        detail: `${str(p["from_owner_name"]) ?? "Sem responsável"} → ${str(p["to_owner_name"]) ?? "Sem responsável"}`,
      };
    case "updated": {
      const changes = (p["changes"] ?? {}) as Record<string, { from?: unknown; to?: unknown }>;
      const parts = Object.entries(changes).map(
        ([field, c]) =>
          `${FIELD_LABEL[field] ?? field}: ${formatChange(field, c.from)} → ${formatChange(field, c.to)}`,
      );
      const fields = Array.isArray(p["fields"]) ? (p["fields"] as unknown[]).map(String) : [];
      const others = fields.filter((f) => !(f in changes)).map((f) => FIELD_LABEL[f] ?? f);
      if (others.length) parts.push(`Editou: ${others.join(", ")}`);
      const origin = str(p["source"]);
      const source =
        origin === "import" ? " (importação)" : origin === "api" ? " (integração)" : "";
      return { icon: "✎", title: `Dados atualizados${source}`, detail: parts.join(" · ") || null };
    }
    case "task_created":
      return { icon: "☐", title: "Tarefa criada", detail: str(p["task_title"]) };
    case "task_completed":
      return { icon: "☑", title: "Tarefa concluída", detail: str(p["task_title"]) };
    case "task_reopened":
      return { icon: "↺", title: "Tarefa reaberta", detail: str(p["task_title"]) };
    case "comment":
      return { icon: "💬", title: "Comentário", detail: item.text };
    case "activity": {
      // Etapa 3 — interação registrada por integração (POST /public/leads/{id}/activities).
      const kind = str(p["activity_type"]);
      return {
        icon: "⚡",
        title: `Atividade: ${ACTIVITY_LABEL[kind ?? ""] ?? kind ?? "registro"}`,
        detail: str(p["text"]),
      };
    }
    default:
      return { icon: "•", title: "Atividade registrada", detail: null };
  }
}

/** Quem fez: nome do usuário, "Integração (API)" ou "Sistema". */
export function timelineActor(item: LeadTimelineItem): string {
  if (item.actorType === "api_key") return "Integração (API)";
  if (item.actorType === "system") return "Sistema";
  return item.actorName ?? "Usuário removido";
}
