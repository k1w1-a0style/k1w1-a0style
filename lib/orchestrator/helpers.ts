// lib/orchestrator/helpers.ts
// Shared utility functions for all providers.

import { AllAIProviders, PROVIDER_DEFAULTS } from '../../contexts/AIContext';
import type { Quality, LlmMessage } from './types';

export function stripThinking(text: string): string {
  if (!text) return '';
  return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').replace(/\r/g, '').trim();
}

export function resolveModel(provider: AllAIProviders, model: string, quality: Quality): string {
  const isAuto = model === 'auto' || model.startsWith('auto-');
  if (!isAuto) return model;

  const defs = PROVIDER_DEFAULTS?.[provider];
  if (!defs) return model;

  if (quality === 'quality') return defs.quality;
  if (quality === 'speed') return defs.speed;
  // balanced -> speed default (bewusst), review -> quality default
  if (quality === 'review') return defs.quality;
  return defs.speed;
}

export function splitSystem(messages: LlmMessage[]): { system?: string; rest: LlmMessage[] } {
  const system = messages
    .filter(m => m.role === 'system')
    .map(m => String(m.content ?? ''))
    .join('\n')
    .trim();

  const rest = messages.filter(m => m.role !== 'system');
  return { system: system || undefined, rest };
}

export function toOpenAIInput(messages: LlmMessage[]) {
  // Responses API akzeptiert: input: [{role, content: "..."}, ...]
  return messages.map(m => ({
    role: m.role,
    content: String(m.content ?? ''),
  }));
}

export async function fetchTextSafe(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
