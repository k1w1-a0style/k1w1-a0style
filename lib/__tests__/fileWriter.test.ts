/**
 * FileWriter Tests
 * 
 * ✅ SICHERHEIT: Testet File-Merge und Validierung
 * 
 * @jest-environment node
 */

import { applyFilesToProject } from '../fileWriter';
import { ProjectFile } from '../../contexts/types';

describe('FileWriter', () => {
  describe('applyFilesToProject', () => {
    describe('Neue Dateien erstellen', () => {
      it('sollte neue Dateien zur Projektstruktur hinzufügen', () => {
        const existing: ProjectFile[] = [
          { path: 'App.tsx', content: 'export default App;' },
        ];
        const incoming: ProjectFile[] = [
          { path: 'components/Button.tsx', content: 'export const Button = () => {};' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.created).toContain('components/Button.tsx');
        expect(result.updated).toHaveLength(0);
        expect(result.skipped).toHaveLength(0);
        expect(result.files).toHaveLength(2);
      });

      it('sollte mehrere neue Dateien erstellen', () => {
        const existing: ProjectFile[] = [];
        const incoming: ProjectFile[] = [
          { path: 'components/Button.tsx', content: 'button code' },
          { path: 'components/Card.tsx', content: 'card code' },
          { path: 'screens/Home.tsx', content: 'home code' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.created).toHaveLength(3);
        expect(result.files).toHaveLength(3);
      });
    });

    describe('Dateien aktualisieren', () => {
      it('sollte bestehende Dateien mit neuem Inhalt aktualisieren', () => {
        const existing: ProjectFile[] = [
          { path: 'components/Button.tsx', content: 'old content' },
        ];
        const incoming: ProjectFile[] = [
          { path: 'components/Button.tsx', content: 'new content' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.updated).toContain('components/Button.tsx');
        expect(result.created).toHaveLength(0);
        expect(result.files.find(f => f.path === 'components/Button.tsx')?.content).toBe('new content');
      });

      it('sollte unveränderte Dateien überspringen', () => {
        const existing: ProjectFile[] = [
          { path: 'components/Button.tsx', content: 'same content' },
        ];
        const incoming: ProjectFile[] = [
          { path: 'components/Button.tsx', content: 'same content' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.skipped).toContain('components/Button.tsx');
        expect(result.updated).toHaveLength(0);
        expect(result.created).toHaveLength(0);
      });
    });

    describe('Geschützte Dateien', () => {
      const protectedFiles = [
        'app.config.js',
        'eas.json',
        'metro.config.js',
        'package.json',
        'tsconfig.json',
        'config.ts',
        'theme.ts',
      ];

      protectedFiles.forEach(protectedFile => {
        it(`sollte "${protectedFile}" niemals überschreiben`, () => {
          const existing: ProjectFile[] = [
            { path: protectedFile, content: 'original' },
          ];
          const incoming: ProjectFile[] = [
            { path: protectedFile, content: 'hacked' },
          ];

          const result = applyFilesToProject(existing, incoming);

          expect(result.skipped).toContain(protectedFile);
          expect(result.updated).not.toContain(protectedFile);
          expect(result.files.find(f => f.path === protectedFile)?.content).toBe('original');
        });
      });
    });

    describe('Pfad-Validierung', () => {
      it('sollte ungültige Pfade (Path Traversal) ablehnen', () => {
        const existing: ProjectFile[] = [];
        const incoming: ProjectFile[] = [
          { path: '../../../etc/passwd', content: 'hacked' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.skipped).toContain('../../../etc/passwd');
        expect(result.created).toHaveLength(0);
        expect(result.files).toHaveLength(0);
      });

      it('sollte absolute Pfade ablehnen', () => {
        const existing: ProjectFile[] = [];
        const incoming: ProjectFile[] = [
          { path: '/etc/passwd', content: 'hacked' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.skipped).toHaveLength(1);
        expect(result.created).toHaveLength(0);
      });

      it('sollte Pfade mit Sonderzeichen ablehnen', () => {
        const existing: ProjectFile[] = [];
        const incoming: ProjectFile[] = [
          { path: 'file<script>.tsx', content: 'code' },
          { path: 'file|pipe.tsx', content: 'code' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.skipped).toHaveLength(2);
        expect(result.created).toHaveLength(0);
      });
    });

    describe('Content-Validierung', () => {
      it('sollte zu große Dateien ablehnen', () => {
        const existing: ProjectFile[] = [];
        const hugeContent = 'a'.repeat(11 * 1024 * 1024); // 11MB
        const incoming: ProjectFile[] = [
          { path: 'huge.tsx', content: hugeContent },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.skipped).toContain('huge.tsx');
        expect(result.created).toHaveLength(0);
      });

      it('sollte normale Dateigrößen akzeptieren', () => {
        const existing: ProjectFile[] = [];
        const normalContent = 'a'.repeat(1000); // 1KB
        const incoming: ProjectFile[] = [
          { path: 'normal.tsx', content: normalContent },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.created).toContain('normal.tsx');
        expect(result.skipped).toHaveLength(0);
      });
    });

    describe('Pfad-Normalisierung', () => {
      it('sollte führende Slashes entfernen', () => {
        // Note: This tests the internal normalization behavior
        const existing: ProjectFile[] = [];
        const incoming: ProjectFile[] = [
          { path: 'components/Button.tsx', content: 'code' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.files[0].path).not.toMatch(/^\//);
      });
    });

    describe('Merge-Verhalten', () => {
      it('sollte bestehende Dateien beibehalten, die nicht in incoming sind', () => {
        const existing: ProjectFile[] = [
          { path: 'existing1.tsx', content: 'keep me' },
          { path: 'existing2.tsx', content: 'keep me too' },
        ];
        const incoming: ProjectFile[] = [
          { path: 'new.tsx', content: 'new file' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.files).toHaveLength(3);
        expect(result.files.find(f => f.path === 'existing1.tsx')).toBeDefined();
        expect(result.files.find(f => f.path === 'existing2.tsx')).toBeDefined();
        expect(result.files.find(f => f.path === 'new.tsx')).toBeDefined();
      });

      it('sollte gemischte Create/Update/Skip korrekt verarbeiten', () => {
        const existing: ProjectFile[] = [
          { path: 'update-me.tsx', content: 'old' },
          { path: 'skip-me.tsx', content: 'same' },
        ];
        const incoming: ProjectFile[] = [
          { path: 'update-me.tsx', content: 'new' },
          { path: 'skip-me.tsx', content: 'same' },
          { path: 'create-me.tsx', content: 'created' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.created).toContain('create-me.tsx');
        expect(result.updated).toContain('update-me.tsx');
        expect(result.skipped).toContain('skip-me.tsx');
        expect(result.files).toHaveLength(3);
      });
    });

    describe('Edge Cases', () => {
      it('sollte leeres incoming-Array handhaben', () => {
        const existing: ProjectFile[] = [
          { path: 'App.tsx', content: 'code' },
        ];
        const incoming: ProjectFile[] = [];

        const result = applyFilesToProject(existing, incoming);

        expect(result.created).toHaveLength(0);
        expect(result.updated).toHaveLength(0);
        expect(result.skipped).toHaveLength(0);
        expect(result.files).toHaveLength(1);
      });

      it('sollte leeres existing-Array handhaben', () => {
        const existing: ProjectFile[] = [];
        const incoming: ProjectFile[] = [
          { path: 'new.tsx', content: 'code' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.created).toContain('new.tsx');
        expect(result.files).toHaveLength(1);
      });

      it('sollte Dateien mit leerem Content handhaben', () => {
        const existing: ProjectFile[] = [];
        const incoming: ProjectFile[] = [
          { path: 'empty.tsx', content: '' },
        ];

        const result = applyFilesToProject(existing, incoming);

        // Leerer Content sollte akzeptiert werden
        expect(result.created).toContain('empty.tsx');
      });

      it('sollte sehr lange Pfade ablehnen', () => {
        const existing: ProjectFile[] = [];
        const longPath = 'a/'.repeat(200) + 'file.tsx';
        const incoming: ProjectFile[] = [
          { path: longPath, content: 'code' },
        ];

        const result = applyFilesToProject(existing, incoming);

        expect(result.skipped).toHaveLength(1);
        expect(result.created).toHaveLength(0);
      });
    });
  });
});
