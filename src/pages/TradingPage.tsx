import { useState, type FormEvent } from "react";
import { Button } from "../components/common/Button";
import { Modal } from "../components/common/Modal";
import { useAsyncResource } from "../hooks/useAsyncResource";
import { usePageTitle } from "../hooks/usePageTitle";
import { useToast } from "../hooks/useToast";
import { tradingApi } from "../services/tradingApi";
import type { RiskParams, TradingOverview } from "../types/trading";
import styles from "./TradingPage.module.css";

const TABS: { id: string; label: string; ready: boolean; note?: string }[] = [
  { id: "visao", label: "Visão Geral", ready: true },
  { id: "mercado", label: "Mercado", ready: false, note: "Etapa 2" },
  { id: "operacoes", label: "Operações", ready: false, note: "Etapa 6" },
  { id: "estrategias", label: "Estratégias", ready: false, note: "Etapa 3" },
  { id: "backtesting", label: "Backtesting", ready: false, note: "Etapa 4" },
  { id: "automacoes", label: "Automações", ready: false, note: "Etapa 6" },
  { id: "contas", label: "Contas e Corretoras", ready: false, note: "Etapa 7" },
  { id: "risco", label: "Gestão de Risco", ready: true },
  { id: "analytics", label: "Analytics", ready: false, note: "Etapa 9" },
  { id: "auditoria", label: "Auditoria", ready: true },
  { id: "config", label: "Configurações", ready: false, note: "Etapa 8" },
];

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR") : "—");

export function TradingPage() {
  usePageTitle("Trading · GSM Private");
  const [tab, setTab] = useState<string>("visao");
  const overview = useAsyncResource(() => tradingApi.overview(), []);
  const o = overview.data;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>GSM Private · Trading</h1>
          <p className={styles.sub}>Binance Spot · BTC/USDT e ETH/USDT · M15 com filtro H1 · sem alavancagem</p>
        </div>
        {o && (
          <span className={styles.sub}>
            Modo {o.controle.modo} · Bot {o.controle.bot}
          </span>
        )}
      </div>

      <div role="tablist" className={styles.tabs} aria-label="Seções do Trading">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            className={styles.tab}
            aria-selected={tab === t.id}
            disabled={!t.ready}
            title={t.ready ? undefined : `Não disponível nesta versão (${t.note})`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {overview.loading && !o && <p className={styles.muted}>Carregando…</p>}
      {overview.error && (
        <div className={styles.alert} role="alert">
          {overview.error.message}
        </div>
      )}
      {o && tab === "visao" && <Overview o={o} reload={overview.reload} />}
      {o && tab === "risco" && <Risk o={o} reload={overview.reload} />}
      {tab === "auditoria" && <Audit />}
    </div>
  );
}

