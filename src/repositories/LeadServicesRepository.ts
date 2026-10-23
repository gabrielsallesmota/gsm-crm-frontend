import type { CreateLeadServiceInput, LeadService, UpdateLeadServiceInput } from "../types/leadService";

export interface LeadServicesRepository {
  list(): Promise<LeadService[]>;
  create(input: CreateLeadServiceInput): Promise<LeadService>;
  update(id: string, input: UpdateLeadServiceInput): Promise<LeadService>;
  delete(id: string): Promise<void>;
  /** Substitui os nichos de uma pessoa da equipe; devolve todos os nichos atualizados. */
  setUserServices(userId: string, serviceIds: string[]): Promise<LeadService[]>;
  /** Quem está INDISPONÍVEL para receber leads (férias, folga) — independe de a conta estar ativa. */
  unavailableUserIds(): Promise<string[]>;
  setAvailability(userId: string, available: boolean): Promise<void>;
}
