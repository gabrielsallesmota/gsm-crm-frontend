import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { SkeletonRows } from "../common/Skeleton";
import { ROUTES } from "../../constants/routes";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { usePolling } from "../../hooks/usePolling";
import { useToast } from "../../hooks/useToast";
import { conversationsService } from "../../services/MessagingService";
import { ApiError } from "../../types/common";
import { describeError } from "../../utils/apiErrors";
import { formatDateTime } from "../../utils/datetime";
import {
  canRetry,
  channelLabel,
  describeSendError,
  mergeMessages,
  messageStatusInfo,
  newClientRequestId,
  POLL_MS,
  validateReply,
  windowHint,
  type ChatMessage,
  type ConversationDetail,
  type ConversationSummary,
} from "../../utils/messaging";
import { LeadSidePanel } from "./LeadSidePanel";
import styles from "./Conversations.module.css";

/** Uma conversa: histórico (atualiza a cada 4 s), resposta em texto e o lead ao lado. */
export function ChatPanel({
  conversationId,
  summary,
  onBack,
  onChanged,
}: {
  conversationId: string;
  summary: ConversationSummary | null;
  onBack?: (() => void) | undefined;
  onChanged: () => void;
}) {
  const { toastError } = useToast();
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // no computador o lead fica aberto ao lado; no celular abre por cima
  const [showLead, setShowLead] = useState(!isMobile);
  // o mesmo envio (duplo clique, rede instável) reaproveita o id: o backend não duplica
  const requestId = useRef(newClientRequestId());
  const bottom = useRef<HTMLDivElement | null>(null);
  const lastSeen = useRef<string | null>(null);
  // PERF-01: o polling pede só o que mudou desde o último `serverTime`; o cabeçalho (janela de
  // resposta, status da conexão) é relido a cada `POLL_MS.chatDetail` ou depois de uma ação.
  const since = useRef<string | null>(null);
  const detailAt = useRef(0);

  const load = useCallback(
    async (full = true) => {
      try {
        const needDetail = full || Date.now() - detailAt.current >= POLL_MS.chatDetail;
        const [d, page] = await Promise.all([
          needDetail ? conversationsService.get(conversationId) : Promise.resolve(null),
          conversationsService.page(conversationId, !full && since.current ? { since: since.current } : {}),
        ]);
        if (d) {
          setDetail(d);
          detailAt.current = Date.now();
        }
        since.current = page.serverTime ?? since.current;
        setMessages((current) => mergeMessages(current ?? [], page.items));
        setError(null);
      } catch (err) {
        // lead passou para outra pessoa (ou conversa apagada pela retenção): some da tela
        if (err instanceof ApiError && err.status === 404) setGone(true);
        else setError(describeError(err, "Não foi possível carregar a conversa."));
        throw err;
      }
    },
    [conversationId],
  );
  const poll = useCallback(() => load(false), [load]);

  useEffect(() => {
    load()
      .then(() => conversationsService.markRead(conversationId))
      .then(onChanged)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir a conversa
  }, [conversationId]);

  usePolling(poll, POLL_MS.chat, !gone);

  // nova mensagem recebida com a conversa aberta: marca como lida e desce a rolagem
  const newest = messages?.at(-1);
  useEffect(() => {
    if (!newest || newest.id === lastSeen.current) return;
    const first = lastSeen.current === null;
    lastSeen.current = newest.id;
    bottom.current?.scrollIntoView({ block: "end", behavior: first ? "auto" : "smooth" });
    if (!first && newest.direction === "in") {
      void conversationsService.markRead(conversationId).then(onChanged).catch(() => undefined);
    }
  }, [newest, conversationId, onChanged]);

  async function send() {
    if (!detail) return;
    const problem = validateReply(detail.provider, text);
    if (problem) {
      toastError(new Error(problem), problem);
      return;
    }
    setSending(true);
    try {
      await conversationsService.send(conversationId, text.trim(), requestId.current);
      setText("");
      requestId.current = newClientRequestId();
      await load().catch(() => undefined);
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function retry(message: ChatMessage) {
    try {
      await conversationsService.retry(conversationId, message.id);
      await load().catch(() => undefined);
    } catch (err) {
      toastError(err, "Não foi possível reenviar.");
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  if (gone) {
    return (
      <section className={styles.chatPane}>
        <EmptyState
          title="Conversa indisponível"
          message="Esta conversa não está mais visível para você (o lead pode ter passado para outra pessoa)."
          actions={[{ label: "Voltar às conversas", to: ROUTES.conversas }]}
        />
      </section>
    );
  }
  if (!detail || messages === null) {
    return (
      <section className={styles.chatPane}>
        {error ? <p className={styles.errorLine}>{error}</p> : <SkeletonRows rows={5} label="Carregando a conversa" />}
      </section>
    );
  }

  const hint = detail.provider === "instagram" ? windowHint(detail.reply.until) : null;
  const leadId = detail.leadId ?? summary?.lead?.id ?? null;

  return (
    <>
      <section className={styles.chatPane} aria-label={`Conversa com ${detail.title}`}>
        <header className={styles.chatHeader}>
          {onBack && (
            <button type="button" className={styles.back} onClick={onBack} aria-label="Voltar à lista">
              ←
            </button>
          )}
          <div className={styles.chatTitleBox}>
            <h2 className={styles.chatTitle}>{detail.title}</h2>
            <span className={styles.chatSub}>
              {channelLabel(detail.provider)}
              {detail.phone ? ` · ${detail.phone}` : ""}
              {!detail.identityConfirmed ? " · número não confirmado" : ""}
            </span>
          </div>
          <div className={styles.chatActions}>
            {leadId && (
              <Link className={styles.headerLink} to={ROUTES.leadDetail(leadId)}>
                Abrir lead
              </Link>
            )}
            <button type="button" className={styles.headerLink} onClick={() => setShowLead((v) => !v)} aria-expanded={showLead}>
              {showLead ? "Ocultar detalhes" : "Detalhes"}
            </button>
          </div>
        </header>

        <div className={styles.messages} role="log" aria-live="polite">
          {messages.length === 0 && <p className={styles.muted}>Nenhuma mensagem ainda.</p>}
          {messages.map((m) => {
            const info = messageStatusInfo(m.status);
            return (
              <div key={m.id} className={`${styles.bubbleRow} ${m.direction === "out" ? styles.out : styles.in}`}>
                <div className={styles.bubble}>
                  {m.body ? <p className={styles.bubbleText}>{m.body}</p> : <p className={styles.muted}>[mensagem sem texto]</p>}
                  <span className={styles.bubbleMeta}>
                    {m.direction === "out" && m.sentBy?.name ? `${m.sentBy.name} · ` : ""}
                    <time dateTime={m.at}>{formatDateTime(m.at)}</time>
                    {m.direction === "out" && (
                      <span className={`${styles.status} ${styles[info.tone]}`} title={info.label} aria-label={info.label}>
                        {info.icon}
                      </span>
                    )}
                  </span>
                  {canRetry(m.status) && (
                    <span className={styles.failLine}>
                      {describeSendError(m.error) ?? info.label}{" "}
                      <button type="button" className={styles.linkish} onClick={() => void retry(m)}>
                        Reenviar
                      </button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>

        <footer className={styles.composer}>
          {detail.reply.allowed ? (
            <>
              {hint && <p className={styles.windowHint}>{hint}</p>}
              <div className={styles.composerRow}>
                <textarea
                  className={styles.input}
                  rows={2}
                  placeholder="Escreva a resposta (Enter envia, Shift+Enter quebra linha)"
                  aria-label="Mensagem"
                  value={text}
                  maxLength={4096}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={sending}
                />
                <Button variant="primary" onClick={() => void send()} disabled={sending || !text.trim()}>
                  {sending ? "Enviando…" : "Enviar"}
                </Button>
              </div>
            </>
          ) : (
            <p className={styles.blocked}>{detail.reply.reason ?? "Não é possível responder agora."}</p>
          )}
        </footer>
      </section>
      {showLead && (
        <LeadSidePanel
          conversationId={conversationId}
          lead={summary?.lead ?? null}
          leadId={leadId}
          identityConfirmed={detail.identityConfirmed}
          onClose={() => setShowLead(false)}
          onChanged={() => {
            onChanged();
            void load().catch(() => undefined);
          }}
        />
      )}
    </>
  );
}
