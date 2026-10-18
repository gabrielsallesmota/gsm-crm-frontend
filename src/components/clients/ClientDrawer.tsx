import { useRef, useState } from "react";
import type { Client } from "../../types/client";
import { CLIENT_SOURCE_LABEL } from "../../types/client";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { ContractsSection } from "./ContractsSection";
import { useClientActions } from "../../hooks/useClientActions";
import { useClientAccess } from "../../hooks/useClientAccess";
import { useTeamDirectory } from "../../hooks/useTeamDirectory";
import { useToast } from "../../hooks/useToast";
import { formatPhone } from "../../utils/phone";
import { fmtDate, renewalUrgency, toIsoDate } from "../../utils/renewal";
import styles from "./ClientDrawer.module.css";

type FormState = ReturnType<typeof fromClient>;

function fromClient(client: Client) {
  return {
    companyName: client.companyName,
    phone: client.phone,
    email: client.email,
    city: client.city,
    niche: client.niche,
    notes: client.notes,
    ownerId: client.ownerId ?? "",
    // Fallback pra "hoje": `closedAt` é campo novo no backend — se a API
    // ainda não foi atualizada (deploy de frontend/backend independentes),
    // evita um input de data controlado virar não-controlado com "".
    closedAt: client.closedAt || toIsoDate(new Date()),
  };
}

/**
 * Ficha do cliente: dados, responsável, contratos com renovação e parcelas, e o PDF do contrato
 * assinado. Todos veem; só admin e gestor alteram valores, contratos, parcelas e excluem.
 */
