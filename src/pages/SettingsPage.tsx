import { useSearchParams } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuth } from "../hooks/useAuth";
import { can } from "../auth/permissions";
import { hasFeature } from "../auth/features";
import { ROUTES } from "../constants/routes";
import { MessageTemplatesSettings } from "../components/prospects/MessageTemplatesSettings";
import { LeadMessageTemplatesSettings } from "../components/leads/LeadMessageTemplatesSettings";
import { AiTextSettings } from "../components/sdr/AiTextSettings";
import { OriginsSection } from "../components/settings/OriginsSection";
import { PipelinesSection } from "../components/settings/PipelinesSection";
import { ProspectStagesSection } from "../components/settings/ProspectStagesSection";
import { SettingsCard } from "../components/settings/SettingsCard";
import {
  SettingsNav,
  type NavLinkItem,
  type SettingsCategory,
} from "../components/settings/SettingsNav";
import { TagsSection } from "../components/settings/TagsSection";
import styles from "../components/settings/Settings.module.css";

const CATEGORIES: readonly SettingsCategory[] = ["comercial", "comunicacao", "interno"];

/**
 * Configurações. Uma única rota (`/configuracoes`); a categoria ativa vive em `?secao=` para o
 * link ser compartilhável e o "voltar" do navegador funcionar. Cada seção cuida das próprias
 * chamadas; esta página só decide O QUE aparece (permissões/feature/staff) — o backend continua
 * sendo a autoridade de cada operação. Atalhos para telas vizinhas só aparecem para quem pode usá-las.
 */
export function SettingsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  usePageTitle("Configurações");

  const isStaff = can(user, "platform.internal");
  const requested = params.get("secao") as SettingsCategory | null;
  // `interno` só existe para staff: para os demais volta ao padrão em vez de mostrar tela vazia.
  const active: SettingsCategory =
    requested && CATEGORIES.includes(requested) && (requested !== "interno" || isStaff) ? requested : "comercial";

  const notifications: NavLinkItem[] =
    user && hasFeature(user, "notifications") && can(user, "notifications.view")
      ? [{ to: ROUTES.notificacoes, label: "Notificações", hint: "Resumo diário e alertas da equipe" }]
      : [];
  const automation: NavLinkItem[] =
    user && hasFeature(user, "crm") && can(user, "automations.view")
      ? [
          {
            to: ROUTES.automacoes,
            label: "Automações comerciais",
            hint: "Follow-up, tarefas atrasadas e oportunidades paradas",
          },
        ]
      : [];
  const team: NavLinkItem[] = can(user, "users.view")
    ? [{ to: ROUTES.equipe, label: "Equipe e usuários", hint: "Convites, papéis e acessos" }]
    : [];
  const integrations: NavLinkItem[] =
    user && can(user, "integrations.manage") && (hasFeature(user, "api") || hasFeature(user, "webhooks"))
      ? [{ to: ROUTES.integracoes, label: "Integrações", hint: "Credenciais de API e webhooks" }]
      : [];

  function select(category: SettingsCategory) {
    setParams(category === "comercial" ? {} : { secao: category }, { replace: false });
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Configurações</h1>
      <p className={styles.pageSubtitle}>
        Pipelines, etapas, tags, origens e mensagens. Alterações valem para toda a equipe.
      </p>

      <div className={styles.layout}>
        <SettingsNav
          active={active}
          onSelect={select}
          showInternal={isStaff}
          notifications={notifications}
          automation={automation}
          team={team}
          integrations={integrations}
        />

        <div className={styles.content}>
          {active === "comercial" && (
            <>
              <PipelinesSection />
              <TagsSection />
              <OriginsSection />
            </>
          )}

          {active === "comunicacao" && (
            <SettingsCard
              title="Pipeline — mensagens de WhatsApp"
              description="Mensagem pronta que abre no WhatsApp do lead, por etapa e (opcionalmente) por origem. O envio é sempre feito por quem clica; o CRM não envia nada sozinho."
            >
              <LeadMessageTemplatesSettings />
            </SettingsCard>
          )}

          {active === "interno" && isStaff && (
            <>
              <ProspectStagesSection />
              <SettingsCard title="Prospecção — mensagens de WhatsApp" internal>
                <MessageTemplatesSettings />
              </SettingsCard>
              <SettingsCard title="Prospecção — IA dos textos" internal>
                <AiTextSettings />
              </SettingsCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
