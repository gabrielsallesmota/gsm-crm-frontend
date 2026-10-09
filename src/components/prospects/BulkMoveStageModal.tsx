import { useState } from "react";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { describeError } from "../../utils/apiErrors";
import type { Prospect, ProspectLossReason, ProspectStage } from "../../types/prospect";
import form from "../common/Form.module.css";

/**
 * "Mover todos" de uma coluna do quadro de Prospecção para outro estágio
 * (pedido do usuário: tirar de uma vez todos do P0 para "Perdido — Sem
 * resposta"). Move UM a UM pelo mesmo endpoint do arrastar card, então
 * cada prospect ganha o registro na linha do tempo, o motivo de perda e a
 * data alvo exatamente como no movimento manual — nada é gravado por fora.
 * Quem o backend recusar (ex.: sair do estágio de entrada sem primeiro
 * contato confirmado) fica listado no fim, os outros seguem.
 */
export function BulkMoveStageModal({
  fromStage,
  prospects,
  stages,
  lossReasons,
  move,
  onClose,
  onDone,
}: {
  fromStage: ProspectStage;
  prospects: Prospect[];
  stages: ProspectStage[];
  lossReasons: ProspectLossReason[];
  move: (
    prospectId: string,
    stageId: string,
    targetDate?: string | null,
    lossReasonId?: string | null,
  ) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const destinations = stages.filter((s) => s.id !== fromStage.id);
  const [targetId, setTargetId] = useState(destinations[0]?.id ?? "");
  const [lossReasonId, setLossReasonId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState<{ name: string; reason: string }[] | null>(null);

  const target = destinations.find((s) => s.id === targetId);
  const total = prospects.length;

  async function handleMove() {
    if (!target) return;
    setRunning(true);
    setProgress(0);
    const failed: { name: string; reason: string }[] = [];
    for (const [index, prospect] of prospects.entries()) {
      try {
        await move(
          prospect.id,
          target.id,
          target.asksTargetDate && targetDate ? targetDate : undefined,
          target.isLost && lossReasonId ? lossReasonId : undefined,
        );
      } catch (err) {
        failed.push({
          name: prospect.companyName,
          reason: describeError(err, "não foi possível mover"),
        });
      }
      setProgress(index + 1);
    }
    setRunning(false);
    setFailures(failed);
    onDone();
  }

  if (failures !== null) {
    return (
      <Modal title="Prospects movidos" onClose={onClose}>
        <p style={{ margin: "8px 0" }}>
          {total - failures.length} de {total} movidos para "{target?.name}".
        </p>
        {failures.length > 0 && (
          <>
            <p className={form.error}>Estes não foram movidos:</p>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }}>
              {failures.map((f) => (
                <li key={f.name}>
                  {f.name} — {f.reason}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className={form.actions}>
          <Button variant="primary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Mover todos de "${fromStage.name}"`}
      subtitle={`${total} prospect(s) desta coluna (os que estão carregados no quadro com o período atual).`}
      onClose={running ? () => undefined : onClose}
    >
      <div className={form.form}>
        <label className={form.field}>
          <span className={form.label}>Para o estágio</span>
          <select
            className={form.select}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            disabled={running}
          >
            {destinations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isLost ? " (perdido)" : s.isWon ? " (ganho)" : ""}
              </option>
            ))}
          </select>
        </label>

        {target?.isLost && (
          <label className={form.field}>
            <span className={form.label}>Motivo da perda</span>
            <select
              className={form.select}
              value={lossReasonId}
              onChange={(e) => setLossReasonId(e.target.value)}
              disabled={running}
            >
              <option value="">Sem motivo</option>
              {lossReasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {lossReasons.length === 0 && (
              <span className={form.hint}>
                Nenhum motivo cadastrado — crie em "Motivos de perda" (topo do quadro).
              </span>
            )}
          </label>
        )}

        {target?.asksTargetDate && !target.isLost && (
          <label className={form.field}>
            <span className={form.label}>Data alvo (opcional)</span>
            <input
              className={form.input}
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={running}
            />
            <span className={form.hint}>
              Se a cadência automática cobrir este estágio, a data é calculada sozinha.
            </span>
          </label>
        )}

        {running && (
          <p className={form.hint} role="status">
            Movendo {progress} de {total}…
          </p>
        )}

        <div className={form.actions}>
          <Button onClick={onClose} disabled={running}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleMove()}
            disabled={running || !target || total === 0}
          >
            {running ? "Movendo…" : `Mover ${total} prospect(s)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
