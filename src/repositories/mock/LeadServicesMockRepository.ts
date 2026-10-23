import type { LeadServicesRepository } from "../LeadServicesRepository";
import type { CreateLeadServiceInput, LeadService, UpdateLeadServiceInput } from "../../types/leadService";
import { delay } from "../../utils/errors";
import { mockState } from "./state";

function slug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

const unavailable = new Set<string>();

export class LeadServicesMockRepository implements LeadServicesRepository {
  async list(): Promise<LeadService[]> {
    await delay(150);
    return mockState.leadServices;
  }

  async create(input: CreateLeadServiceInput): Promise<LeadService> {
    await delay(150);
    if (input.isDefault) mockState.leadServices.forEach((s) => (s.isDefault = false));
    const service: LeadService = {
      id: `ls${mockState.leadServices.length + 1}`,
      key: slug(input.name),
      name: input.name,
      isDefault: input.isDefault ?? false,
      active: true,
      memberUserIds: [...new Set(input.memberUserIds ?? [])],
    };
    mockState.leadServices.push(service);
    return service;
  }

  async update(id: string, input: UpdateLeadServiceInput): Promise<LeadService> {
    await delay(150);
    const service = mockState.leadServices.find((s) => s.id === id);
    if (!service) throw new Error("Serviço não encontrado");
    if (input.isDefault) mockState.leadServices.forEach((s) => (s.isDefault = false));
    if (input.name !== undefined) service.name = input.name;
    if (input.active !== undefined) service.active = input.active;
    if (input.isDefault !== undefined) service.isDefault = input.isDefault;
    if (input.memberUserIds !== undefined) service.memberUserIds = [...new Set(input.memberUserIds)];
    return service;
  }

  async setUserServices(userId: string, serviceIds: string[]): Promise<LeadService[]> {
    await delay(150);
    for (const service of mockState.leadServices) {
      const others = service.memberUserIds.filter((id) => id !== userId);
      service.memberUserIds = serviceIds.includes(service.id) ? [...others, userId] : others;
    }
    return mockState.leadServices;
  }

  async unavailableUserIds(): Promise<string[]> {
    await delay(150);
    return [...unavailable];
  }

  async setAvailability(userId: string, available: boolean): Promise<void> {
    await delay(150);
    if (available) unavailable.delete(userId);
    else unavailable.add(userId);
  }

  async delete(id: string): Promise<void> {
    await delay(150);
    const index = mockState.leadServices.findIndex((s) => s.id === id);
    if (index >= 0) mockState.leadServices.splice(index, 1);
  }
}
