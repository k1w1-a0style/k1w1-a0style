import { extractJsonArray, safeJsonParse } from '../utils/chatUtils';

describe('Chat/AI parsing helpers', () => {
  describe('extractJsonArray', () => {
    it('extracts JSON from ```json``` block', () => {
      const text = `
        bla bla
        \`\`\`json
        [{"a":1}]
        \`\`\`
        irgendwas
      `;
      expect(extractJsonArray(text)?.trim()).toBe('[{"a":1}]');
    });

    it('extracts JSON from generic ``` ``` block', () => {
      const text = `
        \`\`\`
        [{"b":2}]
        \`\`\`
      `;
      expect(extractJsonArray(text)?.trim()).toBe('[{"b":2}]');
    });

    it('falls back to first array-like match', () => {
      const text = `Antwort: [{"ok":true}] Ende.`;
      expect(extractJsonArray(text)).toContain('[{"ok":true}]');
    });

    it('returns null when nothing JSON-like exists', () => {
      expect(extractJsonArray('no json here')).toBeNull();
    });
  });

  describe('safeJsonParse', () => {
    it('returns object directly when input is already an object', () => {
      const obj = { a: 1 };
      expect(safeJsonParse(obj)).toEqual({ a: 1 });
    });

    it('repairs and parses mildly broken JSON', () => {
      const broken = '{"a":1,}';
      expect(safeJsonParse<{ a: number }>(broken)).toEqual({ a: 1 });
    });

    it('does not crash on completely invalid input', () => {
      const res = safeJsonParse('<<<<>>>>');
      // je nach Implementierung: null ODER unverändert zurückgegeben
      expect(res === null || res === '<<<<>>>>').toBe(true);
    });

    it('handles empty input', () => {
      expect(safeJsonParse('')).toBeNull();
      expect(safeJsonParse(null)).toBeNull();
      expect(safeJsonParse(undefined)).toBeNull();
    });
  });
});
