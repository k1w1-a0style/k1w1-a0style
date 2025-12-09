// lib/__tests__/tokenEstimator.test.ts
import { estimateTokens, estimateTokensForArray, exceedsTokenLimit } from '../tokenEstimator';

// Mock the config
jest.mock('../../config', () => ({
  CONFIG: {
    TOKEN_RATIO: {
      groq: 4,
      openai: 3.8,
      anthropic: 4.2,
      gemini: 4,
      default: 4,
    },
  },
}));

describe('tokenEstimator', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should return 0 for null input', () => {
      expect(estimateTokens(null as any)).toBe(0);
    });

    it('should return 0 for undefined input', () => {
      expect(estimateTokens(undefined as any)).toBe(0);
    });

    it('should estimate tokens using default ratio', () => {
      const text = 'Hello World'; // 11 characters
      // Default ratio is 4, so 11/4 = 2.75, ceil = 3
      expect(estimateTokens(text)).toBe(3);
    });

    it('should estimate tokens for groq provider', () => {
      const text = 'Hello World'; // 11 characters
      // Groq ratio is 4, so 11/4 = 2.75, ceil = 3
      expect(estimateTokens(text, 'groq' as any)).toBe(3);
    });

    it('should estimate tokens for openai provider', () => {
      const text = 'Hello World!!'; // 13 characters
      // OpenAI ratio is 3.8, so 13/3.8 = 3.42, ceil = 4
      expect(estimateTokens(text, 'openai' as any)).toBe(4);
    });

    it('should estimate tokens for anthropic provider', () => {
      const text = 'Hello World!!'; // 13 characters
      // Anthropic ratio is 4.2, so 13/4.2 = 3.09, ceil = 4
      expect(estimateTokens(text, 'anthropic' as any)).toBe(4);
    });

    it('should use default ratio for unknown provider', () => {
      const text = 'Hello World'; // 11 characters
      // Default ratio is 4
      expect(estimateTokens(text, 'unknown_provider' as any)).toBe(3);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(1000); // 1000 characters
      // Default ratio 4, so 1000/4 = 250
      expect(estimateTokens(text)).toBe(250);
    });

    it('should handle text with special characters', () => {
      const text = '你好世界🌍'; // Unicode characters
      expect(estimateTokens(text)).toBeGreaterThan(0);
    });

    it('should handle text with newlines', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      expect(estimateTokens(text)).toBeGreaterThan(0);
    });
  });

  describe('estimateTokensForArray', () => {
    it('should return 0 for empty array', () => {
      expect(estimateTokensForArray([])).toBe(0);
    });

    it('should sum tokens for multiple texts', () => {
      const texts = ['Hello', 'World']; // 5 + 5 = 10 characters
      // Default ratio 4, so 5/4 = 1.25, ceil = 2 each, total = 4
      expect(estimateTokensForArray(texts)).toBe(4);
    });

    it('should handle mixed length texts', () => {
      const texts = ['a', 'bb', 'ccc', 'dddd'];
      // 1/4=0.25->1, 2/4=0.5->1, 3/4=0.75->1, 4/4=1->1
      expect(estimateTokensForArray(texts)).toBe(4);
    });

    it('should use specified provider', () => {
      const texts = ['Hello World!!', 'Test']; // 13 + 4 = 17 characters
      // OpenAI: 13/3.8=3.42->4, 4/3.8=1.05->2, total = 6
      expect(estimateTokensForArray(texts, 'openai' as any)).toBe(6);
    });

    it('should handle array with empty strings', () => {
      const texts = ['Hello', '', 'World'];
      // 5/4=1.25->2, 0, 5/4=1.25->2 = 4
      expect(estimateTokensForArray(texts)).toBe(4);
    });
  });

  describe('exceedsTokenLimit', () => {
    it('should return false when under limit', () => {
      const text = 'Hello'; // ~2 tokens
      expect(exceedsTokenLimit(text, 10)).toBe(false);
    });

    it('should return true when over limit', () => {
      const text = 'a'.repeat(100); // 100/4 = 25 tokens
      expect(exceedsTokenLimit(text, 10)).toBe(true);
    });

    it('should return false when exactly at limit', () => {
      const text = 'a'.repeat(40); // 40/4 = 10 tokens
      expect(exceedsTokenLimit(text, 10)).toBe(false);
    });

    it('should use provider-specific ratio', () => {
      const text = 'a'.repeat(38); // 38 characters
      // OpenAI: 38/3.8 = 10 tokens
      expect(exceedsTokenLimit(text, 10, 'openai' as any)).toBe(false);
      // Groq: 38/4 = 9.5 -> 10 tokens
      expect(exceedsTokenLimit(text, 10, 'groq' as any)).toBe(false);
    });

    it('should return false for empty text', () => {
      expect(exceedsTokenLimit('', 10)).toBe(false);
    });

    it('should handle zero limit', () => {
      expect(exceedsTokenLimit('a', 0)).toBe(true);
    });
  });
});
