import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavIcon } from "./NavIcon";
import { inboxService } from "../../services/InboxService";
import { useAuth } from "../../hooks/useAuth";
import { formatDateTime } from "../../utils/datetime";
import type { InboxItem } from "../../types/inbox";
import styles from "./NotificationBell.module.css";

const POLL_MS = 60_000;

/** Sino da barra superior: avisos de tarefa/compromisso atrelado à pessoa.
 * Consulta a cada minuto (e ao voltar para a aba) e abre a lista ao clicar;
 * clicar num aviso marca como lido e leva à tela dele. */
export function NotificationBell() {
  const { user, currentTenantId } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const page = await inboxService.list();
      setItems(page.items);
      setUnread(page.unread);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, currentTenantId, refresh]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function openItem(item: InboxItem) {
    setOpen(false);
    if (!item.read) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
      setUnread((n) => Math.max(0, n - 1));
      try {
        await inboxService.markRead(item.id);
      } catch {
        void refresh();
      }
    }
    if (item.link) navigate(item.link);
  }

  async function readAll() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    try {
      await inboxService.markAllRead();
    } catch {
      void refresh();
    }
  }

  const label = unread > 0 ? `Avisos: ${unread} não lido${unread > 1 ? "s" : ""}` : "Avisos";

  return (
    <div className={styles.root} ref={root}>
      <button
        type="button"
        className={styles.bell}
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
      >
        <NavIcon name="bell" size={17} />
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Avisos">
          <div className={styles.head}>
            <strong>Avisos</strong>
            {unread > 0 && (
              <button type="button" className={styles.link} onClick={() => void readAll()}>
                Marcar todos como lidos
              </button>
            )}
          </div>
          {failed && <p className={styles.empty}>Não foi possível carregar os avisos agora.</p>}
          {!failed && items.length === 0 && <p className={styles.empty}>Nada por aqui ainda.</p>}
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.read ? styles.item : `${styles.item} ${styles.unread}`}
                  onClick={() => void openItem(item)}
                >
                  <span className={styles.title}>{item.title}</span>
                  <span className={styles.body}>{item.body}</span>
                  <span className={styles.when}>{formatDateTime(item.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
