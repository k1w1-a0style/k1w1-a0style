// lib/__tests__/normalizer.test.ts
import { normalizeAiResponse } from '../normalizer';

// Mock chatUtils
jest.mock('../../utils/chatUtils', () => ({
  normalizePath: jest.fn((path: string) => {
    if (!path || typeof path !== 'string') return '';
    return path.replace(/^\.\//, '').replace(/^\//, '');
  }),
  safeJsonParse: jest.fn((input: unknown) => {
    if (!input) return null;
    if (typeof input === 'object') return input;
    try {
      return JSON.parse(String(input));
    } catch {
      return null;
    }
  }),
  normalizeAndValidateFiles: jest.fn((files: any[]) => {
    if (!files || files.length === 0) return null;
    // Simple validation - just return files with valid paths
    const valid = files.filter(f => f.path && f.content);
    return valid.length > 0 ? valid : null;
  }),
  ensureStringContent: jest.fn((value: unknown) => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }),
}));

describe('normalizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeAiResponse', () => {
    it('should return null for null input', () => {
      expect(normalizeAiResponse(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(normalizeAiResponse(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(normalizeAiResponse('')).toBeNull();
    });

    it('should handle direct array of files', () => {
      const input = [
        { path: 'App.tsx', content: 'export default function App() {}' },
        { path: 'index.js', content: 'import App from "./App"' },
      ];
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
    });

    it('should handle object with files property', () => {
      const input = {
        files: [
          { path: 'App.tsx', content: 'export default function App() {}' },
        ],
      };
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
    });

    it('should handle object with data property', () => {
      const input = {
        data: [
          { path: 'App.tsx', content: 'export default function App() {}' },
        ],
      };
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
    });

    it('should handle object with json property', () => {
      const input = {
        json: [
          { path: 'App.tsx', content: 'export default function App() {}' },
        ],
      };
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
    });

    it('should handle object with output property', () => {
      const input = {
        output: [
          { path: 'App.tsx', content: 'export default function App() {}' },
        ],
      };
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
    });

    it('should handle object with result property', () => {
      const input = {
        result: [
          { path: 'App.tsx', content: 'export default function App() {}' },
        ],
      };
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
    });

    it('should parse JSON string input', () => {
      const input = JSON.stringify([
        { path: 'App.tsx', content: 'export default function App() {}' },
      ]);
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
    });

    it('should return null for invalid JSON string', () => {
      const input = 'not valid json {{{';
      
      const result = normalizeAiResponse(input);
      
      expect(result).toBeNull();
    });

    it('should return null for object without file array', () => {
      const input = {
        message: 'Hello',
        status: 'success',
      };
      
      const result = normalizeAiResponse(input);
      
      expect(result).toBeNull();
    });

    it('should return null for empty file array', () => {
      const input = {
        files: [],
      };
      
      const result = normalizeAiResponse(input);
      
      expect(result).toBeNull();
    });

    it('should remove BOM from content', () => {
      const input = [
        { path: 'App.tsx', content: '\uFEFFexport default function App() {}' },
      ];
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
      expect(result![0].content).not.toContain('\uFEFF');
    });

    it('should remove null bytes from content', () => {
      const input = [
        { path: 'App.tsx', content: 'export\x00 default\x00 function App() {}' },
      ];
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
      expect(result![0].content).not.toContain('\x00');
    });

    it('should remove duplicate paths', () => {
      const input = [
        { path: 'App.tsx', content: 'first content' },
        { path: 'App.tsx', content: 'duplicate content' },
        { path: 'index.js', content: 'index content' },
      ];
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
    });

    it('should filter out files with empty content', () => {
      const input = [
        { path: 'App.tsx', content: 'valid content' },
        { path: 'empty.tsx', content: '' },
        { path: 'whitespace.tsx', content: '   ' },
      ];
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
    });

    it('should skip files without path', () => {
      const input = [
        { path: 'App.tsx', content: 'valid' },
        { content: 'no path' },
        { path: '', content: 'empty path' },
      ];
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
    });

    it('should handle non-string content', () => {
      const input = [
        { path: 'config.json', content: { key: 'value' } },
      ];
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
    });

    it('should handle number type input', () => {
      const result = normalizeAiResponse(123);
      expect(result).toBeNull();
    });

    it('should handle boolean type input', () => {
      const result = normalizeAiResponse(true);
      expect(result).toBeNull();
    });

    it('should normalize file paths', () => {
      const input = [
        { path: './App.tsx', content: 'content' },
        { path: '/components/Button.tsx', content: 'content' },
      ];
      
      const result = normalizeAiResponse(input);
      
      expect(result).not.toBeNull();
    });
  });
});
