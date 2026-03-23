// shared/types/chat.ts
// Central shared chat-related types

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  meta?: {
    provider?: string;
    model?: string;
    autoFix?: boolean;
    planner?: boolean;
    error?: boolean;
    keyRotation?: boolean;
    providerFallback?: boolean;
    stateDrift?: boolean;
    validatorWarning?: boolean;
    explainWarning?: boolean;
    localOnly?: boolean;
    metaCommand?: boolean;
    containsFilePreview?: boolean;
  };
}
