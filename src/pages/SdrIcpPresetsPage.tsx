import { useState } from "react";
import { SdrSubNav } from "../components/sdr/SdrSubNav";
import { SdrChipInput } from "../components/sdr/SdrChipInput";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { useSdrIcpPresetActions } from "../hooks/useSdrIcpPresetActions";
import { useSdrIcpPresets } from "../hooks/useSdrIcpPresets";
import { useToast } from "../hooks/useToast";
import { ApiError } from "../types/common";
import type { SdrIcpPreset } from "../types/sdr";
import styles from "./SdrPages.module.css";

export function SdrIcpPresetsPage() {
  const { data: presets, loading, error, notImplemented, reload } = useSdrIcpPresets();
  const { create, delete: deletePreset } = useSdrIcpPresetActions();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(preset: SdrIcpPreset) {
    setDeletingId(preset.id);
    try {
      await deletePreset(preset.id);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível excluir esse preset");
    } finally {
      setDeletingId(null);
    }
  }

  if (notImplemented) {
    return (
      <div>
        <SdrSubNav />
        <EmptyState
          title="Não disponível no modo Demonstração"
          message="SDR é uma área interna da GSM Automação, sem dados fictícios para mostrar aqui."
        />
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Presets de ICP</h1>
          <p className={styles.pageSubtitle}>
            Templates reutilizáveis (ex.: Odontologia, Estética) — criar uma campanha a partir de
            um preset copia os valores; editar o preset depois não muda campanhas já criadas.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Novo preset
        </Button>
      </div>

      <SdrSubNav />

      {error && <EmptyState title="Não foi possível carregar os presets" message={error.message} />}

      {!error && !loading && presets && presets.length === 0 && (
        <EmptyState
          title="Nenhum preset ainda"
          message='Clique em "Novo preset" pra criar o primeiro modelo reutilizável.'
        />
      )}

      {!error && presets && presets.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Nicho</th>
                <th>Termos de busca</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {presets.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.niche}</td>
                  <td>{p.searchTerms.join(", ") || "—"}</td>
                  <td className={styles.chevron}>
                    <button
                      className={styles.smallRemoveBtn}
                      type="button"
                      onClick={() => void handleDelete(p)}
                      disabled={deletingId === p.id}
                    >
                      {deletingId === p.id ? "Excluindo…" : "Excluir"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreatePresetModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
          onCreateFn={create}
        />
      )}
    </div>
  );
}

function CreatePresetModal({
  onClose,
  onCreated,
  onCreateFn,
}: {
  onClose: () => void;
  onCreated: () => void;
  onCreateFn: ReturnType<typeof useSdrIcpPresetActions>["create"];
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [gsmOffers, setGsmOffers] = useState<string[]>([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !niche.trim()) return;
    setSubmitting(true);
    try {
      await onCreateFn({
        name: name.trim(),
        niche: niche.trim(),
        searchTerms,
        gsmOffers,
        locations: state || city ? [{ state: state || null, city: city || null }] : [],
      });
      toast("Preset criado com sucesso");
      onCreated();
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 409
          ? err.message
          : "Não foi possível criar o preset";
      toast(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Novo preset de ICP</h2>
        <p className={styles.modalSubtitle}>
          Template pra prefill de campanhas futuras — editar depois não afeta campanhas já
          criadas a partir dele.
        </p>
        <label className={styles.fieldLabel}>
          Nome
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.fieldLabel}>
          Nicho
          <input className={styles.input} value={niche} onChange={(e) => setNiche(e.target.value)} />
        </label>
        <label className={styles.fieldLabel}>
          Estado (opcional)
          <input className={styles.input} value={state} onChange={(e) => setState(e.target.value)} />
        </label>
        <label className={styles.fieldLabel}>
          Cidade (opcional)
          <input className={styles.input} value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <p className={styles.fieldLabel}>Termos de busca</p>
        <SdrChipInput values={searchTerms} onChange={setSearchTerms} placeholder="Ex.: dentista" />
        <p className={styles.fieldLabel}>Ofertas GSM foco</p>
        <SdrChipInput values={gsmOffers} onChange={setGsmOffers} placeholder="Ex.: Landing Page" />
        <div className={styles.modalActions}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={submitting || !name.trim() || !niche.trim()}
          >
            {submitting ? "Criando…" : "Criar preset"}
          </Button>
        </div>
      </div>
    </div>
  );
}
