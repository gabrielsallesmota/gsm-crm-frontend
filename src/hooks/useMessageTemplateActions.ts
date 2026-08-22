import { prospectsService } from "../services/ProspectsService";
import type {
  CreateMessageTemplateInput,
  MessageTemplate,
  UpdateMessageTemplateInput,
} from "../types/prospect";

export interface MessageTemplateActions {
  create(input: CreateMessageTemplateInput): Promise<MessageTemplate>;
  update(id: string, input: UpdateMessageTemplateInput): Promise<MessageTemplate>;
  delete(id: string): Promise<void>;
}

export function useMessageTemplateActions(): MessageTemplateActions {
  return {
    create: (input) => prospectsService.createMessageTemplate(input),
    update: (id, input) => prospectsService.updateMessageTemplate(id, input),
    delete: (id) => prospectsService.deleteMessageTemplate(id),
  };
}
