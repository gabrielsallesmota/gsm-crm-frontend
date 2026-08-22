import { useState } from "react";
import { useProspectStages } from "../../hooks/useProspectStages";
import { useProspects } from "../../hooks/useProspects";
import { useProspectActions } from "../../hooks/useProspectActions";
import { useMessageTemplates } from "../../hooks/useMessageTemplates";
import { EmptyState } from "../common/EmptyState";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ProspectDrawer } from "./ProspectDrawer";
import { ProspectImportModal } from "./ProspectImportModal";
import { ManageStagesModal } from "./ManageStagesModal";
import { WhatsappButton } from "./WhatsappButton";
import { useToast } from "../../hooks/useToast";
import { prospectsService } from "../../services/ProspectsService";
import { ApiError } from "../../types/common";
import { PRIORITY, PROSPECT_ORIGIN, WHATSAPP_STATUS } from "../../constants/prospectEnums";
import type { Period } from "../../utils/periods";
import type {
  CreateProspectInput,
  MessageTemplate,
  Prospect,
  ProspectOrigin,
} from "../../types/prospect";
import styles from "./ProspectionBoard.module.css";

const ATIVO_BADGE = { label: "Ativo", color: "#a78bfa", bg: "rgba(167,139,250,.16)" };

/**
 * Seção "Ativo (prospecção)" dentro do Pipeline unificado — visão só de
 * super admin. Kanban próprio (estágios/dados de `prospects`, isolados do
 * `leads`), mas vive na mesma tela que o funil normal (ver `PipelinePage`).
 */