export function ClientDrawer({
  client,
  onClose,
  onSaved,
  onDeleted,
  onReload,
}: {
  client: Client;
  onClose: () => void;
  /** Cliente foi editado direto (dados cadastrais, contrato) — o objeto
   * novo já vem completo do backend, pode substituir o da lista sem
   * recarregar tudo. */
  onSaved?: (client: Client) => void;
  onDeleted?: () => void;
  /** Algo mudou que NÃO devolve um `Client` pronto (contratos/parcelas), mas afeta campos
   * calculados que a lista mostra (próx. vencimento/renovação) — pede pra página recarregar. */
  onReload?: () => void;
}) {
  const { toast, toastError } = useToast();
  const { canManage } = useClientAccess();
  const {
    update,
    delete: deleteClient,
    uploadContractFile,
    downloadContractFile,
    deleteContractFile,
  } = useClientActions();
  const { data: team } = useTeamDirectory();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contractBusy, setContractBusy] = useState(false);
  const [form, setForm] = useState<FormState>(() => fromClient(client));

  const ownerName = team?.find((m) => m.id === client.ownerId)?.name;
  const renewalUrgent = client.nextRenewalDate
    ? renewalUrgency(client.nextRenewalDate, toIsoDate(new Date()))
    : null;

  function startEdit() {
    setForm(fromClient(client));
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { ownerId, ...rest } = form;
      const updated = await update(client.id, ownerId ? { ...rest, ownerId } : rest);
      toast("Cliente atualizado com sucesso");
      setEditing(false);
      onSaved?.(updated);
    } catch (err) {
      toastError(err, "Não foi possível salvar as alterações");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteClient(client.id);
      toast("Cliente removido");
      onDeleted?.();
    } catch (err) {
      toastError(err, "Não foi possível remover o cliente");
      setDeleting(false);
    }
  }

  async function handleUploadFile(file: File) {
    setUploading(true);
    try {
      const updated = await uploadContractFile(client.id, file);
      toast("Contrato enviado com sucesso");
      onSaved?.(updated);
    } catch (err) {
      toastError(err, "Não foi possível enviar o contrato");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDownload() {
    setContractBusy(true);
    try {
      const blob = await downloadContractFile(client.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = client.contractFileName ?? "contrato.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err, "Não foi possível baixar o contrato");
    } finally {
      setContractBusy(false);
    }
  }

  async function handleDeleteContractFile() {
    setContractBusy(true);
    try {
      const updated = await deleteContractFile(client.id);
      toast("Contrato removido");
      onSaved?.(updated);
    } catch (err) {
      toastError(err, "Não foi possível remover o contrato");
    } finally {
      setContractBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={`Cliente ${client.companyName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.close} onClick={onClose} aria-label="Fechar">
          ✕
        </button>

        <div className={styles.header}>
          <div>
            {editing ? (
              <input
                className={styles.editInput}
                aria-label="Nome da empresa"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            ) : (
              <h2 className={styles.name}>{client.companyName}</h2>
            )}
            <div className={styles.badges}>
              <Badge
                label={CLIENT_SOURCE_LABEL[client.source]}
                color="var(--tone-blue-text)"
                bg="var(--tone-blue-bg)"
              />
              {client.hasOverdueInstallment && (
                <Badge label="Parcela atrasada" color="var(--tone-red-text)" bg="var(--tone-red-bg)" />
              )}
              {renewalUrgent === "overdue" && (
                <Badge label="Renovação vencida" color="var(--tone-red-text)" bg="var(--tone-red-bg)" />
              )}
              {renewalUrgent === "soon" && (
                <Badge label="Renova em breve" color="var(--tone-amber-text)" bg="var(--tone-amber-bg)" />
              )}
            </div>
          </div>
          {!editing && (
            <Button className={styles.editToggle} onClick={startEdit}>
              Editar
            </Button>
          )}
        </div>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Dados do cliente</h3>
          {editing ? (
            <>
              <input
                className={styles.editInput}
                placeholder="Telefone"
                aria-label="Telefone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
              />
              <input
                className={styles.editInput}
                placeholder="E-mail"
                aria-label="E-mail"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                className={styles.editInput}
                placeholder="Cidade"
                aria-label="Cidade"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <input
                className={styles.editInput}
                placeholder="Nicho"
                aria-label="Nicho"
                value={form.niche}
                onChange={(e) => setForm({ ...form, niche: e.target.value })}
              />
              <label className={styles.label}>
                Responsável (recebe as tarefas de renovação)
                <select
                  className={styles.editInput}
                  value={form.ownerId}
                  onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
                >
                  <option value="">Sem responsável</option>
                  {(team ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                Data de fechamento
                <input
                  className={styles.editInput}
                  type="date"
                  value={form.closedAt}
                  onChange={(e) => setForm({ ...form, closedAt: e.target.value })}
                />
              </label>
              <textarea
                className={styles.editTextarea}
                placeholder="Observações"
                aria-label="Observações"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <div className={styles.formActions}>
                <Button onClick={() => setEditing(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </>
          ) : (
            <dl className={styles.fieldList}>
              <div className={styles.field}>
                <dt>Telefone</dt>
                <dd>{client.phone || "—"}</dd>
              </div>
              <div className={styles.field}>
                <dt>E-mail</dt>
                <dd>{client.email || "—"}</dd>
              </div>
              <div className={styles.field}>
                <dt>Cidade</dt>
                <dd>{client.city || "—"}</dd>
              </div>
              <div className={styles.field}>
                <dt>Nicho</dt>
                <dd>{client.niche || "—"}</dd>
              </div>
              <div className={styles.field}>
                <dt>Responsável</dt>
                <dd>{ownerName ?? (client.ownerId ? "—" : "Sem responsável")}</dd>
              </div>
              <div className={styles.field}>
                <dt>Data de fechamento</dt>
                <dd>{fmtDate(client.closedAt)}</dd>
              </div>
              {client.notes && (
                <div className={styles.field}>
                  <dt>Observações</dt>
                  <dd>{client.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </section>

        <ContractsSection
          clientId={client.id}
          canManage={canManage}
          onChanged={() => onReload?.()}
        />

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Contrato assinado (PDF)</h3>
          {client.contractFileName ? (
            <div className={styles.contractRow}>
              <span className={styles.contractName}>📄 {client.contractFileName}</span>
              <div className={styles.contractActions}>
                <Button onClick={() => void handleDownload()} disabled={contractBusy}>
                  Baixar
                </Button>
                {canManage && (
                  <Button
                    variant="danger"
                    onClick={() => void handleDeleteContractFile()}
                    disabled={contractBusy}
                  >
                    Remover
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className={styles.mutedText}>Nenhum contrato anexado ainda.</p>
          )}
          {canManage && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                aria-label="Arquivo do contrato (PDF)"
                className={styles.fileInput}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadFile(file);
                }}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading
                  ? "Enviando…"
                  : client.contractFileName
                    ? "Substituir contrato (PDF)"
                    : "Anexar contrato (PDF)"}
              </Button>
            </>
          )}
        </section>

        {canManage && (
          <section className={styles.dangerZone}>
            {!confirmingDelete ? (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                Remover cliente
              </Button>
            ) : (
              <div className={styles.confirmBox}>
                <EmptyState
                  title="Remover este cliente?"
                  message="Isso apaga também os contratos, as parcelas e o PDF anexado. Não afeta o lead de origem."
                />
                <div className={styles.formActions}>
                  <Button onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                    Cancelar
                  </Button>
                  <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
                    {deleting ? "Removendo…" : "Confirmar remoção"}
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
