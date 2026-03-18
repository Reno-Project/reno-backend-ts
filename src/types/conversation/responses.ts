import { type APIResponse } from "../utils/api";

export type ConversationDTO = {
  id: number;
  entityType: string | null;
  entityId: string | null;
  parentConversationId: number | null;
  members: unknown[];
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MessageDTO = {
  id: number;
  conversationId: number;
  userId: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
};

export type HealthDTO = { message: string };
export type DeleteDTO = { message: string };

export type ConversationAPIResponse<T> = APIResponse<T>;

export type MessageWithUserDTO = {
  message: MessageDTO;
  user: Record<string, unknown>;
};
