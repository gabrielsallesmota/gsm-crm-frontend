import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SdrSubNav } from "../components/sdr/SdrSubNav";
import { SdrChipInput } from "../components/sdr/SdrChipInput";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ROUTES } from "../constants/routes";
import { useSdrCampaignActions } from "../hooks/useSdrCampaignActions";
import { useSdrIcpPresets } from "../hooks/useSdrIcpPresets";
import { useToast } from "../hooks/useToast";
import {
  SDR_CAMPAIGN_STATUS_LABEL,
  type SdrCampaign,
  type SdrCampaignStatus,
  type SdrCriterion,
  type SdrCriterionKind,
  type SdrLocation,
} from "../types/sdr";
import styles from "./SdrPages.module.css";

const STATUS_OPTIONS: SdrCampaignStatus[] = ["draft", "active", "paused", "archived"];

function emptyLocation(): SdrLocation {
  return { country: "", state: "", city: "", locality: "" };
}

function emptyCriterion(): SdrCriterion {
  return { kind: "preference", key: "", value: "", weight: null };
}

export function SdrCampaignFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { get, create, update } = useSdrCampaignActions();
  const { data: presets } = useSdrIcpPresets();

  const [loading, setLoading] = useState(isEditing);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [status, setStatus] = useState<SdrCampaignStatus>("draft");
  const [provider, setProvider] = useState("manual");
  const [targetQuantity, setTargetQuantity] = useState(0);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [gsmOffers, setGsmOffers] = useState<string[]>([]);
  const [locations, setLocations] = useState<SdrLocation[]>([emptyLocation()]);
  const [criteria, setCriteria] = useState<SdrCriterion[]>([]);
  const [fromPresetId, setFromPresetId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    get(id)
      .then((campaign: SdrCampaign) => {
        setName(campaign.name);
        setNiche(campaign.niche);
        setStatus(campaign.status);
        setProvider(campaign.provider);
        setTargetQuantity(campaign.targetQuantity);
        setSearchTerms(campaign.searchTerms);
        setGsmOffers(campaign.gsmOffers);
        setLocations(campaign.locations.length > 0 ? campaign.locations : [emptyLocation()]);
        setCriteria(campaign.criteria);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function applyPreset(presetId: string) {
    setFromPresetId(presetId);
    if (!isEditing) {
      const preset = presets?.find((p) => p.id === presetId);
      if (!preset) return;
      setNiche(preset.niche);
      setSearchTerms(preset.searchTerms);
      setGsmOffers(preset.gsmOffers);
      if (preset.locations.length > 0) setLocations(preset.locations);
      if (preset.criteria.length > 0) setCriteria(preset.criteria);
    }
  }

  function updateLocation(index: number, patch: Partial<SdrLocation>) {
    setLocations((locs) => locs.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function updateCriterion(index: number, patch: Partial<SdrCriterion>) {
    setCriteria((crit) => crit.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function handleSubmit() {
    if (!name.trim() || !niche.trim()) return;
    const cleanLocations = locations.filter((l) => l.country || l.state || l.city || l.locality);
    if (cleanLocations.length === 0) {
      toast("Preencha pelo menos uma localidade (país, estado, cidade ou bairro/região).");
      return;
    }
    setSaving(true);
    try {
      if (isEditing && id) {
        await update(id, {
          name,
          niche,
          status,
          provider,
          targetQuantity,
          searchTerms,
          gsmOffers,
          locations: cleanLocations,
          criteria,
        });
        toast("Campanha atualizada com sucesso");
      } else {
        await create({
          name,
          niche,
          status,
          provider,
          targetQuantity,
          searchTerms,
          gsmOffers,
          locations: cleanLocations,
          criteria,
          ...(fromPresetId ? { fromPresetId } : {}),
        });
        toast("Campanha criada com sucesso");
      }
      navigate(ROUTES.sdrCampanhas);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar a campanha");
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return <EmptyState title="Campanha não encontrada" message="Ela pode ter sido excluída." />;
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{isEditing ? "Editar campanha" : "Nova campanha"}</h1>
          <p className={styles.pageSubtitle}>
            Define o que buscar (nicho, termos, localidades) — sem executar busca real ainda
            nesta etapa.
          </p>
        </div>
      </div>

      <SdrSubNav />

      {loading ? (
        <div className={styles.empty}>Carregando…</div>
      ) : (
        <>
          {!isEditing && presets && presets.length > 0 && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Começar de um preset (opcional)</h2>
              <select
                className={styles.select}
                value={fromPresetId}
                onChange={(e) => applyPreset(e.target.value)}
              >
                <option value="">Nenhum — preencher do zero</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Dados gerais</h2>
            <label className={styles.fieldLabel}>
              Nome da campanha
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className={styles.fieldLabel}>
              Nicho
              <input className={styles.input} value={niche} onChange={(e) => setNiche(e.target.value)} />
            </label>
            <label className={styles.fieldLabel}>
              Status
              <select
                className={styles.select}
                value={status}
                onChange={(e) => setStatus(e.target.value as SdrCampaignStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SDR_CAMPAIGN_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Provider (referência, sem busca real ainda)
              <input
                className={styles.input}
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              />
            </label>
            <label className={styles.fieldLabel}>
              Quantidade alvo
              <input
                className={styles.input}
                type="number"
                min={0}
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(Number(e.target.value))}
              />
            </label>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Localidades</h2>
            {locations.map((loc, i) => (
              <div key={i} className={styles.locationRow}>
                <input
                  className={styles.input}
                  placeholder="País"
                  value={loc.country ?? ""}
                  onChange={(e) => updateLocation(i, { country: e.target.value })}
                />
                <input
                  className={styles.input}
                  placeholder="Estado"
                  value={loc.state ?? ""}
                  onChange={(e) => updateLocation(i, { state: e.target.value })}
                />
                <input
                  className={styles.input}
                  placeholder="Cidade"
                  value={loc.city ?? ""}
                  onChange={(e) => updateLocation(i, { city: e.target.value })}
                />
                <input
                  className={styles.input}
                  placeholder="Bairro/região"
                  value={loc.locality ?? ""}
                  onChange={(e) => updateLocation(i, { locality: e.target.value })}
                />
                <button
                  type="button"
                  className={styles.smallRemoveBtn}
                  onClick={() => setLocations((locs) => locs.filter((_, idx) => idx !== i))}
                  disabled={locations.length === 1}
                >
                  Remover
                </button>
              </div>
            ))}
            <Button onClick={() => setLocations((locs) => [...locs, emptyLocation()])}>
              + Adicionar localidade
            </Button>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Termos de busca</h2>
            <SdrChipInput values={searchTerms} onChange={setSearchTerms} placeholder="Ex.: dentista" />
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Ofertas GSM foco</h2>
            <SdrChipInput
              values={gsmOffers}
              onChange={setGsmOffers}
              placeholder="Ex.: Landing Page"
            />
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Filtros e sinais</h2>
            <p className={styles.pageSubtitle}>
              Eliminatório descarta o candidato de cara (quando o worker de busca existir);
              preferência só contribui pra pontuação futura.
            </p>
            {criteria.map((c, i) => (
              <div key={i} className={styles.criterionRow}>
                <select
                  className={styles.select}
                  value={c.kind}
                  onChange={(e) => updateCriterion(i, { kind: e.target.value as SdrCriterionKind })}
                >
                  <option value="eliminatory">Eliminatório</option>
                  <option value="preference">Preferência</option>
                </select>
                <input
                  className={styles.input}
                  placeholder="Chave (ex.: min_google_rating)"
                  value={c.key}
                  onChange={(e) => updateCriterion(i, { key: e.target.value })}
                />
                <input
                  className={styles.input}
                  placeholder="Valor (ex.: 4.0)"
                  value={c.value}
                  onChange={(e) => updateCriterion(i, { value: e.target.value })}
                />
                <input
                  className={styles.input}
                  type="number"
                  placeholder="Peso"
                  value={c.weight ?? ""}
                  disabled={c.kind === "eliminatory"}
                  onChange={(e) =>
                    updateCriterion(i, { weight: e.target.value ? Number(e.target.value) : null })
                  }
                />
                <button
                  type="button"
                  className={styles.smallRemoveBtn}
                  onClick={() => setCriteria((crit) => crit.filter((_, idx) => idx !== i))}
                >
                  Remover
                </button>
              </div>
            ))}
            <Button onClick={() => setCriteria((crit) => [...crit, emptyCriterion()])}>
              + Adicionar critério
            </Button>
          </div>

          <div className={styles.modalActions}>
            <Button onClick={() => navigate(ROUTES.sdrCampanhas)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={saving || !name.trim() || !niche.trim()}
            >
              {saving ? "Salvando…" : "Salvar campanha"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
