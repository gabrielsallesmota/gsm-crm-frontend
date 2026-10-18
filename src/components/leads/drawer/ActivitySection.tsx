import { useState } from "react";
import type { LeadTimelineItem } from "../../../types/lead";
import type { AsyncResourceState } from "../../../hooks/useAsyncResource";
import { formatDateTime } from "../../../utils/datetime";
import {
  describeTimelineItem,
  timelineActor,
  timelineKind,
  type TimelineKind,
} from "../../../utils/leadTimeline";
import { Button } from "../../common/Button";
import styles from "../LeadDrawer.module.css";

/** Quantos eventos aparecem de início e quantos entram a cada "Ver mais" (dados já carregados). */
const FIRST_PAGE = 10;
const NEXT_PAGE = 20;
/** Janela padrão do servidor e o máximo que ele aceita (`GET /leads/{id}/timeline?limit=`). */
export const TIMELINE_DEFAULT_LIMIT = 100;
export const TIMELINE_MAX_LIMIT = 500;

const KIND_CLASS: Record<TimelineKind, string | undefined> = {
  comment: styles.kindComment,
  task: styles.kindTask,
  stage: styles.kindStage,
  data: undefined,
  activity: styles.kindActivity,
  other: undefined,
};

const KIND_LABEL: Record<TimelineKind, string> = {
  comment: "Comentário",
  task: "Tarefa",
  stage: "Funil",
  data: "Dados",
  activity: "Integração",
  other: "Registro",
};

/** Comentário + linha do tempo comercial REAL (mais recentes primeiro), com "Ver mais". */
export function ActivitySection({
  timeline,
  limit,
  onRaiseLimit,
  comment,
  posting,
  onCommentChange,
  onPost,
}: {
  timeline: AsyncResourceState<LeadTimelineItem[]>;
  /** Janela pedida ao servidor (`undefined` = padrão de 100). */
  limit: number | undefined;
  onRaiseLimit: () => void;
  comment: string;
  posting: boolean;
  onCommentChange: (text: string) => void;
  onPost: () => void;
}) {
  const [visible, setVisible] = useState(FIRST_PAGE);
  const items = timeline.data ?? [];
  const asked = limit ?? TIMELINE_DEFAULT_LIMIT;
  const hiddenLocal = Math.max(0, items.length - visible);
  // O servidor devolveu exatamente o que pedimos: pode haver eventos mais antigos além da janela.
  const maybeMoreOnServer = items.length >= asked && asked < TIMELINE_MAX_LIMIT;
  const atServerCeiling = items.length >= TIMELINE_MAX_LIMIT;

  return (
    <section className={styles.section} aria-label="Atividades">
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Atividades</h3>
      </div>
      <div className={styles.commentForm}>
        <textarea
          className={styles.textarea}
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          rows={2}
          placeholder="Registrar um comentário/follow-up…"
          aria-label="Novo comentário"
        />
        <Button variant="primary" onClick={onPost} disabled={posting || !comment.trim()}>
          {posting ? "Enviando…" : "Comentar"}
        </Button>
      </div>

      {timeline.loading && !timeline.data && (
        <div aria-hidden="true">
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      )}
      {timeline.loading && !timeline.data && <div className={styles.empty}>Carregando…</div>}
      {timeline.error && (
        <div className={styles.empty}>
          Não foi possível carregar a linha do tempo.{" "}
          <button type="button" className={styles.linkBtn} onClick={timeline.reload}>
            Tentar de novo
          </button>
        </div>
      )}
      {timeline.data?.length === 0 && (
        <div className={styles.empty}>Sem atividades registradas ainda.</div>
      )}
      <ol className={styles.timeline}>
        {items.slice(0, visible).map((item) => {
          const view = describeTimelineItem(item);
          const kind = timelineKind(item.type);
          return (
            <li key={`${item.type}-${item.id}`} className={styles.timelineRow}>
              <span
                className={[styles.timelineIcon, KIND_CLASS[kind]].filter(Boolean).join(" ")}
                aria-hidden="true"
              >
                {view.icon}
              </span>
              <div className={styles.timelineText}>
                <div className={styles.timelineTitle}>
                  {view.title}
                  <span className={styles.timelineKindLabel}>{KIND_LABEL[kind]}</span>
                </div>
                {view.detail && <div className={styles.timelineDesc}>{view.detail}</div>}
                <div className={styles.timelineWho}>
                  {timelineActor(item)} · {formatDateTime(item.createdAt)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {hiddenLocal > 0 && (
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => setVisible((v) => v + NEXT_PAGE)}
        >
          Ver mais ({hiddenLocal})
        </button>
      )}
      {hiddenLocal === 0 && maybeMoreOnServer && (
        <button type="button" className={styles.linkBtn} onClick={onRaiseLimit}>
          Carregar eventos mais antigos
        </button>
      )}
      {hiddenLocal === 0 && atServerCeiling && (
        <div className={styles.empty}>
          Exibindo os {TIMELINE_MAX_LIMIT} eventos mais recentes — o limite desta tela.
        </div>
      )}
    </section>
  );
}