function Overview({ o, reload }: { o: TradingOverview; reload: () => void }) {
  const { toast, toastError } = useToast();
  const [kill, setKill] = useState<"acionar" | "liberar" | null>(null);
  const ks = o.controle.kill_switch;
  const p = o.politica.parametros;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok, "success");
      reload();
    } catch (e) {
      toastError(e, "Não foi possível executar a ação.");
    }
  };

  return (
    <>
      {o.bloqueios.length > 0 && (
        <div className={ks.ativo ? styles.alert : styles.warn} role="status">
          <strong>Novas entradas bloqueadas:</strong>
          <ul>
            {o.bloqueios.map((b) => (
              <li key={b.codigo}>{b.mensagem}</li>
            ))}
          </ul>
          {ks.ativo && (
            <p>
              Motivo do kill switch: {ks.motivo} (desde {when(ks.desde)}).
            </p>
          )}
        </div>
      )}

      <section className={styles.card}>
        <h2>Limites do dia e da semana</h2>
        <p className={styles.muted}>
          Sem patrimônio ainda: o motor e a conta não existem nesta versão, então nenhum resultado é exibido (nada é
          simulado nem estimado).
        </p>
        <div className={styles.grid}>
          {[
            ["Meta diária", `+${pct(p.daily_target_pct)}`],
            ["Stop diário", `−${pct(p.daily_stop_pct)}`],
            ["Stop semanal", `−${pct(p.weekly_stop_pct)}`],
            ["Risco por operação", pct(p.risk_per_trade_pct)],
            ["Operações simultâneas", String(p.max_open_positions)],
            ["Alavancagem", "0 (fixa)"],
          ].map(([l, v]) => (
            <div key={l} className={styles.kpi}>
              <span className={styles.kpiValue}>{v}</span>
              <span className={styles.kpiLabel}>{l}</span>
              <div className={styles.bar} aria-hidden="true">
                <i />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Controles</h2>
        <div className={styles.row}>
          <label>
            Modo{" "}
            <select
              className={styles.field}
              value={o.controle.modo}
              onChange={(e) => run(() => tradingApi.mode(e.target.value as "PAPER" | "DEMO"), "Modo alterado.")}
            >
              <option value="PAPER">PAPER (simulado)</option>
              <option value="DEMO">DEMO (Binance testnet)</option>
              <option value="LIVE" disabled>
                LIVE (bloqueado)
              </option>
            </select>
          </label>
          <Button
            variant="primary"
            disabled={!o.motor.disponivel || ks.ativo}
            title={o.motor.disponivel ? undefined : "O motor de execução ainda não foi implementado"}
            onClick={() => run(() => tradingApi.bot("start"), "Bot iniciado.")}
          >
            Iniciar bot
          </Button>
          <Button disabled={o.controle.bot !== "RUNNING"} onClick={() => run(() => tradingApi.bot("pause"), "Bot pausado.")}>
            Pausar
          </Button>
          <Button onClick={() => run(() => tradingApi.bot("stop"), "Bot parado.")}>Interromper</Button>
          {ks.ativo ? (
            <Button variant="danger" onClick={() => setKill("liberar")}>
              Liberar kill switch
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setKill("acionar")}>
              Acionar kill switch
            </Button>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Corretoras, ativos e contas</h2>
        <p>
          {o.catalogo.brokers.map((b) => b.name).join(", ")} · {o.catalogo.assets.map((a) => a.symbol).join(", ")}
        </p>
        <p className={styles.muted}>
          {o.catalogo.accounts.length === 0
            ? "Nenhuma conta cadastrada. Credenciais de corretora serão cadastradas na Etapa 7, criptografadas e sem permissão de saque."
            : `${o.catalogo.accounts.length} conta(s)`}
        </p>
      </section>

      {kill && (
        <KillDialog
          mode={kill}
          onClose={() => setKill(null)}
          onDone={() => {
            setKill(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function KillDialog({ mode, onClose, onDone }: { mode: "acionar" | "liberar"; onClose: () => void; onDone: () => void }) {
  const { toast, toastError } = useToast();
  const [motivo, setMotivo] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "acionar") await tradingApi.killSwitch(motivo);
      else await tradingApi.releaseKillSwitch(motivo, senha);
      toast(mode === "acionar" ? "Kill switch acionado." : "Kill switch liberado. O bot continua parado.", "success");
      onDone();
    } catch (err) {
      toastError(err, "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={mode === "acionar" ? "Acionar kill switch" : "Liberar kill switch"} onClose={onClose}>
      <form onSubmit={submit} className={styles.form}>
        <label>
          Motivo
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={3} required />
        </label>
        {mode === "liberar" && (
          <label>
            Sua senha
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
        )}
        <div className={styles.row}>
          <Button variant="danger" type="submit" disabled={busy}>
            {mode === "acionar" ? "Acionar" : "Liberar"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const CAMPOS: { key: keyof RiskParams; label: string; step: string }[] = [
  { key: "daily_target_pct", label: "Meta diária (%)", step: "0.05" },
  { key: "daily_stop_pct", label: "Stop diário (%)", step: "0.05" },
  { key: "weekly_stop_pct", label: "Stop semanal (%)", step: "0.05" },
  { key: "risk_per_trade_pct", label: "Risco por operação (%)", step: "0.05" },
  { key: "max_open_positions", label: "Operações simultâneas", step: "1" },
  { key: "max_consecutive_losses", label: "Perdas seguidas (circuit breaker)", step: "1" },
  { key: "stale_data_seconds", label: "Dado atrasado (s)", step: "10" },
];

function Risk({ o, reload }: { o: TradingOverview; reload: () => void }) {
  const { toast, toastError } = useToast();
  const base = o.politica.parametros;
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS.map((c) => [c.key, String(base[c.key])])),
  );
  const [posPolicy, setPosPolicy] = useState(base.open_positions_policy);
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const events = useAsyncResource(() => tradingApi.riskEvents(), [o.politica.versao, o.controle.kill_switch.ativo]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const changes: Partial<RiskParams> = {};
    for (const c of CAMPOS) {
      const n = Number(vals[c.key]);
      if (n !== base[c.key]) (changes as Record<string, number>)[c.key] = n;
    }
    if (posPolicy !== base.open_positions_policy) changes.open_positions_policy = posPolicy;
    try {
      const r = await tradingApi.changePolicy(changes, motivo || undefined);
      setMsg(
        !r.alterado
          ? "Nada mudou."
          : r.politica_pendente
            ? `Aplicado agora: ${(r.apertados ?? []).join(", ") || "nada"}. Afrouxamentos (${(r.afrouxados ?? []).join(", ")}) só valem a partir de ${when(r.politica_pendente.vigente_desde)}.`
            : "Política atualizada e já em vigor.",
      );
      toast("Política enviada.", "success");
      reload();
    } catch (err) {
      toastError(err, "Política recusada.");
    }
  };

  return (
    <>
      <section className={styles.card}>
        <h2>Política de risco · versão {o.politica.versao}</h2>
        <p className={styles.muted}>
          Os limites máximos de segurança são do servidor. Apertar um limite vale na hora; afrouxar só vale no próximo
          dia (ou semana, para o stop semanal). Alavancagem 0, martingale e recuperação de perdas são fixos e não
          configuráveis.
        </p>
        {o.politica_pendente && (
          <div className={styles.warn}>
            Pendente (v{o.politica_pendente.versao}) a partir de {when(o.politica_pendente.vigente_desde)}.
          </div>
        )}
        <form onSubmit={submit} className={styles.form}>
          {CAMPOS.map((c) => (
            <label key={c.key}>
              {c.label}
              <input
                type="number"
                step={c.step}
                value={vals[c.key]}
                onChange={(e) => setVals({ ...vals, [c.key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            Posições ao disparar um stop
            <select value={posPolicy} onChange={(e) => setPosPolicy(e.target.value as RiskParams["open_positions_policy"])}>
              <option value="close_market">Encerrar a mercado</option>
              <option value="keep_protected">Manter com proteção</option>
            </select>
          </label>
          <label>
            Motivo (opcional)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
          </label>
          <div className={styles.row}>
            <Button variant="primary" type="submit">
              Salvar política
            </Button>
          </div>
        </form>
        {msg && (
          <p role="status" className={styles.ok}>
            {msg}
          </p>
        )}
      </section>

      <section className={styles.card}>
        <h2>Eventos de risco</h2>
        {events.data?.length === 0 && <p className={styles.muted}>Nenhum evento.</p>}
        <table className={styles.table}>
          <tbody>
            {events.data?.map((ev) => (
              <tr key={ev.id}>
                <td>{when(ev.at)}</td>
                <td>{ev.kind}</td>
                <td>{ev.severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Audit() {
  const audit = useAsyncResource(() => tradingApi.audit(), []);
  return (
    <section className={styles.card}>
      <h2>Auditoria</h2>
      {audit.loading && <p className={styles.muted}>Carregando…</p>}
      {audit.data?.length === 0 && <p className={styles.muted}>Nenhum registro.</p>}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Quando</th>
            <th>Quem</th>
            <th>IP</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {audit.data?.map((a) => (
            <tr key={a.id}>
              <td>{when(a.at)}</td>
              <td>{a.actor}</td>
              <td>{a.ip ?? "—"}</td>
              <td>{a.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
