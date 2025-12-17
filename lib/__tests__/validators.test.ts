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
    const validPaths = [
      'components/Button.tsx',
      'screens/HomeScreen.tsx',
      'lib/validators.ts',
      'contexts/ProjectContext.tsx',
      'hooks/useNotifications.ts',
      'utils/helpers.ts',
      'types/index.ts',
      'navigation/TabNavigator.tsx',
    ];

    validPaths.forEach(path => {
      it(`sollte "${path}" akzeptieren`, () => {
        const result = validateFilePath(path);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('sollte "src/index.js" ablehnen (Policy: kein src/)', () => {
      const result = validateFilePath('src/index.js');
      expect(result.valid).toBe(false);
    });

    it('sollte sehr tiefe Pfade ablehnen (Policy abhängig)', () => {
      const result = validateFilePath('deep/nested/folder/file.tsx');
      expect(result.valid).toBe(false);
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
      it('sollte Pfad mit führendem ./ ablehnen', () => {
        const result = validateFilePath('./components/Button.tsx');
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('validateFileContent', () => {
    it('sollte kleinen Content akzeptieren', () => {
      const content = 'hello';
      const result = validateFileContent(content);
      expect(result.valid).toBe(true);
      expect(typeof result.sizeBytes).toBe('number');
      expect(typeof result.sizeMB).toBe('number');
      expect(result.sizeBytes).toBeLessThan(100);
    });

    it('sollte mittleren Content akzeptieren (1MB)', () => {
      const content = 'a'.repeat(1 * 1024 * 1024);
      const result = validateFileContent(content);
      expect(result.valid).toBe(true);
      expect(result.sizeMB).toBeCloseTo(1, 0);
    });

    it('sollte Content bis 10MB akzeptieren', () => {
      const content = 'a'.repeat(10 * 1024 * 1024);
      const result = validateFileContent(content);
      expect(result.valid).toBe(true);
    });

    it('sollte zu großen Content ablehnen (11MB)', () => {
      const content = 'a'.repeat(11 * 1024 * 1024);
      const result = validateFileContent(content);
      expect(result.valid).toBe(false);
      expect(result.error || "").toMatch(/zu groß|größe|MB/i);
    });
  });

  describe('validateGitHubRepo', () => {
    const validRepos = ['owner/repo', 'facebook/react', 'microsoft/typescript', 'k1w1-pro/k1w1-app'];

    validRepos.forEach(repo => {
      it(`sollte "${repo}" akzeptieren`, () => {
        const result = validateGitHubRepo(repo);
        expect(result.valid).toBe(true);
        expect(result.owner).toBeDefined();
        expect(result.name).toBeDefined();
      });
    });

    const invalidRepos = ['no-slash', 'too/many/slashes', '/leading-slash', 'trailing-slash/', 'owner/', '/repo', ''];

    invalidRepos.forEach(repo => {
      it(`sollte "${repo}" ablehnen`, () => {
        const result = validateGitHubRepo(repo);
        expect(result.valid).toBe(false);
        expect(result.error || "").toBeTruthy();
      });
    });
  });

  describe('validateChatInput', () => {
    it('sollte normale Nachricht akzeptieren', () => {
      const result = validateChatInput('Erstelle eine Button-Komponente');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeDefined();
    });

    it('sollte leere Nachricht ablehnen', () => {
      const result = validateChatInput('');
      expect(result.valid).toBe(false);
      expect(result.error || '').toMatch(/leer/i);
    });

    it('sollte XSS sanitisieren und hadXSS markieren', () => {
      const result = validateChatInput('<script>alert("XSS")</script>');
      expect(result.valid).toBe(true);
      expect(result.hadXSS).toBe(true);
      expect(result.sanitized).toBeDefined();
      expect(result.sanitized).not.toContain('<script');
    });
  });

  describe('validateZipImport', () => {
    it('sollte gültige Dateien akzeptieren', () => {
      const files = [
        { path: 'components/Button.tsx', content: 'export const Button = () => null;' },
        { path: 'screens/Home.tsx', content: 'export default function Home() { return null; }' },
      ];

      const result = validateZipImport(files as any);
      expect(result.valid).toBe(true);
      expect(result.validFiles).toHaveLength(2);
      expect(result.invalidFiles).toHaveLength(0);
    });

    it('sollte ungültige Pfade filtern (partial accept)', () => {
      const files = [
        { path: '../../../etc/passwd', content: 'nope' },
        { path: 'components/Button.tsx', content: 'ok' },
        { path: 'screens/Home.tsx', content: 'ok' },
      ];

      const result = validateZipImport(files as any);
      expect(result.valid).toBe(false);

      // Dein aktuelles Verhalten: gültige bleiben drin, ungültige separat.
      expect(result.validFiles).toHaveLength(2);
      expect(result.invalidFiles).toHaveLength(1);
      expect(result.invalidFiles[0].path).toBe('../../../etc/passwd');
    });

    it('sollte zu große Dateien filtern (partial accept)', () => {
      const tooBig = 'a'.repeat(11 * 1024 * 1024);
      const files = [
        { path: 'components/Big.tsx', content: tooBig },
        { path: 'components/Small.tsx', content: 'ok' },
      ];

      const result = validateZipImport(files as any);
      expect(result.valid).toBe(false);
      expect(result.validFiles).toHaveLength(1);
      expect(result.validFiles[0].path).toBe('components/Small.tsx');
      expect(result.invalidFiles.length).toBeGreaterThanOrEqual(1);
    });

    it('sollte zu viele Dateien ablehnen', () => {
      const files = Array.from({ length: 201 }).map((_, i) => ({
        path: `components/f${i}.tsx`,
        content: 'x',
      }));

      const result = validateZipImport(files as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Zu viele Dateien'))).toBe(true);
    });

    it('sollte normalisierte Pfade zurückgeben', () => {
      const files = [{ path: 'components//Button.tsx', content: 'x' }];
      const result = validateZipImport(files as any);
      expect(result.valid).toBe(true);
      expect(result.validFiles[0].path).toBe('components/Button.tsx');
    });
  });

  describe('Schema Direct Tests', () => {
    it('Schemas sind permissive; Wrapper-Validatoren sind die Policy', () => {
      expect(FilePathSchema.safeParse('../hack').success).toBe(true);
      expect(validateFilePath('../hack').valid).toBe(false);

      const huge = 'a'.repeat(11 * 1024 * 1024);
      expect(FileContentSchema.safeParse(huge).success).toBe(true);
      expect(validateFileContent(huge).valid).toBe(false);

      expect(GitHubRepoSchema.safeParse('no-slash').success).toBe(true);
      expect(validateGitHubRepo('no-slash').valid).toBe(false);

      expect(ChatInputSchema.safeParse('<script>alert()</script>').success).toBe(true);
      const ci = validateChatInput('<script>alert()</script>');
      expect(ci.valid).toBe(true);
      expect(ci.hadXSS).toBe(true);
    });
  });
});
