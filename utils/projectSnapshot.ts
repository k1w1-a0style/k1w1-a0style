// utils/projectSnapshot.ts - Zentrale Funktion für Projekt-Snapshots
// Vermeidet Duplikate zwischen prompts.ts und promptEngine.ts

import { ProjectFile } from '../contexts/types';
import { normalizePath, ensureStringContent, getCodeLineCount } from './chatUtils';
import { CONFIG } from '../config';

type NormalizedFileEntry = {
  original: ProjectFile;
  normalizedPath: string;
  safeContent: string;
  lineCount: number;
};

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

  const normalizedEntries: NormalizedFileEntry[] = files.map((file) => {
    const safeContent = ensureStringContent(file.content);
    return {
      original: file,
      normalizedPath: normalizePath(file.path),
      safeContent,
      lineCount: getCodeLineCount(safeContent),
    };
  });

  const folderFileMap = normalizedEntries.reduce<Record<string, NormalizedFileEntry[]>>(
    (acc, entry) => {
      if (!entry.normalizedPath.includes('/')) {
        return acc;
      }
      const folder = entry.normalizedPath.split('/')[0];
      if (!folder) {
        return acc;
      }
      if (!acc[folder]) {
        acc[folder] = [];
      }
      acc[folder].push(entry);
      return acc;
    },
    {} as Record<string, NormalizedFileEntry[]>
  );

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
      const entry = normalizedEntries.find((e) => e.normalizedPath === filename);
      if (entry) {
        output += `✅ ${filename} (${entry.lineCount} lines)\n`;
      }
    });
    output += '\n';
  }

  // Ordnerstruktur
  if (metrics && Object.keys(metrics.folders).length > 0) {
    output += '📁 Ordnerstruktur:\n';
    const maxFolderEntries = Math.max(maxFiles, 1);
    let emittedFolderEntries = 0;
    let truncatedFolders = false;

    for (const [folder, count] of Object.entries(metrics.folders)) {
      if (emittedFolderEntries >= maxFolderEntries) {
        truncatedFolders = true;
        break;
      }

      output += `📂 ${folder}/ (${count} files)\n`;
      const folderEntries = folderFileMap[folder] || [];
      const remainingSlots = maxFolderEntries - emittedFolderEntries;
      const limitedEntries = folderEntries.slice(0, remainingSlots);

      limitedEntries.forEach((entry) => {
        const fileName = entry.normalizedPath.split('/').pop();
        output += ` * ${fileName} (${entry.lineCount} lines)\n`;
        emittedFolderEntries += 1;
      });

      if (folderEntries.length > limitedEntries.length) {
        output += ` * … weitere Dateien in ${folder}/ gekürzt\n`;
      }
    }

    if (truncatedFolders) {
      output += '📂 … weitere Ordner gekürzt\n';
    }

    output += '\n';
  }

  // Datei-Inhalte (gekürzt)
  if (includeFileContent) {
    const limitedFiles = normalizedEntries.slice(0, maxFiles).map((entry) => {
      const lines = entry.safeContent.split('\n');
      const limitedLines = lines.slice(0, maxLinesPerFile);
      const joined = limitedLines.join('\n');
      const truncated = lines.length > maxLinesPerFile;
      return `# ${entry.original.path}\n${joined}${truncated ? '\n... (gekürzt)' : ''}`;
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
