import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { can } from "../auth/permissions";
import { EmptyState } from "../components/common/EmptyState";
import { SkeletonRows } from "../components/common/Skeleton";
import { ChatPanel } from "../components/conversations/ChatPanel";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useIsMobile } from "../hooks/useMediaQuery";
import { usePageTitle } from "../hooks/usePageTitle";
import { usePipelines } from "../hooks/usePipelines";
import { usePolling } from "../hooks/usePolling";
import { useTeamDirectory } from "../hooks/useTeamDirectory";
import { conversationsService } from "../services/MessagingService";
import { describeError } from "../utils/apiErrors";
import {
  channelLabel,
  POLL_MS,
  shortWhen,
  type ConversationFilter,
  type ConversationSummary,
} from "../utils/messaging";
import styles from "../components/conversations/Conversations.module.css";

/**
 * Conversas (WhatsApp e Instagram) — a caixa de entrada comercial. Gestor/admin veem tudo; o
 * vendedor vê as dos leads dele e as que ainda não têm dono. Responsável, etapa e tags continuam
 * sendo do LEAD (mesmas rotas e regras da tela de leads). A tela se atualiza sozinha.
 */
export function ConversationsPage() {
  usePageTitle("Conversas");
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const seesAll = can(user, "leads.viewAll");
  const pipelines = usePipelines();
  const team = useTeamDirectory();

  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 300);
  const [ownerId, setOwnerId] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [unread, setUnread] = useState(false);
  const filter: ConversationFilter = useMemo(
    () => ({ q: q || undefined, ownerId: ownerId || undefined, pipelineId: pipelineId || undefined, stageId: stageId || undefined, unread }),
    [q, ownerId, pipelineId, stageId, unread],
  );

  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback(async () => {
    const page = await conversationsService.list(filter);
    // atualiza a 1ª página e mantém as mais antigas que a pessoa já carregou ("Carregar mais")
    const fresh = new Set(page.items.map((c) => c.id));
    const oldest = page.items.at(-1)?.lastMessageAt ?? "";
    setItems((current) => [
      ...page.items,
      ...(page.nextBefore && current
        ? current.filter((c) => !fresh.has(c.id) && (c.lastMessageAt ?? "") < oldest)
        : []),
    ]);
    setNextBefore((prev) => (prev && page.nextBefore ? prev : page.nextBefore));
    setError(null);
  }, [filter]);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setNextBefore(null);
    conversationsService
      .list(filter)
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
        setNextBefore(page.nextBefore);
        setError(null);
      })
      .catch((err: unknown) => alive && setError(describeError(err, "Não foi possível carregar as conversas.")));
    return () => {
      alive = false;
    };
  }, [filter]);

  usePolling(refresh, POLL_MS.list, items !== null);

  async function loadMore() {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const page = await conversationsService.list(filter, nextBefore);
      setItems((current) => {
        const seen = new Set((current ?? []).map((c) => c.id));
        return [...(current ?? []), ...page.items.filter((c) => !seen.has(c.id))];
      });
      setNextBefore(page.nextBefore);
    } finally {
      setLoadingMore(false);
    }
  }

  const stages = pipelines.data?.find((p) => p.id === pipelineId)?.stages ?? [];
  const selected = items?.find((c) => c.id === id) ?? null;
  const showList = !isMobile || !id;
  const showChat = !isMobile || Boolean(id);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Conversas</h1>
        <p className={styles.subtitle}>WhatsApp e Instagram da empresa. Responda por aqui; o histórico fica no lead.</p>
      </header>

      <div className={styles.layout}>
        {showList && (
          <aside className={styles.listPane} aria-label="Lista de conversas">
            <div className={styles.filters}>
              <input
                type="search"
                className={styles.search}
                placeholder="Buscar por nome ou telefone"
                aria-label="Buscar conversa"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className={styles.filterRow}>
                {seesAll && (
                  <select aria-label="Responsável" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                    <option value="">Todos os responsáveis</option>
                    {(team.data ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  aria-label="Pipeline"
                  value={pipelineId}
                  onChange={(e) => {
                    setPipelineId(e.target.value);
                    setStageId("");
                  }}
                >
                  <option value="">Todos os pipelines</option>
                  {(pipelines.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {pipelineId && (
                  <select aria-label="Etapa" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                    <option value="">Todas as etapas</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
                <label className={styles.unreadToggle}>
                  <input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} />
                  Não lidas
                </label>
              </div>
            </div>

            {error && <p className={styles.errorLine}>{error}</p>}
            {items === null && !error && <SkeletonRows rows={6} label="Carregando as conversas" />}
            {items?.length === 0 && (
              <EmptyState
                title="Nenhuma conversa"
                message={
                  q || ownerId || pipelineId || unread
                    ? "Nada encontrado com estes filtros."
                    : "Quando um cliente escrever no WhatsApp ou no Instagram da empresa, a conversa aparece aqui."
                }
              />
            )}
            <ul className={styles.list}>
              {items?.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`${styles.item} ${c.id === id ? styles.itemActive : ""}`}
                    onClick={() => navigate(ROUTES.conversaDetail(c.id))}
                    aria-current={c.id === id ? "true" : undefined}
                  >
                    <span className={`${styles.channel} ${c.provider === "instagram" ? styles.channelIg : styles.channelWa}`}>
                      {channelLabel(c.provider)}
                    </span>
                    <span className={styles.itemTop}>
                      <span className={styles.itemTitle}>{c.title}</span>
                      <span className={styles.itemWhen}>{shortWhen(c.lastMessageAt)}</span>
                    </span>
                    <span className={styles.itemBottom}>
                      <span className={styles.preview}>
                        {c.lastDirection === "out" ? "Você: " : ""}
                        {c.lastPreview ?? ""}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className={styles.unread} aria-label={`${c.unreadCount} não lidas`}>
                          {c.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className={styles.itemMeta}>
                      {c.lead
                        ? `${c.lead.owner?.name ?? "Sem responsável"}${c.lead.stage?.name ? ` · ${c.lead.stage.name}` : ""}`
                        : "Sem lead"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {nextBefore && (
              <button type="button" className={styles.more} onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? "Carregando…" : "Carregar mais"}
              </button>
            )}
          </aside>
        )}

        {showChat &&
          (id ? (
            <ChatPanel
              key={id}
              conversationId={id}
              summary={selected}
              onBack={isMobile ? () => navigate(ROUTES.conversas) : undefined}
              onChanged={() => void refresh()}
            />
          ) : (
            <section className={styles.chatEmpty}>
              <EmptyState title="Escolha uma conversa" message="Selecione uma conversa à esquerda para ler e responder." />
            </section>
          ))}
      </div>
    </div>
  );
}
