/**
 * Token-Schätzung für verschiedene LLM-Provider
 * 
 * ✅ VERBESSERT: Genauere Schätzung als einfache Länge/Ratio
 * 
 * Basiert auf empirischen Daten und Provider-spezifischen Tokenizern:
 * - OpenAI: GPT-3.5/4 Tokenizer (~4 chars/token)
 * - Anthropic: Claude Tokenizer (~4.2 chars/token)
 * - Google: Gemini Tokenizer (~4 chars/token)
 * - Groq: Llama-basiert (~4 chars/token)
 * 
 * @author k1w1-team
 * @version 2.0.0
 */

import type { AllAIProviders } from '../contexts/AIContext';

/**
 * Token-Ratios pro Provider (chars per token)
 * Basierend auf empirischen Tests mit verschiedenen Texten
 */
const TOKEN_RATIOS: Record<AllAIProviders, number> = {
  openai: 3.8,      // GPT-3.5/4: ~3.8 chars/token
  anthropic: 4.2,   // Claude: ~4.2 chars/token
  gemini: 4.0,      // Gemini: ~4.0 chars/token
  groq: 4.0,        // Llama-based: ~4.0 chars/token
  huggingface: 4.0, // Varies, use average
};

/**
 * Gewichtungsfaktoren für verschiedene Texttypen
 */
const TEXT_TYPE_WEIGHTS = {
  code: 0.85,        // Code hat mehr Tokens (Symbole, Syntax)
  json: 0.90,        // JSON hat viele Strukturzeichen
  natural: 1.0,      // Natürlicher Text (Baseline)
  mixed: 0.95,       // Mix aus Code und Text
};

/**
 * Erkennt den Texttyp basierend auf Heuristiken
 */
function detectTextType(text: string): keyof typeof TEXT_TYPE_WEIGHTS {
  if (!text) return 'natural';
  
  const codeIndicators = [
    'function',
    'const',
    'let',
    'var',
    'import',
    'export',
    'class',
    '=>',
    'return',
  ];
  
  const jsonIndicators = ['{', '}', '[', ']', ':', '"'];
  
  const codeScore = codeIndicators.reduce(
    (score, indicator) => score + (text.includes(indicator) ? 1 : 0),
    0
  );
  
  const jsonScore = jsonIndicators.reduce(
    (score, indicator) => score + (text.split(indicator).length - 1),
    0
  );
  
  // JSON-Heuristik: Viele Strukturzeichen
  if (jsonScore > text.length * 0.1) {
    return 'json';
  }
  
  // Code-Heuristik: Mehrere Code-Keywords
  if (codeScore >= 3) {
    return 'code';
  }
  
  // Mixed: Einige Code-Keywords
  if (codeScore >= 1) {
    return 'mixed';
  }
  
  return 'natural';
}

/**
 * Zählt spezielle Token-Typen für genauere Schätzung
 */
function countSpecialTokens(text: string): {
  whitespace: number;
  punctuation: number;
  numbers: number;
  symbols: number;
} {
  return {
    whitespace: (text.match(/\s/g) || []).length,
    punctuation: (text.match(/[.,;:!?]/g) || []).length,
    numbers: (text.match(/\d+/g) || []).length,
    symbols: (text.match(/[{}[\]()<>]/g) || []).length,
  };
}

/**
 * Schätzt die Anzahl der Tokens für einen Text
 * 
 * ✅ VERBESSERT: Berücksichtigt Texttyp, Sonderzeichen und Provider
 * 
 * @param text - Der zu schätzende Text
 * @param provider - AI-Provider (optional, default: openai)
 * @returns Geschätzte Anzahl Tokens
 */
export function estimateTokens(
  text: string,
  provider: AllAIProviders = 'openai'
): number {
  if (!text || typeof text !== 'string') return 0;
  
  const length = text.length;
  if (length === 0) return 0;
  
  // Basis-Ratio für Provider
  const baseRatio = TOKEN_RATIOS[provider] || 4.0;
  
  // Texttyp erkennen
  const textType = detectTextType(text);
  const typeWeight = TEXT_TYPE_WEIGHTS[textType];
  
  // Spezielle Tokens zählen
  const special = countSpecialTokens(text);
  
  // Whitespace reduziert Token-Count (wird oft ignoriert)
  const whitespaceReduction = special.whitespace * 0.3;
  
  // Symbole erhöhen Token-Count (oft separate Tokens)
  const symbolIncrease = special.symbols * 0.2;
  
  // Basis-Schätzung
  const baseEstimate = length / baseRatio;
  
  // Angepasste Schätzung
  const adjustedEstimate =
    (baseEstimate * typeWeight) - whitespaceReduction + symbolIncrease;
  
  // Runde auf ganze Zahl
  return Math.ceil(Math.max(1, adjustedEstimate));
}

/**
 * Schätzt Tokens für ein Array von Texten
 */
export function estimateTokensForArray(
  texts: string[],
  provider: AllAIProviders = 'openai'
): number {
  return texts.reduce((sum, text) => sum + estimateTokens(text, provider), 0);
}

/**
 * Schätzt Tokens für ein Message-Array (Chat-Format)
 */
export function estimateTokensForMessages(
  messages: Array<{ role: string; content: string }>,
  provider: AllAIProviders = 'openai'
): number {
  // Basis-Tokens für Messages
  let total = 0;
  
  for (const message of messages) {
    // Content-Tokens
    total += estimateTokens(message.content, provider);
    
    // Overhead pro Message (role, formatting, etc.)
    // OpenAI: ~4 tokens per message
    // Anthropic: ~3 tokens per message
    const messageOverhead = provider === 'anthropic' ? 3 : 4;
    total += messageOverhead;
  }
  
  // Zusätzlicher Overhead für Chat-Format
  total += 3;
  
  return total;
}

/**
 * Prüft ob ein Text ein Token-Limit überschreitet
 */
export function exceedsTokenLimit(
  text: string,
  limit: number,
  provider: AllAIProviders = 'openai'
): boolean {
  return estimateTokens(text, provider) > limit;
}

/**
 * Kürzt einen Text auf ein Token-Limit
 * 
 * @param text - Zu kürzender Text
 * @param limit - Token-Limit
 * @param provider - AI-Provider
 * @returns Gekürzter Text
 */
export function truncateToTokenLimit(
  text: string,
  limit: number,
  provider: AllAIProviders = 'openai'
): string {
  if (!exceedsTokenLimit(text, limit, provider)) {
    return text;
  }
  
  // Binäre Suche für optimale Länge
  let low = 0;
  let high = text.length;
  let bestLength = 0;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const truncated = text.substring(0, mid);
    const tokens = estimateTokens(truncated, provider);
    
    if (tokens <= limit) {
      bestLength = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  return text.substring(0, bestLength) + '... (gekürzt)';
}

/**
 * Gibt Token-Statistiken für einen Text zurück
 */
export function getTokenStats(
  text: string,
  provider: AllAIProviders = 'openai'
): {
  tokens: number;
  chars: number;
  words: number;
  lines: number;
  ratio: number;
  textType: string;
} {
  const tokens = estimateTokens(text, provider);
  const chars = text.length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split('\n').length;
  const ratio = chars / Math.max(1, tokens);
  const textType = detectTextType(text);
  
  return { tokens, chars, words, lines, ratio, textType };
}
