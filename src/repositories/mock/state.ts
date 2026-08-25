import { mockLeads } from "../../mock/leads";
import { mockPipelines } from "../../mock/pipelines";
import { mockUsers } from "../../mock/users";
import { mockTenants } from "../../mock/tenants";
import { mockTags } from "../../mock/tags";
import type { Lead } from "../../types/lead";
import type { Pipeline } from "../../types/pipeline";
import type { User } from "../../types/user";
import type { Tenant } from "../../types/tenant";
import type { Tag } from "../../types/tag";
import type { LeadComment } from "../../types/lead";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const mockState: {
  leads: Lead[];
  pipelines: Pipeline[];
  users: User[];
  tenants: Tenant[];
  tags: Tag[];
  // Comentários de lead vivem à parte de `leads` de propósito (mesma
  // divisão do backend: `LeadComment` não é embutido em `Lead`) — indexado
  // por `leadId`, mais recente primeiro.
  leadComments: Record<string, LeadComment[]>;
  currentTenantId: string;
} = {
  leads: clone(mockLeads),
  pipelines: clone(mockPipelines),
  users: clone(mockUsers),
  tenants: clone(mockTenants),
  tags: clone(mockTags),
  leadComments: {},
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

let tagSeq = mockState.tags.length + 1;
export function nextTagId(): string {
  return `t${tagSeq++}`;
}

let taskSeq = 1000;
export function nextTaskId(): string {
  return `task${taskSeq++}`;
}

let eventSeq = 1000;
export function nextEventId(): string {
  return `event${eventSeq++}`;
}

let commentSeq = 1000;
export function nextCommentId(): string {
  return `comment${commentSeq++}`;
}
