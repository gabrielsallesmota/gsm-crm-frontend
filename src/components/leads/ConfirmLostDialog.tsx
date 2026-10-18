import { ConfirmDialog } from "../common/ConfirmDialog";

/**
 * D-03: marcar um lead como PERDIDO exige confirmação, qualquer que seja o caminho (painel, arrastar,
 * seletor "mover" do cartão). Uma única fonte do texto e do diálogo; o motivo da perda NÃO é pedido.
 * `onConfirm` devolve `true` quando terminou (o diálogo fecha); a chamada só acontece depois do clique.
 */
export function ConfirmLostDialog({
  leadName,
  stageLabel,
  onConfirm,
  onClose,
}: {
  leadName: string;
  stageLabel: string;
  onConfirm: () => Promise<boolean>;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      title="Marcar como perdido?"
      message={`"${leadName}" será movido para "${stageLabel}" e contado como negócio perdido. Você poderá movê-lo de volta depois.`}
      confirmLabel="Marcar como perdido"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
