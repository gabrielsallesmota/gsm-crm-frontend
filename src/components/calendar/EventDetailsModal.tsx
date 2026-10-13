import { Link } from "react-router-dom";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { SourceBadge } from "../connections/SourceBadge";
import { ROUTES } from "../../constants/routes";
import { whenLabel } from "../../utils/calendarGrid";
import type { CalEvent } from "../../types/event";
import form from "../common/Form.module.css";
import styles from "./EventDetailsModal.module.css";

const TYPE_LABEL: Record<string, string> = { reuniao: "Reunião", retorno: "Retorno", visita: "Visita" };

/** Detalhes de um compromisso. Os de Google/Microsoft são somente leitura aqui. */
export function EventDetailsModal({
  event,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalEvent;
  onClose: () => void;
  onEdit: (event: CalEvent) => void;
  onDelete: (event: CalEvent) => void;
}) {
  return (
    <Modal title={event.title} subtitle={whenLabel(event)} onClose={onClose}>
      <dl className={styles.facts}>
        <div>
          <dt>Tipo</dt>
          <dd>{TYPE_LABEL[event.type] ?? event.type}</dd>
        </div>
        <div>
          <dt>Lead</dt>
          <dd>
            {event.leadId ? (
              <Link to={ROUTES.leadDetail(event.leadId)} onClick={onClose}>
                {event.leadName ?? "Ver lead"}
              </Link>
            ) : (
              "Pessoal (sem lead)"
            )}
          </dd>
        </div>
        <div>
          <dt>Origem</dt>
          <dd>
            {event.source && event.source !== "crm" ? (
              <SourceBadge source={event.source} url={event.externalUrl} readOnly={event.readOnly} />
            ) : (
              "CRM"
            )}
          </dd>
        </div>
      </dl>
      {event.readOnly && (
        <p className={styles.note} role="note">
          Este compromisso vem do {event.source === "microsoft" ? "Microsoft" : "Google"} e é somente leitura no
          CRM. Para alterar, use o link “Abrir no {event.source === "microsoft" ? "Microsoft" : "Google"}”.
        </p>
      )}
      <div className={form.actions}>
        <Button type="button" onClick={onClose}>
          Fechar
        </Button>
        {!event.readOnly && (
          <>
            <Button type="button" variant="danger" onClick={() => onDelete(event)}>
              Excluir
            </Button>
            <Button type="button" variant="primary" onClick={() => onEdit(event)}>
              Editar
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
