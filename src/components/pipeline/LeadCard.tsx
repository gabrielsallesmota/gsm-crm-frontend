import { memo, useId } from "react";
import { originOf } from "../../constants/origins";
import type { Lead, LeadMessageTemplate } from "../../types/lead";
import type { PipelineStage } from "../../types/pipeline";
import { brl } from "../../utils/currency";
import { leadAge } from "../../utils/pipelineView";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { EmailButton } from "../leads/EmailButton";
import { WhatsappButton } from "../leads/WhatsappButton";
import styles from "./LeadCard.module.css";

export interface LeadCardProps {
  lead: Lead;
  stages: PipelineStage[];
  /** Nome do responsável; `null` com `ownerId` = dono que saiu da equipe ("—"). */
  ownerName: string | null;
  /** Nicho do lead (serviço de interesse); `null`/ausente = sem nicho. */
  nicheName?: string | null;
  /** Há um movimento em voo para este lead. */
  pending: boolean;
  /** Este card está sendo arrastado. */
  dragging: boolean;
  templates: LeadMessageTemplate[];
  /** Todos os callbacks recebem o id: ficam ESTÁVEIS na página e o `memo` evita re-render dos
   * demais cartões quando só o destino do arraste muda. */
  onOpen: (leadId: string) => void;
  onDragStart: (leadId: string) => void;
  onDragEnd: () => void;
  onMove: (leadId: string, stageId: string) => void;
}

/**
 * Cartão do lead (Prompt 06). Hierarquia: NOME (principal) → valor/empresa/comentário (secundário)
 * → origem e idade (terciário) → responsável e ações no rodapé.
 *
 * Semântica (sem interativo aninhado — PIP-01): a área de resumo é o único `role="button"`; o seletor
 * de etapa, o WhatsApp e o e-mail são IRMÃOS dela, dentro do mesmo contêiner arrastável.
 * Nenhuma ação depende de hover: o rodapé é sempre visível e o seletor "mover" aparece por foco de
 * teclado (mouse) ou fica sempre visível (toque).
 */
function LeadCardView({
  lead,
  stages,
  ownerName,
  nicheName = null,
  pending,
  dragging,
  templates,
  onOpen,
  onDragStart,
  onDragEnd,
  onMove,
}: LeadCardProps) {
  const summaryId = useId();
  const origin = originOf(lead.origin);
  const age = leadAge(lead.createdAt);
  const unassigned = !lead.ownerId;
  const owner = ownerName ?? (lead.ownerId ? "—" : "Sem responsável");
  const classes = [styles.card, dragging ? styles.dragging : "", pending ? styles.pending : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      data-lead-id={lead.id}
      draggable={!pending}
      onDragStart={(e) => {
        // Firefox só inicia o arraste se houver dado; `move` mostra o cursor certo.
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", lead.id);
        }
        onDragStart(lead.id);
      }}
      onDragEnd={onDragEnd}
      aria-busy={pending}
    >
      <div
        className={styles.main}
        role="button"
        tabIndex={0}
        aria-label={`Abrir ${lead.name}`}
        aria-describedby={summaryId}
        onClick={() => onOpen(lead.id)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onOpen(lead.id);
          }
        }}
      >
        <div className={styles.top}>
          <span className={styles.name}>{lead.name}</span>
          {lead.value > 0 && <span className={styles.value}>R$ {brl(lead.value)}</span>}
        </div>
        {lead.company && <div className={styles.company}>{lead.company}</div>}
        {lead.lastComment && (
          // `title` = texto inteiro no hover; o visível é truncado por CSS (1 linha).
          <div className={styles.comment} title={lead.lastComment.text}>
            “{lead.lastComment.text}”
          </div>
        )}
        <div className={styles.meta}>
          <Badge label={origin.label} color={origin.color} bg={origin.bg} />
          {nicheName && <Badge label={nicheName} color="var(--tone-purple)" bg="var(--tone-purple-bg)" />}
          {age.short && (
            <span className={styles.age} title={age.title}>
              {age.short}
            </span>
          )}
        </div>
        {/* Resumo falado pelo leitor de tela (o rótulo do botão é só "Abrir …"). */}
        <span id={summaryId} className="sr-only">
          {[
            lead.company ? `Empresa ${lead.company}` : null,
            lead.value > 0 ? `Valor R$ ${brl(lead.value)}` : null,
            unassigned ? "Sem responsável" : `Responsável ${owner}`,
            nicheName ? `Nicho ${nicheName}` : null,
            age.long || null,
          ]
            .filter(Boolean)
            .join(". ")}
        </span>
      </div>

      <div className={styles.footer}>
        {unassigned ? (
          <span className={`${styles.owner} ${styles.unassigned}`}>Sem responsável</span>
        ) : (
          <span className={styles.owner}>
            <span aria-hidden="true">
              <Avatar name={owner} bg="var(--hover-bg-3)" color="var(--text-dim)" size={22} />
            </span>
            <span className={styles.ownerName}>{owner}</span>
          </span>
        )}
        {pending ? (
          <span className={styles.moving} role="status">
            Movendo…
          </span>
        ) : (
          <span className={styles.actions}>
            <WhatsappButton lead={lead} templates={templates} size="icon" />
            <EmailButton lead={lead} size="icon" />
          </span>
        )}
      </div>

      {/* Alternativa ao arrastar (PIP-05): visualmente oculta no desktop com mouse até o foco chegar
          ao cartão; sempre visível em toque. Nunca `display: none`. */}
      <select
        className={styles.move}
        value={lead.stageId}
        disabled={pending}
        onChange={(e) => onMove(lead.id, e.target.value)}
        aria-label={`Mover ${lead.name} para outra etapa`}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export const LeadCard = memo(LeadCardView);
