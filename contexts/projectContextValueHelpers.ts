import type { ChatMessage } from "../shared/types/chat";
import type { ProjectContextProps } from "./projectTypes";
import { getValidContextMessages } from "./projectContextStateHelpers";

export const deriveProjectContextMessages = (
  history: ChatMessage[] | null | undefined,
): ChatMessage[] => getValidContextMessages(history);

export const composeProjectContextValue = (
  params: ProjectContextProps,
): ProjectContextProps => ({
  ...params,
});
