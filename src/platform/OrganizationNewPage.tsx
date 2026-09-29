import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlatformCatalog } from "../hooks/usePlatform";
import { useToast } from "../hooks/useToast";
import { platformService } from "../services/PlatformService";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ROUTES } from "../constants/routes";
import {
  PROVISION_STEPS,
  emptyDraft,
  formatPrice,
  initialFeatures,
  slugify,
  validateStep,
  type ProvisionDraft,
  type ProvisionStep,
} from "./provisioning";
import type { ProvisionOrganizationResult } from "../types/platform";
import form from "../components/common/Form.module.css";
import styles from "./Platform.module.css";

/**
 * Nova organização → dados básicos → primeiro admin → módulos → confirmação
 * → tenant criado (uma transação no backend) → convite enviado ao admin.
 * Nada é gravado antes do "Criar organização" final.
 */
export function OrganizationNewPage() {
  const navigate = useNavigate();
  const { toast, toastError } = useToast();
  const { data: catalog, error, reload } = usePlatformCatalog();
  const [step, setStep] = useState<ProvisionStep>("basics");
  const [draft, setDraft] = useState<ProvisionDraft>(emptyDraft);
  const [slugTouched, setSlugTouched] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ProvisionOrganizationResult | null>(null);

  const index = PROVISION_STEPS.findIndex((s) => s.key === step);
  const plan = catalog?.plans.find((p) => p.code === draft.planCode);
  const set = (patch: Partial<ProvisionDraft>) => setDraft((d) => ({ ...d, ...patch }));

  function choosePlan(code: string) {
    const chosen = catalog?.plans.find((p) => p.code === code);
    set({ planCode: code, features: initialFeatures(chosen, catalog?.features ?? []) });
  }

  function next() {
    const issue = validateStep(step, draft);
    setProblem(issue);
    if (issue) return;
    const nextStep = PROVISION_STEPS[index + 1];
    if (nextStep) setStep(nextStep.key);
  }

  function back() {
    setProblem(null);
    const prev = PROVISION_STEPS[index - 1];
    if (prev) setStep(prev.key);
  }

  async function submit() {
    setSubmitting(true);
    setProblem(null);
    try {
      const created = await platformService.provision({
        ...draft,
        name: draft.name.trim(),
        adminName: draft.adminName.trim(),
        adminEmail: draft.adminEmail.trim(),
      });
      setResult(created);
      toast("Organização criada");
    } catch (err) {
      toastError(err, "Não foi possível criar a organização.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <EmptyState
        title="Não foi possível carregar planos e módulos"
        message={error.message}
        action={{ label: "Tentar de novo", onClick: reload }}
      />
    );
  }
  if (!catalog) return <p className={styles.muted}>Carregando…</p>;

  if (result) {
    return (
      <div className={styles.panel}>
        <h1 className={styles.title}>Organização criada ✓</h1>
        <p className={styles.subtitle}>
          Tenant, módulos, primeiro admin e pipeline padrão foram criados numa única operação.
        </p>
        <div style={{ margin: "16px 0" }}>
          {result.invitationSent === true && (
            <div className={styles.notice}>
              Convite de primeiro acesso enviado para <b>{result.admin.email}</b> (válido por 72
              horas). Nenhuma senha foi definida nem exibida.
            </div>
          )}
          {result.invitationSent === false && (
            <div className={`${styles.notice} ${styles.danger}`} role="alert">
              A organização foi criada, mas o e-mail de convite NÃO foi enviado. Use "Reenviar
              convite" na página da organização.
            </div>
          )}
          {result.invitationSent === null && (
            <div className={styles.notice}>
              <b>{result.admin.email}</b> já tinha acesso à plataforma: ganhou o papel de Admin no
              novo tenant e entra com a senha que já usa.
            </div>
          )}
        </div>
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => navigate(ROUTES.platformOrganization(result.accountId))}>
            Abrir organização
          </Button>
          <Button onClick={() => navigate(ROUTES.platformOrganizations)}>Voltar à lista</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Nova organização</h1>
          <p className={styles.subtitle}>Provisionamento de um novo cliente da GSM</p>
        </div>
        <Link to={ROUTES.platformOrganizations} className={styles.muted}>
          Cancelar
        </Link>
      </div>

      <ol className={styles.steps} aria-label="Etapas">
        {PROVISION_STEPS.map((s, i) => (
          <li
            key={s.key}
            className={[
              styles.step,
              s.key === step && styles.stepActive,
              i < index && styles.stepDone,
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={s.key === step ? "step" : undefined}
            style={{ listStyle: "none" }}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      <div className={styles.panel}>
        {step === "basics" && (
          <div className={form.form}>
            <label className={form.field}>
              <span className={form.label}>Nome da organização</span>
              <input
                className={form.input}
                value={draft.name}
                autoFocus
                onChange={(e) =>
                  set({
                    name: e.target.value,
                    ...(slugTouched ? {} : { slug: slugify(e.target.value) }),
                  })
                }
              />
            </label>
            <label className={form.field}>
              <span className={form.label}>Identificador (slug)</span>
              <input
                className={form.input}
                value={draft.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set({ slug: e.target.value.toLowerCase() });
                }}
              />
              <span className={form.hint}>Único na plataforma; não aparece para o cliente.</span>
            </label>
            <label className={form.field}>
              <span className={form.label}>Plano</span>
              <select
                className={form.select}
                value={draft.planCode}
                onChange={(e) => choosePlan(e.target.value)}
              >
                <option value="">Escolha…</option>
                {catalog.plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} — {formatPrice(p.priceCents)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {step === "admin" && (
          <div className={form.form}>
            <p className={styles.muted} style={{ margin: 0 }}>
              O primeiro administrador recebe um convite por e-mail e cria a própria senha. A GSM
              nunca define nem vê a senha do cliente. E-mails da equipe GSM são recusados: o
              suporte usa sessões de suporte, não conta no tenant.
            </p>
            <label className={form.field}>
              <span className={form.label}>Nome</span>
              <input
                className={form.input}
                value={draft.adminName}
                autoFocus
                onChange={(e) => set({ adminName: e.target.value })}
              />
            </label>
            <label className={form.field}>
              <span className={form.label}>E-mail</span>
              <input
                className={form.input}
                type="email"
                value={draft.adminEmail}
                onChange={(e) => set({ adminEmail: e.target.value })}
              />
            </label>
          </div>
        )}

        {step === "features" && (
          <div>
            <p className={styles.muted} style={{ marginTop: 0 }}>
              Pré-selecionado pelo plano "{plan?.name}". O backend bloqueia (403) o que não for
              contratado. SDR, Prospecção e Clientes GSM são internos e não aparecem aqui.
            </p>
            <div className={styles.featureGrid}>
              {catalog.features.map((f) => (
                <label key={f.code} className={styles.featureItem}>
                  <input
                    type="checkbox"
                    checked={draft.features[f.code] ?? false}
                    disabled={!f.available}
                    onChange={(e) =>
                      set({ features: { ...draft.features, [f.code]: e.target.checked } })
                    }
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
          </div>
        )}

        {step === "confirm" && (
          <div>
            <div className={styles.notice}>
              Confira antes de criar. A organização nasce inteira (conta, assinatura, tenant,
              módulos, admin e pipeline padrão) ou não nasce — sem tenant pela metade.
            </div>
            <dl className={styles.summary}>
              <dt>Organização</dt>
              <dd>{draft.name}</dd>
              <dt>Identificador</dt>
              <dd className={styles.code}>{draft.slug}</dd>
              <dt>Plano</dt>
              <dd>{plan?.name ?? draft.planCode}</dd>
              <dt>Primeiro admin</dt>
              <dd>
                {draft.adminName} — {draft.adminEmail}
              </dd>
              <dt>Módulos</dt>
              <dd>
                {catalog.features
                  .filter((f) => draft.features[f.code])
                  .map((f) => f.label)
                  .join(", ") || "nenhum"}
              </dd>
            </dl>
          </div>
        )}

        {problem && (
          <p className={form.error} role="alert" style={{ marginTop: 12 }}>
            {problem}
          </p>
        )}

        <div className={form.actions}>
          {index > 0 && (
            <Button onClick={back} disabled={submitting}>
              ← Voltar
            </Button>
          )}
          {step !== "confirm" ? (
            <Button variant="primary" onClick={next}>
              Continuar →
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void submit()} disabled={submitting}>
              {submitting ? "Criando…" : "Criar organização"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
