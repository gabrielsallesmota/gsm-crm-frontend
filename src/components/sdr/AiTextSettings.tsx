import { useState } from "react";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { useToast } from "../../hooks/useToast";
import { sdrService } from "../../services/SdrService";
import type {
  AiApiProvider,
  AiChatTarget,
  SdrAiKeyStatus,
  UpdateSdrAiSettingsInput,
} from "../../types/sdr";
import { AI_API_PROVIDER_LABEL, AI_CHAT_TARGET_LABEL } from "../../utils/aiChatTargets";
import form from "../common/Form.module.css";

function keyStatusText(status: SdrAiKeyStatus): string {
  if (!status.configured) return "Sem chave cadastrada";
  if (status.source === "server") return "Usando a chave do servidor (.env)";
  return `Chave cadastrada (${status.hint ?? "…"})`;
}

/**
 * IA dos textos de prospecção (uso interno da GSM): qual IA o "Copiar
 * prompt" abre, qual gera as mensagens automáticas e as API keys. As
 * chaves são só de escrita: vão cifradas pro backend e nunca voltam —
 * a tela mostra só se existem e o final delas.
 */
export function AiTextSettings() {
  const { data, loading, error, notImplemented, reload } = useAsyncResource(
    () => sdrService.getAiSettings(),
    [],
  );
  const { toast, toastError } = useToast();
  const [saving, setSaving] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");

  if (notImplemented) {
    return (
      <EmptyState
        title="Não disponível no modo Demonstração"
        message="A configuração de IA é interna da GSM."
      />
    );
  }
  if (error) {
    return <EmptyState title="Não foi possível carregar a configuração" message={error.message} />;
  }
  if (loading || !data) return <div className={form.hint}>Carregando…</div>;

  async function save(input: UpdateSdrAiSettingsInput, message: string) {
    setSaving(true);
    try {
      await sdrService.updateAiSettings(input);
      toast(message);
      reload();
      return true;
    } catch (err) {
      toastError(err, "Não foi possível salvar a configuração de IA");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveKey(provider: AiApiProvider, value: string) {
    const input: UpdateSdrAiSettingsInput =
      provider === "openai" ? { openaiApiKey: value } : { anthropicApiKey: value };
    const ok = await save(input, value ? "Chave salva" : "Chave removida");
    if (ok) {
      if (provider === "openai") setOpenaiKey("");
      else setAnthropicKey("");
    }
  }

  const keyRows: { provider: AiApiProvider; value: string; set: (v: string) => void }[] = [
    { provider: "openai", value: openaiKey, set: setOpenaiKey },
    { provider: "anthropic", value: anthropicKey, set: setAnthropicKey },
  ];
  const chosenStatus = data[data.apiProvider];

  return (
    <div className={form.form}>
      <div className={form.row}>
        <label className={form.field}>
          <span className={form.label}>IA do "Copiar prompt" (sem API key)</span>
          <select
            className={form.select}
            value={data.chatTarget}
            disabled={saving}
            onChange={(e) =>
              void save(
                { chatTarget: e.target.value as AiChatTarget },
                `O botão agora abre o ${AI_CHAT_TARGET_LABEL[e.target.value as AiChatTarget]}`,
              )
            }
          >
            {(Object.keys(AI_CHAT_TARGET_LABEL) as AiChatTarget[]).map((t) => (
              <option key={t} value={t}>
                {AI_CHAT_TARGET_LABEL[t]}
              </option>
            ))}
          </select>
          <span className={form.hint}>
            No prospect, o botão copia o prompt e abre esta IA numa aba nova.
          </span>
        </label>

        <label className={form.field}>
          <span className={form.label}>IA das mensagens automáticas (via API)</span>
          <select
            className={form.select}
            value={data.apiProvider}
            disabled={saving}
            onChange={(e) =>
              void save(
                { apiProvider: e.target.value as AiApiProvider },
                `Mensagens automáticas agora usam ${AI_API_PROVIDER_LABEL[e.target.value as AiApiProvider]}`,
              )
            }
          >
            {(Object.keys(AI_API_PROVIDER_LABEL) as AiApiProvider[]).map((p) => (
              <option key={p} value={p}>
                {AI_API_PROVIDER_LABEL[p]}
              </option>
            ))}
          </select>
          <span className={chosenStatus.configured ? form.hint : form.error}>
            {chosenStatus.configured
              ? "Vale a partir da próxima geração."
              : "Esta IA ainda não tem chave — as gerações vão falhar até você cadastrar uma abaixo."}
          </span>
        </label>
      </div>

      {keyRows.map(({ provider, value, set }) => (
        <div key={provider} className={form.field}>
          <span className={form.label}>API key — {AI_API_PROVIDER_LABEL[provider]}</span>
          <span className={form.hint}>{keyStatusText(data[provider])}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className={form.input}
              style={{ flex: "1 1 240px" }}
              type="password"
              autoComplete="off"
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={provider === "openai" ? "sk-…" : "sk-ant-…"}
              aria-label={`Nova API key ${AI_API_PROVIDER_LABEL[provider]}`}
            />
            <Button
              variant="primary"
              disabled={saving || !value.trim()}
              onClick={() => void saveKey(provider, value.trim())}
            >
              Salvar chave
            </Button>
            {data[provider].source === "screen" && (
              <Button disabled={saving} onClick={() => void saveKey(provider, "")}>
                Remover
              </Button>
            )}
          </div>
        </div>
      ))}
      <p className={form.hint}>
        As chaves ficam criptografadas no servidor e nunca aparecem de novo na tela. O Manus não
        tem geração automática — ele funciona só pelo "Copiar prompt".
      </p>
    </div>
  );
}
