import { useId, useState } from "react";
import type {
  ApplyScope,
  EntryKind,
  FinAccount,
  FinCategory,
  FinEntry,
  FinProfile,
} from "../../types/finance";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { Modal } from "../common/Modal";
import { SeriesApplyDialog } from "./SeriesApplyDialog";
import { useToast } from "../../hooks/useToast";
import { financeService } from "../../services/FinanceService";
import { categoryFits, purchaseDueDate, validateEntryDraft } from "../../utils/finance";
import { fmtDate } from "../../utils/renewal";
import { toIsoDate } from "../../utils/renewal";
import form from "../common/Form.module.css";

const METHODS = ["", "PIX", "Cartão de crédito", "Cartão de débito", "Boleto", "Transferência", "Dinheiro"];

/**
 * Novo lançamento ou edição. Criar aceita repetição mensal (assinaturas, aluguel…); a série nasce
 * com o mesmo valor, e só a 1ª ocorrência pode já vir baixada.
 */
export function EntryFormModal({
  entry,
  categories,
  accounts,
  profiles,
  defaults,
  onClose,
  onSaved,
}: {
  entry: FinEntry | null;
  categories: FinCategory[];
  accounts: FinAccount[];
  profiles: FinProfile[];
  defaults?: { profileId?: string; kind?: EntryKind; accountId?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast, toastError } = useToast();
  const uid = useId();
  const preset = defaults?.accountId ? accounts.find((a) => a.id === defaults.accountId) : undefined;
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? defaults?.kind ?? "expense");
  const activeProfiles = profiles.filter((p) => !p.archived);
  const [profileId, setProfileId] = useState<string>(
    entry?.profileId ??
      preset?.profileId ??
      defaults?.profileId ??
      (activeProfiles.find((p) => p.kind === "pj") ?? activeProfiles[0])?.id ??
      "",
  );
  const [description, setDescription] = useState(entry?.description ?? "");
  const [amount, setAmount] = useState(entry ? entry.amountCents / 100 : 0);
  const [entryDate, setEntryDate] = useState(entry?.entryDate ?? toIsoDate(new Date()));
  const [dueDate, setDueDate] = useState(entry?.dueDate ?? "");
  // Compra no cartão nasce "a pagar": quem paga é a fatura.
  const [paid, setPaid] = useState(entry ? entry.paidAt !== null : !preset);
  const [paidAt, setPaidAt] = useState(entry?.paidAt ?? toIsoDate(new Date()));
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? "");
  const [accountId, setAccountId] = useState(entry?.accountId ?? preset?.id ?? "");
  const [method, setMethod] = useState(entry?.paymentMethod ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [tagsText, setTagsText] = useState((entry?.tags ?? []).join(", "));
  // Só ao criar: único, mensal por N meses ou fixo (todo mês, sem fim).
  const [repeatMode, setRepeatMode] = useState<"once" | "months" | "fixed">("once");
  const [repeat, setRepeat] = useState(3);
  const [askApply, setAskApply] = useState(false);
  const [saving, setSaving] = useState(false);

  const fitting = categories.filter((c) => categoryFits(c, kind, profileId));
  const accountOptions = accounts.filter((a) => !a.archived && a.profileId === profileId);
  const card = accounts.find((a) => a.id === accountId && a.kind === "cartao");
  const cardDue =
    card && card.closingDay && card.dueDay && entryDate && !dueDate
      ? purchaseDueDate(entryDate, card.closingDay, card.dueDay)
      : null;
  const problem = validateEntryDraft({ description, amount, entryDate, dueDate, paid, paidAt });

  function pickKind(next: EntryKind) {
    setKind(next);
    setCategoryId("");
    if (next === "income" && card) setAccountId(""); // cartão só recebe compras
  }

  function pickAccount(id: string) {
    setAccountId(id);
    const picked = accounts.find((a) => a.id === id);
    if (picked?.kind === "cartao") {
      setKind("expense");
      setPaid(false); // a fatura é que dá a baixa
    }
  }

  function pickProfile(next: string) {
    setProfileId(next);
    setCategoryId("");
    setAccountId("");
  }

  async function submit(apply: ApplyScope = "this") {
    if (problem) return;
    setSaving(true);
    try {
      const base = {
        kind,
        profileId,
        amountCents: Math.round(amount * 100),
        description: description.trim(),
        entryDate,
        categoryId: categoryId || null,
        accountId: accountId || null,
        dueDate: dueDate || null,
        paidAt: paid ? paidAt : null,
        paymentMethod: method,
        notes,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (entry) {
        const updated = await financeService.updateEntry(entry.id, base, apply);
        toast(
          updated.affected && updated.affected > 1
            ? `${updated.affected} lançamentos atualizados`
            : "Lançamento atualizado",
        );
      } else {
        const created = await financeService.createEntries({
          ...base,
          repeatMonths: repeatMode === "months" ? repeat : 1,
          fixed: repeatMode === "fixed",
        });
        toast(
          repeatMode === "fixed"
            ? "Lançamento fixo criado (12 meses à frente; ele se estende sozinho)"
            : created.length > 1
              ? `${created.length} lançamentos criados`
              : "Lançamento criado",
        );
      }
      onSaved();
      onClose();
    } catch (err) {
      toastError(err, "Não foi possível salvar o lançamento");
    } finally {
      setSaving(false);
      setAskApply(false);
    }
  }

  function save() {
    if (entry?.recurrenceId) setAskApply(true); // série: pergunta onde aplicar
    else void submit();
  }

  return (
    <>
    <Modal title={entry ? "Editar lançamento" : "Novo lançamento"} onClose={onClose}>
      <div className={form.form}>
        <div className={form.row}>
          <Choice
            legend="Tipo"
            value={kind}
            options={[
              ["expense", "Despesa"],
              ["income", "Receita"],
            ]}
            onChange={pickKind}
          />
          {entry ? (
            <div className={form.field}>
              <span className={form.label}>Perfil</span>
              <span style={{ marginTop: 8, display: "block" }}>
                {profiles.find((p) => p.id === entry.profileId)?.name ?? "—"}
              </span>
            </div>
          ) : (
            <Choice
              legend="Perfil"
              value={profileId}
              options={activeProfiles.map((p): [string, string] => [p.id, p.name])}
              onChange={pickProfile}
            />
          )}
        </div>

        <div className={form.field}>
          <label className={form.label} htmlFor={`${uid}-desc`}>Descrição</label>
          <input
            id={`${uid}-desc`}
            className={form.input}
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={form.row}>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-amount`}>{card && repeatMode === "months" ? "Valor de cada parcela" : "Valor"}</label>
            <CurrencyInput id={`${uid}-amount`} className={form.input} value={amount} onChange={setAmount} />
          </div>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-date`}>Data do lançamento</label>
            <input id={`${uid}-date`} className={form.input} type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-due`}>Vencimento (opcional)</label>
            <input id={`${uid}-due`} className={form.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className={form.row}>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-cat`}>Categoria</label>
            <select id={`${uid}-cat`} className={form.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sem categoria</option>
              {fitting.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-acc`}>Conta / cartão</label>
            <select id={`${uid}-acc`} className={form.select} value={accountId} onChange={(e) => pickAccount(e.target.value)}>
              <option value="">Sem conta</option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.kind === "cartao" ? " (cartão)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-method`}>Forma de pagamento</label>
            <select id={`${uid}-method`} className={form.select} value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{m || "—"}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={form.row}>
          <div className={form.field}>
            <label className={form.label} htmlFor={`${uid}-paid`}>
              {kind === "income" ? "Já recebido?" : "Já pago?"}
            </label>
            <select id={`${uid}-paid`} className={form.select} value={paid ? "1" : "0"} onChange={(e) => setPaid(e.target.value === "1")}>
              <option value="1">{kind === "income" ? "Sim, recebido" : "Sim, pago"}</option>
              <option value="0">{kind === "income" ? "Não, a receber" : "Não, a pagar"}</option>
            </select>
          </div>
          {paid && (
            <div className={form.field}>
              <label className={form.label} htmlFor={`${uid}-paidat`}>
                {kind === "income" ? "Data do recebimento" : "Data do pagamento"}
              </label>
              <input id={`${uid}-paidat`} className={form.input} type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          )}
          {!entry && (
            <div className={form.field}>
              <label className={form.label} htmlFor={`${uid}-mode`}>Repetição</label>
              <select
                id={`${uid}-mode`}
                className={form.select}
                value={repeatMode}
                onChange={(e) => setRepeatMode(e.target.value as "once" | "months" | "fixed")}
              >
                <option value="once">{card ? "À vista" : "Só uma vez"}</option>
                <option value="months">{card ? "Parcelado" : "Mensal, por alguns meses"}</option>
                <option value="fixed">{card ? "Fixo (assinatura no cartão)" : "Fixo (todo mês, sem fim)"}</option>
              </select>
              {repeatMode === "months" && (
                <input
                  className={form.input}
                  type="number"
                  min={2}
                  max={60}
                  aria-label={card ? "Parcelado em (vezes)" : "Repetir por (meses)"}
                  value={repeat}
                  onChange={(e) => setRepeat(Math.min(60, Math.max(2, Number(e.target.value) || 2)))}
                />
              )}
              <span className={form.hint}>
                {repeatMode === "fixed"
                  ? "Repete todo mês, sem data final. Para parar, exclua “este e os próximos”."
                  : repeatMode === "months"
                    ? card
                      ? "Cada parcela cai numa fatura."
                      : "Cria um lançamento por mês."
                    : ""}
              </span>
            </div>
          )}
          {entry?.recurrenceId && (
            <p className={form.hint}>
              Faz parte de uma série{entry.isFixed ? " fixa" : ""}. Ao salvar, você escolhe se vale só para este, para
              os seguintes ou para todos.
            </p>
          )}
        </div>

        <div className={form.field}>
          <label className={form.label} htmlFor={`${uid}-tags`}>Tags</label>
          <input id={`${uid}-tags`} className={form.input} maxLength={200} value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Ex.: viagem, reembolsável (separe por vírgula)" />
        </div>

        <div className={form.field}>
          <label className={form.label} htmlFor={`${uid}-notes`}>Observações</label>
          <textarea id={`${uid}-notes`} className={form.textarea} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {cardDue && (
          <p className={form.hint}>
            Cartão {card?.name}: esta compra entra na fatura que vence em {fmtDate(cardDue)}.
          </p>
        )}
        {problem && <p className={form.error} role="alert">{problem}</p>}
        <div className={form.actions}>
          <Button onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={saving || Boolean(problem)}>
            {saving ? "Salvando…" : entry ? "Salvar" : "Criar lançamento"}
          </Button>
        </div>
      </div>
    </Modal>
      {askApply && entry && (
        <SeriesApplyDialog
          description={entry.description}
          busy={saving}
          onConfirm={(apply) => void submit(apply)}
          onClose={() => setAskApply(false)}
        />
      )}
    </>
  );
}

function Choice<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className={form.label}>{legend}</legend>
      <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
        {options.map(([v, label]) => (
          <label
            key={v}
            style={{
              border: `1px solid ${value === v ? "var(--tone-blue-text)" : "var(--border-strong)"}`,
              background: value === v ? "var(--tone-blue-bg)" : "transparent",
              color: value === v ? "var(--tone-blue-text)" : "var(--text)",
              fontWeight: value === v ? 700 : 400,
              borderRadius: "var(--radius-input)",
              padding: "8px 12px",
              fontSize: 13.5,
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name={legend}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
              style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
