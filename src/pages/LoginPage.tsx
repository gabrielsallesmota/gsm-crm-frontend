import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../layouts/AuthLayout";
import { useAuth } from "../hooks/useAuth";
import { isDemoMode } from "../services/factory";
import { ROUTES } from "../constants/routes";
import { Button } from "../components/common/Button";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { login, pendingTenantSelection, selectTenant } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(isDemoMode ? "voce@empresa.com.br" : "");
  const [password, setPassword] = useState(isDemoMode ? "demodemo" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doLogin(loginEmail: string, loginPassword: string) {
    setLoading(true);
    setError(null);
    try {
      await login({ email: loginEmail, password: loginPassword });
      // Se a pessoa tiver mais de 1 tenant, `login` não navega — deixa
      // `pendingTenantSelection` preenchido e o formulário abaixo assume.
      navigate(ROUTES.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void doLogin(email, password);
  }

  async function handleSelectTenant(tenantId: string) {
    setLoading(true);
    setError(null);
    try {
      // `selectTenant` já redireciona para o dashboard (recarrega a página
      // para garantir que nenhum dado do passo anterior fique em memória).
      await selectTenant(tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível selecionar o tenant.");
    } finally {
      setLoading(false);
    }
  }

  if (pendingTenantSelection) {
    return (
      <AuthLayout>
        <div className={styles.card}>
          <h2 className={styles.title}>Escolha uma empresa</h2>
          <p className={styles.subtitle}>Sua conta tem acesso a mais de um ambiente.</p>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.demoGrid}>
            {pendingTenantSelection.availableTenants.map((option) => (
              <Button
                key={option.tenantId}
                type="button"
                variant="primary"
                disabled={loading}
                onClick={() => void handleSelectTenant(option.tenantId)}
              >
                {option.tenantName}
              </Button>
            ))}
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className={styles.card}>
        <h2 className={styles.title}>Entrar</h2>
        <p className={styles.subtitle}>Acesse o painel da sua empresa.</p>

        <form onSubmit={handleSubmit}>
          <label className={styles.label}>E-mail</label>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className={styles.label}>Senha</label>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {!isDemoMode && (
            <Link to={ROUTES.forgotPassword} className={styles.hint}>
              Esqueci minha senha
            </Link>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <Button type="submit" variant="primary" disabled={loading} className={styles.submitBtn}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        {isDemoMode && (
          <div className={styles.demoGrid}>
            <Button type="button" onClick={() => void doLogin("voce@empresa.com.br", "demodemo")} disabled={loading}>
              Entrar (Empresa)
            </Button>
            <Button type="button" onClick={() => void doLogin("admin@gsmautomacao.com.br", "demodemo")} disabled={loading}>
              Admin GSM
            </Button>
          </div>
        )}

        <p className={styles.hint}>
          {isDemoMode ? "Protótipo de demonstração — dados em memória." : "Use suas credenciais de acesso."}
        </p>
      </div>
    </AuthLayout>
  );
}
