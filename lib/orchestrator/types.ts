// lib/orchestrator/types.ts
// Shared types for the orchestrator module.

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OrchestratorResult {
  ok: boolean;
  text?: string;
  error?: string;
  errors?: string[];
  provider?: string;
  model?: string;
  errorCode?: string;
  statusCode?: number;
  runtimeNote?: string;
  fallbackUsed?: boolean;
  fallbackAttempts?: Array<{ provider: string; model: string; reason: string }>;
  keysRotated?: number;
  timing?: { startMs: number; endMs: number; durationMs: number };
}

export type Quality = 'speed' | 'quality' | 'balanced' | 'review';
