// lib/__tests__/normalizer.test.ts
import { normalizeAiResponse, normalizeAiResponseDetailed } from '../normalizer';

describe('normalizer', () => {
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
        files: [{ path: 'App.tsx', content: 'export default function App() {}' }],
      };

      const result = normalizeAiResponse(input);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
    });

    it('should handle object with data property', () => {
      const input = {
        data: [{ path: 'App.tsx', content: 'export default function App() {}' }],
      };

      const result = normalizeAiResponse(input);

      expect(result).not.toBeNull();
    });

    it('should handle object with json property', () => {
      const input = {
        json: [{ path: 'App.tsx', content: 'export default function App() {}' }],
      };

      const result = normalizeAiResponse(input);

      expect(result).not.toBeNull();
    });

    it('should handle object with output property', () => {
      const input = {
        output: [{ path: 'App.tsx', content: 'export default function App() {}' }],
      };

      const result = normalizeAiResponse(input);

      expect(result).not.toBeNull();
    });

    it('should handle object with result property', () => {
      const input = {
        result: [{ path: 'App.tsx', content: 'export default function App() {}' }],
      };

      const result = normalizeAiResponse(input);

      expect(result).not.toBeNull();
    });

    it('should parse JSON string input', () => {
      const input = JSON.stringify([{ path: 'App.tsx', content: 'export default function App() {}' }]);

      const result = normalizeAiResponse(input);

      expect(result).not.toBeNull();
    });

    
    it('should parse JSON object embedded in text', () => {
      const embedded = `Hier ist dein Patch:\n\n{ "files": [{ "path": "App.tsx", "content": "ok" }] }\nDanke`;
      const result = normalizeAiResponse(embedded);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].path).toBe('App.tsx');
    });

    it('should parse fenced JSON object', () => {
      const embedded = "```json\n{\n  \"files\": [{ \"path\": \"a.ts\", \"content\": \"x\" }]\n}\n```";
      const result = normalizeAiResponse(embedded);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].path).toBe('a.ts');
    });




    it('returns parse metadata when response text is not file-json', () => {
      const result = normalizeAiResponseDetailed('Ich brauche erst mehr Details, bevor ich Dateien ändere.');

      expect(result).not.toBeNull();
      expect(result?.files).toHaveLength(0);
      expect(result?.parseError).toBeTruthy();
      expect(result?.responseText).toContain('mehr Details');
    });


    it('returns responseText from output_text payload when no JSON files are present', () => {
      const result = normalizeAiResponseDetailed({ output_text: 'Ich brauche mehr Kontext bevor ich Dateien liefere.' });

      expect(result).not.toBeNull();
      expect(result?.files).toHaveLength(0);
      expect(result?.parseError).toBe('no_file_array_detected');
      expect(result?.responseText).toContain('mehr Kontext');
    });

    it('reports normalization failure for text payloads whose file array normalizes to empty', () => {
      const result = normalizeAiResponseDetailed(
        '{"files":[{"path":"","content":"x"},{"path":"App.tsx","content":"   "}]}'
      );

      expect(result).not.toBeNull();
      expect(result?.files).toHaveLength(0);
      expect(result?.parseError).toBe('no_valid_files_after_normalization');
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
      const input = [{ path: 'App.tsx', content: '\uFEFFexport default function App() {}' }];

      const result = normalizeAiResponse(input);

      expect(result).not.toBeNull();
      expect(result![0].content).not.toContain('\uFEFF');
    });

    it('should remove null bytes from content', () => {
      const input = [{ path: 'App.tsx', content: 'export\x00 default\x00 function App() {}' }];

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
      const input = [{ path: 'config.json', content: { key: 'value' } }];

      const result = normalizeAiResponse(input);

      expect(result).not.toBeNull();
      expect(result![0].path).toBe('config.json');
      expect(result![0].content).toContain('"key": "value"');
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
      expect(result).toHaveLength(2);
      const paths = result!.map(f => f.path).sort();
      expect(paths).toContain('App.tsx');
      expect(paths).toContain('components/Button.tsx');
    });
  });
});