export function ProspectionBoard({ period }: { period: Period }) {
  const {
    data: stages,
    loading: loadingStages,
    error: stagesError,
    notImplemented,
    reload: reloadStages,
  } = useProspectStages();
  const { move } = useProspectActions();
  const { toast } = useToast();
  const { data: templates } = useMessageTemplates();

  const { data, loading, error, reload } = useProspects({ ...period, page: 1, pageSize: 200 });
  const [dragId, setDragId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [managingStages, setManagingStages] = useState(false);

  async function handleDrop(stageId: string) {
    if (!dragId) return;
    const prospectId = dragId;
    setDragId(null);
    await move(prospectId, stageId);
    reload();
  }

  function handleExport() {
    void (async () => {
      try {
        const csv = await prospectsService.exportCsv();
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "prospeccao-gsm.csv";
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Não foi possível exportar.");
      }
    })();
  }

  if (notImplemented) {
    return (
      <div>
        <div className={styles.header}>
          <div>
            <h2 className={styles.sectionTitle}>
              <Badge {...ATIVO_BADGE} />
              Prospecção GSM
            </h2>
          </div>
        </div>
        <EmptyState
          title="Não disponível no modo Demonstração"
          message="Prospecção GSM é uma área interna da GSM Automação, sem dados fictícios para mostrar aqui. Acesse com a conta real de super admin para usar."
        />
      </div>
    );
  }

  if (stagesError) {
    return <EmptyState title="Não foi possível carregar os estágios" message={stagesError.message} />;
  }
  if (loadingStages) return <div className={styles.loading}>Carregando…</div>;

  const prospects = data?.items ?? [];
  const selected = prospects.find((p) => p.id === selectedId) ?? null;
  const firstStageId = stages?.[0]?.id;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h2 className={styles.sectionTitle}>
            <Badge {...ATIVO_BADGE} />
            Prospecção GSM
          </h2>
          <p className={styles.sectionSubtitle}>
            {data ? `${data.total} prospects` : "Carregando…"} — carteira comercial interna
          </p>
        </div>
        <div className={styles.toolbar}>
          <Button onClick={() => setManagingStages(true)}>Estágios</Button>
          <Button onClick={() => setImporting(true)}>Importar CSV</Button>
          <Button onClick={handleExport}>Exportar CSV</Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Novo prospect
          </Button>
        </div>
      </div>

      {error && <EmptyState title="Não foi possível carregar os prospects" message={error.message} />}

      {!error && stages && stages.length === 0 && (
        <EmptyState
          title="Nenhum estágio cadastrado ainda"
          message='Clique em "Estágios" para criar a primeira coluna da pipeline.'
        />
      )}

      {!error && stages && stages.length > 0 && (
        <div className={styles.board}>
          {stages.map((stage) => {
            const stageProspects = prospects.filter((p) => p.stageId === stage.id);
            return (
              <div
                key={stage.id}
                className={styles.column}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => void handleDrop(stage.id)}
              >
                <div className={styles.columnHeader}>
                  <span className={styles.columnDot} style={{ background: stage.color }} />
                  <span className={styles.columnLabel}>{stage.name}</span>
                  <span className={styles.columnCount}>{stageProspects.length}</span>
                </div>
                <div className={styles.cards}>
                  {stageProspects.map((prospect) => (
                    <ProspectCard
                      key={prospect.id}
                      prospect={prospect}
                      templates={templates ?? []}
                      onDragStart={() => setDragId(prospect.id)}
                      onClick={() => setSelectedId(prospect.id)}
                    />
                  ))}
                  {stageProspects.length === 0 && !loading && (
                    <div className={styles.empty}>Sem prospects</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <ProspectDrawer
          prospect={selected}
          stages={stages ?? []}
          templates={templates ?? []}
          onClose={() => setSelectedId(null)}
          onSaved={() => reload()}
          onDeleted={() => {
            setSelectedId(null);
            reload();
          }}
        />
      )}

      {creating && stages && firstStageId && (
        <QuickCreateModal
          defaultStageId={firstStageId}
          stages={stages}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}

      {importing && stages && firstStageId && (
        <ProspectImportModal
          stages={stages}
          defaultStageId={firstStageId}
          onClose={() => setImporting(false)}
          onImported={() => reload()}
        />
      )}

      {managingStages && (
        <ManageStagesModal
          stages={stages ?? []}
          onClose={() => setManagingStages(false)}
          onChanged={() => {
            reloadStages();
            reload();
          }}
        />
      )}
    </div>
  );
}

function ProspectCard({
  prospect,
  templates,
  onDragStart,
  onClick,
}: {
  prospect: Prospect;
  templates: MessageTemplate[];
  onDragStart: () => void;
  onClick: () => void;
}) {
  const priority = PRIORITY[prospect.priority];
  const whatsapp = WHATSAPP_STATUS[prospect.whatsappStatus];
  return (
    <div className={styles.card} draggable onDragStart={onDragStart} onClick={onClick}>
      <div className={styles.cardTop}>
        <div className={styles.cardName}>{prospect.companyName}</div>
        <Badge label={priority.label} color={priority.color} bg={priority.bg} />
      </div>
      <div className={styles.cardMeta}>
        {[prospect.city, prospect.niche].filter(Boolean).join(" · ") || "—"}
      </div>
      <div className={styles.cardFooter}>
        <span className={styles.cardMeta}>{prospect.phoneRaw || "sem telefone"}</span>
        <Badge label={whatsapp.label} color={whatsapp.color} bg={whatsapp.bg} />
      </div>
      <WhatsappButton prospect={prospect} templates={templates} size="small" />
    </div>
  );
}

function QuickCreateModal({
  defaultStageId,
  stages,
  onClose,
  onCreated,
}: {
  defaultStageId: string;
  stages: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { create } = useProspectActions();
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [stageId, setStageId] = useState(defaultStageId);
  const [origin, setOrigin] = useState<ProspectOrigin>("google_maps");
  const [submitting, setSubmitting] = useState(false);
  const [duplicateNote, setDuplicateNote] = useState(false);

  async function handleSubmit(force = false) {
    if (!companyName.trim()) return;
    setSubmitting(true);
    setDuplicateNote(false);
    try {
      const input: CreateProspectInput = {
        stageId,
        companyName: companyName.trim(),
        origin,
        force,
        ...(phoneRaw.trim() ? { phoneRaw: phoneRaw.trim() } : {}),
      };
      await create(input);
      toast("Prospect criado com sucesso");
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDuplicateNote(true);
      } else {
        toast(err instanceof Error ? err.message : "Não foi possível criar o prospect");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Novo prospect</h2>
        <input
          className={styles.input}
          placeholder="Nome da empresa"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Telefone"
          value={phoneRaw}
          onChange={(e) => setPhoneRaw(e.target.value)}
        />
        <select className={styles.select} value={stageId} onChange={(e) => setStageId(e.target.value)}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={origin}
          onChange={(e) => setOrigin(e.target.value as ProspectOrigin)}
        >
          {Object.entries(PROSPECT_ORIGIN).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        {duplicateNote && <p className={styles.duplicateNote}>Já existe um prospect com esse telefone.</p>}
        <div className={styles.modalActions}>
          <Button onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          {duplicateNote ? (
            <Button variant="primary" onClick={() => void handleSubmit(true)} disabled={submitting}>
              Cadastrar mesmo assim
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => void handleSubmit(false)}
              disabled={submitting || !companyName.trim()}
            >
              {submitting ? "Salvando…" : "Criar prospect"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
