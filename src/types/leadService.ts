/** Serviço que a organização vende e os vendedores avisados quando chega um lead dele. */
export interface LeadService {
  id: string;
  /** Chave estável usada pelas integrações (`seguro_auto`). */
  key: string;
  name: string;
  /** Recebe os leads cujo serviço não bate com nenhum outro. Só um por organização. */
  isDefault: boolean;
  active: boolean;
  memberUserIds: string[];
}

export interface CreateLeadServiceInput {
  name: string;
  isDefault?: boolean;
  memberUserIds?: string[];
}

export interface UpdateLeadServiceInput {
  name?: string;
  active?: boolean;
  isDefault?: boolean;
  /** Substitui a lista inteira. */
  memberUserIds?: string[];
}
