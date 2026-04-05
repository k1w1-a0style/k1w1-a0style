import { v4 as uuidv4 } from "uuid";
import type { ChatMessage } from "../shared/types/chat";

export const buildChatMessage = ({
  role,
  content,
  meta,
}: {
  role: ChatMessage["role"];
  content: string;
  meta?: ChatMessage["meta"];
}): ChatMessage => {
  return {
    id: uuidv4(),
    role,
    content,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  };
};

export const buildAssistantMessage = (
  content: string,
  meta?: ChatMessage["meta"],
): ChatMessage => buildChatMessage({ role: "assistant", content, meta });

export const buildSystemMessage = (
  content: string,
  meta?: ChatMessage["meta"],
): ChatMessage => buildChatMessage({ role: "system", content, meta });

export const buildUserMessage = (
  content: string,
  meta?: ChatMessage["meta"],
): ChatMessage => buildChatMessage({ role: "user", content, meta });
