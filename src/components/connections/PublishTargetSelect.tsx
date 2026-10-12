import { useAuth } from "../../hooks/useAuth";
import { useMyConnections } from "../../hooks/useConnections";
import { hasFeature } from "../../auth/features";
import { eligibleTargets, PROVIDER_LABEL } from "../../utils/connections";
import form from "../common/Form.module.css";

/**
 * “Criar também no Google/Microsoft”. Só aparece se a empresa contratou a
 * funcionalidade e a pessoa tem conta conectada com destino escolhido. Vazio
 * = salvar só no CRM.
 */
export function PublishTargetSelect({
  kind,
  value,
  onChange,
}: {
  kind: "event" | "task";
  value: string;
  onChange: (connectionId: string) => void;
}) {
  const { user } = useAuth();
  const enabled = !!user && hasFeature(user, "calendar_task_integrations");
  if (!enabled) return null;
  return <Inner kind={kind} value={value} onChange={onChange} />;
}

function Inner({
  kind,
  value,
  onChange,
}: {
  kind: "event" | "task";
  value: string;
  onChange: (connectionId: string) => void;
}) {
  const { data } = useMyConnections();
  const targets = eligibleTargets(data ?? [], kind);
  if (targets.length === 0) return null;
  return (
    <label className={form.field}>
      <span className={form.label}>Criar também em</span>
      <select className={form.select} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Somente no CRM</option>
        {targets.map((c) => (
          <option key={c.id} value={c.id}>
            {PROVIDER_LABEL[c.provider]} — {c.accountEmail ?? "conta conectada"}
          </option>
        ))}
      </select>
      <span className={form.hint}>
        O item é criado no seu {kind === "event" ? "calendário" : "app de tarefas"} escolhido nas
        conexões.
      </span>
    </label>
  );
}
