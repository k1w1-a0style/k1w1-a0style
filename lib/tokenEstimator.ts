/**
 * Token Estimator
 * Schätzt Token-Anzahl für verschiedene AI-Provider
 */

import { AllAIProviders } from '../contexts/AIContext';
import { CONFIG } from '../config';

/**
 * Schätzt die Token-Anzahl für einen gegebenen Text
 * Basierend auf provider-spezifischen Token-Ratios
 * 
 * @param text - Der zu schätzende Text
 * @param provider - Der AI-Provider (optional, Standard: 'groq')
 * @returns Geschätzte Anzahl an Tokens
 */
export function estimateTokens(text: string, provider?: AllAIProviders): number {
  if (!text || typeof text !== 'string') return 0;
  
  const tokenRatioMap = CONFIG.TOKEN_RATIO as Record<string, number>;
  const ratio = provider 
    ? (tokenRatioMap[provider] ?? CONFIG.TOKEN_RATIO.default)
    : CONFIG.TOKEN_RATIO.default;
  
  return Math.ceil(text.length / ratio);
}

/**
 * Schätzt Tokens für ein Array von Texten
 * 
 * @param texts - Array von Texten
 * @param provider - Der AI-Provider (optional)
 * @returns Gesamte geschätzte Token-Anzahl
 */
export function estimateTokensForArray(
  texts: string[], 
  provider?: AllAIProviders
): number {
  return texts.reduce((sum, text) => sum + estimateTokens(text, provider), 0);
}

/**
 * Prüft ob ein Text das Token-Limit überschreitet
 * 
 * @param text - Der zu prüfende Text
 * @param limit - Das Token-Limit
 * @param provider - Der AI-Provider (optional)
 * @returns true wenn Limit überschritten
 */
export function exceedsTokenLimit(
  text: string, 
  limit: number, 
  provider?: AllAIProviders
): boolean {
  return estimateTokens(text, provider) > limit;
}
