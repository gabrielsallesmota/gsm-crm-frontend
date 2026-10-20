import { Link } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import type { Attention, StalledLead } from "../../types/dashboard";
import styles from "./AttentionPanel.module.css";

interface Item {
  key: string;
  count: number;
  label: string;
  to: string;
  tone: "red" | "amber" | "blue";
}

/**
 * "O que pede ação agora": tarefas atrasadas e de hoje, leads parados, renovações próximas e
 * clientes com parcela vencida. Não depende do período filtrado — é a fila de trabalho do dia.
 * Zero em tudo → mensagem de "em dia" (nunca uma lista vazia sem explicação).
 */
export function AttentionPanel({
  attention,
  stalled,
  scope,
}: {
  attention: Attention;
  stalled: StalledLead[];
  scope: "seus" | "da equipe";
}) {
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const items: Item[] = [
    {
      key: "overdue",
      count: attention.tasksOverdue,
      label: attention.tasksOverdue === 1 ? "tarefa atrasada" : "tarefas atrasadas",
      to: ROUTES.tarefas,
      tone: "red",
    },
    {
      key: "today",
      count: attention.tasksToday,
      label: attention.tasksToday === 1 ? "tarefa para hoje" : "tarefas para hoje",
      to: ROUTES.tarefas,
      tone: "amber",
    },
    {
      key: "stalled",
      count: attention.stalledLeads,
      label: attention.stalledLeads === 1 ? "lead parado há 7+ dias" : "leads parados há 7+ dias",
      to: ROUTES.leads,
      tone: "amber",
    },
    {
      key: "debt",
      count: attention.clientsOverdue,
      label:
        attention.clientsOverdue === 1
          ? "cliente com parcela vencida"
          : "clientes com parcela vencida",
      to: ROUTES.clientes,
      tone: "red",
    },
    {
      key: "renew",
      count: attention.renewalsNext30Days,
      label:
        attention.renewalsNext30Days === 1
          ? "renovação nos próximos 30 dias"
          : "renovações nos próximos 30 dias",
      to: ROUTES.clientes,
      tone: "blue",
    },
  ];
  const pending = items.filter((i) => i.count > 0);

  return (
    <section className={styles.card} aria-labelledby="dash-attention">
      <div className={styles.head}>
        <h2 id="dash-attention" className={styles.title}>
          Precisa de atenção
        </h2>
        <span className={styles.sub}>
          {scope === "seus" ? "seus itens" : "toda a equipe"} · agora
        </span>
      </div>
      {pending.length === 0 ? (
        <p className={styles.ok}>
          Tudo em dia: nenhuma tarefa atrasada, lead parado, parcela vencida ou renovação próxima.
        </p>
      ) : (
        <ul className={styles.list}>
          {pending.map((item) => (
            <li key={item.key}>
              <Link to={item.to} className={styles.row}>
                <span className={`${styles.count} ${styles[item.tone]}`}>{item.count}</span>
                <span className={styles.label}>{item.label}</span>
                <span className={styles.go} aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {stalled.length > 0 && (
        <div className={styles.stalled}>
          <h3 className={styles.subtitle}>Mais tempo sem contato</h3>
          <ul className={styles.stalledList}>
            {stalled.map((lead) => (
              <li key={lead.id}>
                <Link to={ROUTES.leadDetail(lead.id)} className={styles.stalledRow}>
                  <span className={styles.stalledName}>{lead.name}</span>
                  <span className={styles.stalledDays}>{plural(lead.days, "dia", "dias")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
