import type { LeadServicesRepository } from "../LeadServicesRepository";
import type { CreateLeadServiceInput, LeadService, UpdateLeadServiceInput } from "../../types/leadService";
import { apiRequest } from "./ApiClient";

interface LeadServiceDto {
  id: string;
  key: string;
  name: string;
  is_default: boolean;
  active: boolean;
  member_user_ids: string[];
}

function toLeadService(dto: LeadServiceDto): LeadService {
  return {
    id: dto.id,
    key: dto.key,
    name: dto.name,
    isDefault: dto.is_default,
    active: dto.active,
    memberUserIds: dto.member_user_ids,
  };
}

export class LeadServicesApiRepository implements LeadServicesRepository {
  async list(): Promise<LeadService[]> {
    const dtos = await apiRequest<LeadServiceDto[]>("/api/v1/lead-services");
    return dtos.map(toLeadService);
  }

  async create(input: CreateLeadServiceInput): Promise<LeadService> {
    const dto = await apiRequest<LeadServiceDto>("/api/v1/lead-services", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        is_default: input.isDefault ?? false,
        member_user_ids: input.memberUserIds ?? [],
      }),
    });
    return toLeadService(dto);
  }

  async update(id: string, input: UpdateLeadServiceInput): Promise<LeadService> {
    const body: Record<string, unknown> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.active !== undefined) body.active = input.active;
    if (input.isDefault !== undefined) body.is_default = input.isDefault;
    if (input.memberUserIds !== undefined) body.member_user_ids = input.memberUserIds;
    const dto = await apiRequest<LeadServiceDto>(`/api/v1/lead-services/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return toLeadService(dto);
  }

  async setUserServices(userId: string, serviceIds: string[]): Promise<LeadService[]> {
    const dtos = await apiRequest<LeadServiceDto[]>(`/api/v1/lead-services/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ service_ids: serviceIds }),
    });
    return dtos.map(toLeadService);
  }

  async delete(id: string): Promise<void> {
    await apiRequest<void>(`/api/v1/lead-services/${id}`, { method: "DELETE" });
  }
}
