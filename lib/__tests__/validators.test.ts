/**
 * Validators Tests
 * 
 * ✅ SICHERHEIT: Testet alle Input-Validierungen
 * 
 * @jest-environment node
 */

import {
  validateFilePath,
  validateFileContent,
  validateGitHubRepo,
  validateChatInput,
  validateZipImport,
  FilePathSchema,
  FileContentSchema,
  GitHubRepoSchema,
  ChatInputSchema,
} from '../validators';

describe('Validators', () => {
  describe('validateFilePath', () => {
    describe('Gültige Pfade', () => {
      const validPaths = [
        'components/Button.tsx',
        'screens/HomeScreen.tsx',
        'utils/helper.ts',
        'README.md',
        'src/index.js',
        'deep/nested/folder/file.tsx',
      ];

      validPaths.forEach(path => {
        it(`sollte "${path}" akzeptieren`, () => {
          const result = validateFilePath(path);
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        });
      });
    });

    describe('Path Traversal Angriffe', () => {
      const attackPaths = [
        '../../../etc/passwd',
        'components/../../hack.tsx',
        '..\\windows\\system32',
        'folder/../../../evil.js',
      ];

      attackPaths.forEach(path => {
        it(`sollte "${path}" ablehnen (Path Traversal)`, () => {
          const result = validateFilePath(path);
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('traversal'))).toBe(true);
        });
      });
    });

    describe('Absolute Pfade', () => {
      const absolutePaths = [
        '/etc/passwd',
        '/root/secret',
        'C:\\Windows\\System32',
      ];

      absolutePaths.forEach(path => {
        it(`sollte "${path}" ablehnen (Absoluter Pfad)`, () => {
          const result = validateFilePath(path);
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('absolute') || e.includes('Ungültige'))).toBe(true);
        });
      });
    });

    describe('Sonderzeichen', () => {
      const invalidPaths = [
        'file<script>.tsx',
        'file?.tsx',
        'file*.tsx',
        'file|pipe.tsx',
        'file:colon.tsx',
      ];

      invalidPaths.forEach(path => {
        it(`sollte "${path}" ablehnen (Ungültige Zeichen)`, () => {
          const result = validateFilePath(path);
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('Ungültige Zeichen'))).toBe(true);
        });
      });
    });

    describe('Edge Cases', () => {
      it('sollte leeren Pfad ablehnen', () => {
        const result = validateFilePath('');
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('leer'))).toBe(true);
      });

      it('sollte sehr langen Pfad ablehnen', () => {
        const longPath = 'a/'.repeat(200) + 'file.tsx';
        const result = validateFilePath(longPath);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('zu lang'))).toBe(true);
      });

      it('sollte Pfad mit trailing slash ablehnen', () => {
        const result = validateFilePath('components/');
        expect(result.valid).toBe(false);
      });

      it('sollte Pfad mit führendem ./ ablehnen', () => {
        const result = validateFilePath('./components/Button.tsx');
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('validateFileContent', () => {
    it('sollte kleinen Content akzeptieren', () => {
      const content = 'Hello World';
      const result = validateFileContent(content);
      
      expect(result.valid).toBe(true);
      expect(result.sizeBytes).toBeLessThan(100);
    });

    it('sollte mittleren Content akzeptieren (1MB)', () => {
      const content = 'a'.repeat(1024 * 1024); // 1MB
      const result = validateFileContent(content);
      
      expect(result.valid).toBe(true);
      expect(result.sizeMB).toBeCloseTo(1, 0);
    });

    it('sollte Content bis 10MB akzeptieren', () => {
      const content = 'a'.repeat(10 * 1024 * 1024); // 10MB
      const result = validateFileContent(content);
      
      expect(result.valid).toBe(true);
    });

    it('sollte zu großen Content ablehnen (11MB)', () => {
      const content = 'a'.repeat(11 * 1024 * 1024); // 11MB
      const result = validateFileContent(content);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('zu groß');
    });

    it('sollte Größe korrekt berechnen', () => {
      const content = 'a'.repeat(1024); // 1KB
      const result = validateFileContent(content);
      
      expect(result.sizeBytes).toBeGreaterThan(1000);
      expect(result.sizeMB).toBeLessThan(0.01);
    });
  });

  describe('validateGitHubRepo', () => {
    describe('Gültige Repos', () => {
      const validRepos = [
        'owner/repo',
        'facebook/react',
        'microsoft/typescript',
        'k1w1-pro/k1w1-app',
      ];

      validRepos.forEach(repo => {
        it(`sollte "${repo}" akzeptieren`, () => {
          const result = validateGitHubRepo(repo);
          expect(result.valid).toBe(true);
          expect(result.owner).toBeDefined();
          expect(result.name).toBeDefined();
        });
      });
    });

    describe('Ungültige Repos', () => {
      const invalidRepos = [
        'no-slash',
        'too/many/slashes',
        '/leading-slash',
        'trailing-slash/',
        'owner/',
        '/repo',
        '',
      ];

      invalidRepos.forEach(repo => {
        it(`sollte "${repo}" ablehnen`, () => {
          const result = validateGitHubRepo(repo);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        });
      });
    });

    it('sollte Owner und Name korrekt extrahieren', () => {
      const result = validateGitHubRepo('facebook/react');
      
      expect(result.valid).toBe(true);
      expect(result.owner).toBe('facebook');
      expect(result.name).toBe('react');
    });
  });

  describe('validateChatInput', () => {
    it('sollte normale Nachricht akzeptieren', () => {
      const result = validateChatInput('Erstelle eine Button-Komponente');
      
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeDefined();
    });

    it('sollte lange Nachricht akzeptieren', () => {
      const longMessage = 'a'.repeat(5000);
      const result = validateChatInput(longMessage);
      
      expect(result.valid).toBe(true);
    });

    it('sollte leere Nachricht ablehnen', () => {
      const result = validateChatInput('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('leer');
    });

    it('sollte zu lange Nachricht ablehnen (>10k)', () => {
      const tooLong = 'a'.repeat(10001);
      const result = validateChatInput(tooLong);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('zu lang');
    });

    describe('XSS-Schutz', () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<script src="evil.js"></script>',
        '<iframe src="phishing.com"></iframe>',
      ];

      xssPayloads.forEach(payload => {
        it(`sollte XSS-Payload ablehnen: ${payload.substring(0, 30)}...`, () => {
          const result = validateChatInput(payload);
          expect(result.valid).toBe(false);
        });
      });
    });

    it('sollte HTML-Tags in Text akzeptieren (als String)', () => {
      const result = validateChatInput('Ich möchte ein <div> Element erstellen');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateZipImport', () => {
    it('sollte gültige Dateien akzeptieren', () => {
      const files = [
        { path: 'App.tsx', content: 'export default App;' },
        { path: 'components/Button.tsx', content: 'export const Button = () => {};' },
      ];
      
      const result = validateZipImport(files);
      
      expect(result.valid).toBe(true);
      expect(result.validFiles).toHaveLength(2);
      expect(result.invalidFiles).toHaveLength(0);
    });

    it('sollte ungültige Pfade filtern', () => {
      const files = [
        { path: 'valid.tsx', content: 'code' },
        { path: '../../../etc/passwd', content: 'hack' },
        { path: 'also-valid.tsx', content: 'more code' },
      ];
      
      const result = validateZipImport(files);
      
      expect(result.valid).toBe(false);
      expect(result.validFiles).toHaveLength(2);
      expect(result.invalidFiles).toHaveLength(1);
      expect(result.invalidFiles[0].path).toBe('../../../etc/passwd');
    });

    it('sollte zu große Dateien filtern', () => {
      const files = [
        { path: 'small.txt', content: 'small' },
        { path: 'huge.txt', content: 'a'.repeat(11 * 1024 * 1024) }, // 11MB
      ];
      
      const result = validateZipImport(files);
      
      expect(result.valid).toBe(false);
      expect(result.validFiles).toHaveLength(1);
      expect(result.invalidFiles).toHaveLength(1);
    });

    it('sollte zu viele Dateien ablehnen', () => {
      const files = Array.from({ length: 1001 }, (_, i) => ({
        path: `file${i}.txt`,
        content: 'content'
      }));
      
      const result = validateZipImport(files);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Zu viele Dateien'))).toBe(true);
    });

    it('sollte normalisierte Pfade zurückgeben', () => {
      const files = [
        { path: 'components/Button.tsx', content: 'code' },
      ];
      
      const result = validateZipImport(files);
      
      expect(result.validFiles[0].path).toBe('components/Button.tsx');
    });
  });

  // ✅ SICHERHEIT: Zod Schema Direct Tests
  describe('Schema Direct Tests', () => {
    it('FilePathSchema sollte bei ungültigem Input werfen', () => {
      expect(() => FilePathSchema.parse('../hack')).toThrow();
      expect(() => FilePathSchema.parse('/etc/passwd')).toThrow();
    });

    it('FileContentSchema sollte bei zu großem Content werfen', () => {
      const huge = 'a'.repeat(11 * 1024 * 1024);
      expect(() => FileContentSchema.parse(huge)).toThrow();
    });

    it('GitHubRepoSchema sollte bei ungültigem Format werfen', () => {
      expect(() => GitHubRepoSchema.parse('no-slash')).toThrow();
      expect(() => GitHubRepoSchema.parse('too/many/slashes')).toThrow();
    });

    it('ChatInputSchema sollte bei XSS werfen', () => {
      expect(() => ChatInputSchema.parse('<script>alert()</script>')).toThrow();
    });
  });
});
