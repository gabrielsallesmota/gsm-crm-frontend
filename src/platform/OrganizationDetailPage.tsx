import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOrganization, usePlatformCatalog } from "../hooks/usePlatform";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { platformService } from "../services/PlatformService";
import { Button } from "../components/common/Button";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { EmptyState } from "../components/common/EmptyState";
import { Modal } from "../components/common/Modal";
import { ROUTES } from "../constants/routes";
import { formatDateTime } from "../utils/datetime";
import type { FeatureDefinition, PlanOption, TenantDetail } from "../types/platform";
import { ReasonDialog } from "./ReasonDialog";
import { StatusPill } from "./StatusPill";
import form from "../components/common/Form.module.css";
import styles from "./Platform.module.css";

const SUPPORT_DURATIONS = [15, 30, 60];

export function OrganizationDetailPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useOrganization(id);
  const { data: catalog } = usePlatformCatalog();
  const { toast, toastError } = useToast();
  const [editing, setEditing] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  if (error) {
    return (
      <EmptyState
        title="Não foi possível carregar a organização"
        message={error.message}
        action={{ label: "Tentar de novo", onClick: reload }}
      />
    );
  }
  if (loading && !data) return <p className={styles.muted}>Carregando…</p>;
  if (!data) return null;
  const org = data.organization;

  async function suspend(reason: string): Promise<boolean> {
    try {
      await platformService.suspendOrganization(org.id, reason);
      toast("Organização suspensa — acesso, integrações e API bloqueados. Nenhum dado apagado.");
      reload();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível suspender.");
      return false;
    }
  }

  async function reactivate(): Promise<boolean> {
    try {
      await platformService.reactivateOrganization(org.id);
      toast("Organização reativada — acesso restaurado.");
      reload();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível reativar.");
      return false;
    }
  }

  return (
    <div>
      <p className={styles.muted} style={{ margin: "0 0 8px" }}>
        <Link to={ROUTES.platformOrganizations}>← Organizações</Link>
      </p>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>
            {org.name} <StatusPill status={org.status} internal={org.isPlatformInternal} />
          </h1>
          <p className={styles.subtitle}>
            <span className={styles.code}>{org.slug}</span> · plano {org.planName ?? "—"} ·{" "}
            {org.activeUsers} usuário(s) ativo(s) · criada em {formatDateTime(org.createdAt)}
          </p>
        </div>
        <div className={styles.actions}>
          <Button onClick={() => setEditing(true)}>Editar</Button>
          <Link
            to={`${ROUTES.platformAudit}?account=${org.id}`}
            className={styles.backLink}
            style={{ color: "inherit" }}
          >
            Auditoria
          </Link>
          {org.status === "suspended" ? (
            <Button variant="primary" onClick={() => setReactivating(true)}>
              Reativar
            </Button>
          ) : (
            !org.isPlatformInternal && (
              <Button variant="danger" onClick={() => setSuspending(true)}>
                Suspender
              </Button>
            )
          )}
        </div>
      </div>

      {org.status === "suspended" && (
        <div className={`${styles.notice} ${styles.danger}`} role="status">
          Suspensa em {org.suspendedAt ? formatDateTime(org.suspendedAt) : "—"}
          {org.suspensionReason ? ` — motivo: ${org.suspensionReason}` : ""}. Login, sessões
          abertas, API Keys e integrações estão bloqueados. Os dados continuam intactos.
        </div>
      )}

      {data.tenants.map((tenant) => (
        <TenantPanel
          key={tenant.id}
          tenant={tenant}
          features={catalog?.features ?? []}
          onChanged={reload}
        />
      ))}

      {editing && catalog && (
        <EditOrganizationModal
          name={org.name}
          planCode={org.planCode ?? ""}
          plans={catalog.plans}
          onClose={() => setEditing(false)}
          onSaved={reload}
          orgId={org.id}
        />
      )}
      {suspending && (
        <ReasonDialog
          title={`Suspender ${org.name}?`}
          message="Todos os usuários perdem o acesso na hora (inclusive sessões abertas), e API Keys/integrações passam a ser recusadas. Nada é apagado; reativar restaura o acesso."
          confirmLabel="Suspender"
          danger
          onConfirm={suspend}
          onClose={() => setSuspending(false)}
        />
      )}
      {reactivating && (
        <ConfirmDialog
          title={`Reativar ${org.name}?`}
          message="O acesso de todos os usuários e integrações volta a funcionar."
          confirmLabel="Reativar"
          onConfirm={reactivate}
          onClose={() => setReactivating(false)}
        />
      )}
    </div>
  );
}

