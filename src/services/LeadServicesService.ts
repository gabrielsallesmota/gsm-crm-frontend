import type { LeadServicesRepository } from "../repositories/LeadServicesRepository";
import { LeadServicesApiRepository } from "../repositories/api/LeadServicesApiRepository";
import { LeadServicesMockRepository } from "../repositories/mock/LeadServicesMockRepository";
import { selectRepository } from "./factory";
import type { CreateLeadServiceInput, LeadService, UpdateLeadServiceInput } from "../types/leadService";

const repo: LeadServicesRepository = selectRepository(
  () => new LeadServicesMockRepository(),
  () => new LeadServicesApiRepository(),
);

export class LeadServicesService {
  list(): Promise<LeadService[]> {
    return repo.list();
  }

  create(input: CreateLeadServiceInput): Promise<LeadService> {
    return repo.create(input);
  }

  update(id: string, input: UpdateLeadServiceInput): Promise<LeadService> {
    return repo.update(id, input);
  }

  delete(id: string): Promise<void> {
    return repo.delete(id);
  }

  setUserServices(userId: string, serviceIds: string[]): Promise<LeadService[]> {
    return repo.setUserServices(userId, serviceIds);
  }

  unavailableUserIds(): Promise<string[]> {
    return repo.unavailableUserIds();
  }

  setAvailability(userId: string, available: boolean): Promise<void> {
    return repo.setAvailability(userId, available);
  }
}

export const leadServicesService = new LeadServicesService();
