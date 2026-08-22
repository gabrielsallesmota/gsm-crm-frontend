import { leadsService } from "../services/LeadsService";
import type {
  CreateLeadMessageTemplateInput,
  LeadMessageTemplate,
  UpdateLeadMessageTemplateInput,
} from "../types/lead";

export interface LeadMessageTemplateActions {
  create(input: CreateLeadMessageTemplateInput): Promise<LeadMessageTemplate>;
  update(id: string, input: UpdateLeadMessageTemplateInput): Promise<LeadMessageTemplate>;
  delete(id: string): Promise<void>;
}

export function useLeadMessageTemplateActions(): LeadMessageTemplateActions {
  return {
    create: (input) => leadsService.createMessageTemplate(input),
    update: (id, input) => leadsService.updateMessageTemplate(id, input),
    delete: (id) => leadsService.deleteMessageTemplate(id),
  };
}