function TenantPanel({
  tenant,
  features,
  onChanged,
}: {
  tenant: TenantDetail;
  features: FeatureDefinition[];
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const { startImpersonation } = useAuth();
  const [draft, setDraft] = useState<Record<string, boolean>>(tenant.features);
  const [saving, setSaving] = useState(false);
  const [support, setSupport] = useState(false);
  const [duration, setDuration] = useState(30);
  const [suspending, setSuspending] = useState(false);
  const dirty = features.some((f) => (draft[f.code] ?? false) !== (tenant.features[f.code] ?? false));

  async function saveFeatures() {
    setSaving(true);
    try {
      await platformService.updateFeatures(tenant.id, draft);
      toast("Módulos atualizados — efeito imediato para os usuários do cliente");
      onChanged();
    } catch (err) {
      toastError(err, "Não foi possível atualizar os módulos.");
    } finally {
      setSaving(false);
    }
  }

  async function resend(userId: string) {
    try {
      const sent = await platformService.resendAdminInvitation(tenant.id, userId);
      if (sent) toast("Convite reenviado");
      else toast("O e-mail não foi aceito pelo provedor. Tente de novo em instantes.", "warning");
    } catch (err) {
      toastError(err, "Não foi possível reenviar o convite.");
    }
  }

  async function startSupport(reason: string): Promise<boolean> {
    try {
      await startImpersonation(tenant.id, reason, duration);
      return true;
    } catch (err) {
      toastError(err, "Não foi possível iniciar a sessão de suporte.");
      return false;
    }
  }

  async function toggleTenant(reason?: string): Promise<boolean> {
    try {
      if (tenant.status === "suspended") await platformService.reactivateTenant(tenant.id);
      else await platformService.suspendTenant(tenant.id, reason ?? "");
      toast(tenant.status === "suspended" ? "Tenant reativado" : "Tenant suspenso");
      onChanged();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível alterar o status do tenant.");
      return false;
    }
  }

  return (
    <section className={styles.panel} aria-label={`Tenant ${tenant.name}`}>
      <div className={styles.pageHeader} style={{ marginBottom: 12 }}>
        <div>
          <h2 className={styles.panelTitle} style={{ marginBottom: 4 }}>
            Tenant: {tenant.name}{" "}
            <StatusPill status={tenant.status} internal={tenant.isPlatformInternal} />
          </h2>
          <span className={styles.muted}>
            {tenant.activeUsers} usuário(s) ativo(s) · <span className={styles.code}>{tenant.id}</span>
          </span>
        </div>
        {!tenant.isPlatformInternal && (
          <div className={styles.actions}>
            <Button onClick={() => setSupport(true)}>Iniciar sessão de suporte</Button>
            {tenant.status === "suspended" ? (
              <Button onClick={() => void toggleTenant()}>Reativar tenant</Button>
            ) : (
              <Button variant="danger" onClick={() => setSuspending(true)}>
                Suspender tenant
              </Button>
            )}
          </div>
        )}
      </div>

      {tenant.isPlatformInternal && (
        <div className={styles.notice}>
          Tenant interno da GSM: é onde vivem SDR, Prospecção e Clientes GSM. Não pode ser
          suspenso nem alvo de sessão de suporte.
        </div>
      )}

      <h3 className={styles.panelTitle} style={{ fontSize: 13.5 }}>
        Módulos contratados
      </h3>
      <div className={styles.featureGrid}>
        {features.map((f) => (
          <label key={f.code} className={styles.featureItem}>
            <input
              type="checkbox"
              checked={draft[f.code] ?? false}
              disabled={!f.available && !(draft[f.code] ?? false)}
              onChange={(e) => setDraft((d) => ({ ...d, [f.code]: e.target.checked }))}
            />
            <span>
              <span className={styles.featureName}>
                {f.label}
                {!f.available && " (em breve)"}
              </span>
              <br />
              <span className={styles.muted}>{f.description}</span>
            </span>
          </label>
        ))}
      </div>
      <div className={styles.actions} style={{ marginTop: 10 }}>
        <Button variant="primary" onClick={() => void saveFeatures()} disabled={!dirty || saving}>
          {saving ? "Salvando…" : "Salvar módulos"}
        </Button>
        {dirty && (
          <Button onClick={() => setDraft(tenant.features)} disabled={saving}>
            Descartar
          </Button>
        )}
      </div>

      <h3 className={styles.panelTitle} style={{ fontSize: 13.5, marginTop: 18 }}>
        Administradores
      </h3>
      {tenant.admins.length === 0 && <p className={styles.muted}>Nenhum admin ativo.</p>}
      {tenant.admins.map((admin) => (
        <div key={admin.userId} className={styles.actions} style={{ alignItems: "center", marginBottom: 6 }}>
          <span>
            {admin.name} <span className={styles.muted}>{admin.email}</span>
          </span>
          {admin.pendingFirstAccess && (
            <>
              <span className={`${styles.pill} ${styles.pillInternal}`}>Primeiro acesso pendente</span>
              <Button onClick={() => void resend(admin.userId)}>Reenviar convite</Button>
            </>
          )}
        </div>
      ))}

      {support && (
        <ReasonDialog
          title={`Sessão de suporte em ${tenant.name}`}
          message={
            <>
              Você verá o CRM <b>como o admin do cliente vê</b>, em modo <b>somente leitura</b>.
              Alterar dados exige liberar escrita (novo motivo). Gerenciar usuários, exportar e
              excluir continuam bloqueados. Tudo fica na auditoria.
            </>
          }
          confirmLabel="Iniciar suporte"
          extra={
            <label className={form.field}>
              <span className={form.label}>Duração</span>
              <select
                className={form.select}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {SUPPORT_DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} minutos
                  </option>
                ))}
              </select>
            </label>
          }
          onConfirm={startSupport}
          onClose={() => setSupport(false)}
        />
      )}
      {suspending && (
        <ReasonDialog
          title={`Suspender o tenant ${tenant.name}?`}
          message="Os usuários deste tenant perdem o acesso na hora; integrações são recusadas. Nada é apagado."
          confirmLabel="Suspender"
          danger
          onConfirm={(reason) => toggleTenant(reason)}
          onClose={() => setSuspending(false)}
        />
      )}
    </section>
  );
}

function EditOrganizationModal({
  orgId,
  name,
  planCode,
  plans,
  onClose,
  onSaved,
}: {
  orgId: string;
  name: string;
  planCode: string;
  plans: PlanOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast, toastError } = useToast();
  const [value, setValue] = useState(name);
  const [plan, setPlan] = useState(planCode);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await platformService.updateOrganization(orgId, {
        ...(value.trim() !== name ? { name: value.trim() } : {}),
        ...(plan && plan !== planCode ? { planCode: plan } : {}),
      });
      toast("Organização atualizada");
      onSaved();
      onClose();
    } catch (err) {
      toastError(err, "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Editar organização" onClose={onClose}>
      <form className={form.form} onSubmit={(e) => void submit(e)}>
        <label className={form.field}>
          <span className={form.label}>Nome</span>
          <input className={form.input} value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className={form.field}>
          <span className={form.label}>Plano</span>
          <select className={form.select} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {!planCode && <option value="">Sem plano</option>}
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <span className={form.hint}>
            Trocar o plano não altera sozinho os módulos contratados de cada tenant.
          </span>
        </label>
        <div className={form.actions}>
          <Button type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saving || value.trim().length < 2}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
