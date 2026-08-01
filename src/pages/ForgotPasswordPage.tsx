import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../layouts/AuthLayout";
import { authService } from "../services/AuthService";
import { ROUTES } from "../constants/routes";
import { Button } from "../components/common/Button";
import styles from "./LoginPage.module.css";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.requestPasswordReset({ email });
      // O backend sempre responde com sucesso genérico (nunca revela se o
      // e-mail existe) — o front só precisa mostrar essa mensagem.
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className={styles.card}>
        <h2 className={styles.title}>Esqueci minha senha</h2>

        {submitted ? (
          <p className={styles.subtitle}>
            Se esse e-mail existir em nossa base, você receberá um link para redefinir sua senha.
          </p>
        ) : (
          <>
            <p className={styles.subtitle}>Informe seu e-mail de acesso.</p>
            <form onSubmit={handleSubmit}>
              <label className={styles.label}>E-mail</label>
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {error && <div className={styles.error}>{error}</div>}

              <Button type="submit" variant="primary" disabled={loading} className={styles.submitBtn}>
                {loading ? "Enviando…" : "Enviar link"}
              </Button>
            </form>
          </>
        )}

        <Link to={ROUTES.login} className={styles.hint}>
          Voltar para o login
        </Link>
      </div>
    </AuthLayout>
  );
}
