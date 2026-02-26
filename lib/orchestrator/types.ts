// lib/orchestrator/types.ts
// Shared types for the orchestrator module.

import type { AllAIProviders } from '../../contexts/AIContext';

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
  keysRotated?: number;
  timing?: { startMs: number; endMs: number; durationMs: number };
}

export type Quality = 'speed' | 'quality' | 'balanced' | 'review';
