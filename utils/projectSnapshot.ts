// utils/projectSnapshot.ts - Zentrale Funktion für Projekt-Snapshots
// Vermeidet Duplikate zwischen prompts.ts und promptEngine.ts

import { ProjectFile } from '../contexts/types';
import { normalizePath, ensureStringContent, getCodeLineCount } from './chatUtils';
import { CONFIG } from '../config';

export interface ProjectSnapshotOptions {
  maxFiles?: number;
  maxLinesPerFile?: number;
  includeFileContent?: boolean;
  includeMetrics?: boolean;
}

export interface ProjectMetrics {
  totalFiles: number;
  totalLines: number;
  folderCount: number;
  folders: Record<string, number>; // folder -> file count
  rootFiles: string[];
  hasPackageJson: boolean;
  packageName?: string;
}

/**
 * Erstellt eine kompakte Übersicht über das Projekt
 * für Prompt-Injection in LLM-Anfragen.
 */
export function buildProjectSnapshot(
  files: ProjectFile[],
  options: ProjectSnapshotOptions = {}
): string {
  const {
    maxFiles = 20,
    maxLinesPerFile = 40,
    includeFileContent = true,
    includeMetrics = true,
  } = options;

  if (!files || files.length === 0) {
    return 'Es sind aktuell noch keine Projektdateien angelegt.';
  }

  const metrics = includeMetrics ? calculateProjectMetrics(files) : null;
  let output = '';

  // Header mit Metriken
  if (metrics) {
    output += `📊 Projekt: ${metrics.totalFiles} Dateien`;
    if (metrics.folderCount > 0) {
      output += ` (${metrics.folderCount} Ordner)`;
    }
    output += '\n\n';
  }

  // Root-Dateien
  if (metrics && metrics.rootFiles.length > 0) {
    output += '🗂️ Root Files:\n';
    metrics.rootFiles.forEach((filename) => {
      const file = files.find((f) => normalizePath(f.path) === filename);
      if (file) {
        const lines = getCodeLineCount(ensureStringContent(file.content));
        output += `✅ ${filename} (${lines} lines)\n`;
      }
    });
    output += '\n';
  }

  // Ordnerstruktur
  if (metrics && Object.keys(metrics.folders).length > 0) {
    output += '📁 Ordnerstruktur:\n';
    Object.entries(metrics.folders).forEach(([folder, count]) => {
      output += `📂 ${folder}/ (${count} files)\n`;
      const folderFiles = files.filter((f) => normalizePath(f.path).startsWith(`${folder}/`));
      folderFiles.forEach((f) => {
        const lines = getCodeLineCount(ensureStringContent(f.content));
        const fileName = normalizePath(f.path).split('/').pop();
        output += ` * ${fileName} (${lines} lines)\n`;
      });
    });
    output += '\n';
  }

  // Datei-Inhalte (gekürzt)
  if (includeFileContent) {
    const limitedFiles = [...files].slice(0, maxFiles).map((f) => {
      const path = f.path;
      const content = String(f.content ?? '');
      const lines = content.split('\n').slice(0, maxLinesPerFile);
      const joined = lines.join('\n');
      return `# ${path}\n${joined}${lines.length === maxLinesPerFile ? '\n... (gekürzt)' : ''}`;
    });

    if (limitedFiles.length > 0) {
      output += 'Ausschnitt der aktuellen Projektdateien:\n\n';
      output += limitedFiles.join('\n\n');
      output += '\n\n';
    }

    if (files.length > maxFiles) {
      output += `(Hinweis: ${files.length - maxFiles} weitere Dateien nicht angezeigt)\n`;
    }
  }

  // Package Name Protection
  if (metrics?.hasPackageJson && metrics.packageName) {
    output += `\n🚨 Protected package name: "${metrics.packageName}"\n`;
  }

  return output;
}

/**
 * Berechnet Metriken über das Projekt
 */
export function calculateProjectMetrics(files: ProjectFile[]): ProjectMetrics {
  const folderSet = new Set<string>();
  const folders: Record<string, number> = {};
  const rootFiles: string[] = [];
  let totalLines = 0;
  let hasPackageJson = false;
  let packageName: string | undefined;

  files.forEach((file) => {
    const path = normalizePath(file.path);
    const parts = path.split('/');
    const content = ensureStringContent(file.content);
    const lines = getCodeLineCount(content);
    totalLines += lines;

    // Root-Dateien
    if (parts.length === 1 && CONFIG.PATHS.ALLOWED_ROOT.includes(path)) {
      rootFiles.push(path);

      // Package.json parsen
      if (path === 'package.json') {
        hasPackageJson = true;
        try {
          const pkg = JSON.parse(content);
          packageName = pkg.name;
        } catch {
          // ignore
        }
      }
    }

    // Ordner-Zuordnung
    const folder = parts[0];
    if (CONFIG.PATHS.SRC_FOLDERS.includes(folder)) {
      folderSet.add(folder);
      folders[folder] = (folders[folder] || 0) + 1;
    }
  });

  return {
    totalFiles: files.length,
    totalLines,
    folderCount: folderSet.size,
    folders,
    rootFiles,
    hasPackageJson,
    packageName,
  };
}

/**
 * Formatiert Projekt-Metriken als Text
 */
export function formatProjectMetrics(metrics: ProjectMetrics): string {
  let output = `📊 Projekt-Statistik:\n`;
  output += `  • Dateien: ${metrics.totalFiles}\n`;
  output += `  • Zeilen: ${metrics.totalLines.toLocaleString()}\n`;
  output += `  • Ordner: ${metrics.folderCount}\n`;

  if (Object.keys(metrics.folders).length > 0) {
    output += `\n📁 Ordnerverteilung:\n`;
    Object.entries(metrics.folders)
      .sort(([, a], [, b]) => b - a)
      .forEach(([folder, count]) => {
        output += `  • ${folder}: ${count} Dateien\n`;
      });
  }

  if (metrics.packageName) {
    output += `\n📦 Package: ${metrics.packageName}\n`;
  }

  return output;
}
