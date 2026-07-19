import { mockLeads } from "../../mock/leads";
import { mockPipelines } from "../../mock/pipelines";
import { mockUsers } from "../../mock/users";
import { mockTenants } from "../../mock/tenants";
import type { Lead } from "../../types/lead";
import type { Pipeline } from "../../types/pipeline";
import type { User } from "../../types/user";
import type { Tenant } from "../../types/tenant";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const mockState: {
  leads: Lead[];
  pipelines: Pipeline[];
  users: User[];
  tenants: Tenant[];
  currentTenantId: string;
} = {
  leads: clone(mockLeads),
  pipelines: clone(mockPipelines),
  users: clone(mockUsers),
  tenants: clone(mockTenants),
  currentTenantId: mockTenants[0]?.id ?? "c1",
};

let leadSeq = mockState.leads.length + 1;
export function nextLeadId(): string {
  return `l${leadSeq++}`;
}

let userSeq = mockState.users.length + 1;
export function nextUserId(): string {
  return `u${userSeq++}`;
}
