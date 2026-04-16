// screens/AppStatusScreen/hooks/useAppStatusScreen.ts
// REFACTORED: helpers → appStatusHelpers.ts

import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import type { ProjectFile } from '../../../shared/types/project';
import { useProject } from '../../../contexts/ProjectContext';
import type {
  BuildConfig,
  DependencyItem,
  FileTree,
  ProjectStats,
  SectionType,
  ValidationIssue,
} from '../types';


import {
  readText, safeJsonParse, countLinesSafe, extractWithRegex,
  parseExpoConfig, resolveEntryPoint, resolveFoundationValidationIssues,
  MAX_DEP_ITEMS, MAX_DIRS, MAX_FILES_PER_DIR,
} from "./appStatusHelpers";
import type { PackageJson, DerivedState } from "./appStatusHelpers";
export { parseExpoConfig, resolveEntryPoint } from "./appStatusHelpers";


export function useAppStatusScreen() {
  const { projectData, isLoading, isRecoveryMode, exportProjectAsZip } = useProject();
  const [activeSection, setActiveSection] = useState<SectionType>('overview');

  const derived = useMemo<DerivedState>(() => {
    const foundationIssues = resolveFoundationValidationIssues({
      isLoading,
      hasProjectData: !!projectData,
      isRecoveryMode,
    });
    if (foundationIssues.length > 0) {
      return {
        buildConfig: null,
        projectStats: null,
        validationIssues: foundationIssues,
        dependencies: [],
        dependenciesTotal: 0,
        fileTree: [],
        fileDirsTotal: 0,
        fileTreeCounts: {},
      };
    }

    if (!projectData) {
      return {
        buildConfig: null,
        projectStats: null,
        validationIssues: [],
        dependencies: [],
        dependenciesTotal: 0,
        fileTree: [],
        fileDirsTotal: 0,
        fileTreeCounts: {},
      };
    }

    const files = projectData.files || [];
    const issues: ValidationIssue[] = [];

    // package.json
    const pkgFile = files.find(f => f.path === 'package.json');
    let pkg: PackageJson | null = null;
    let pkgName = projectData.name || 'Unknown Project';
    let pkgVersion = '1.0.0';
    let deps: Record<string, string> = {};
    let devDeps: Record<string, string> = {};

    if (pkgFile) {
      const parsed = safeJsonParse<PackageJson>(readText(pkgFile));
      if (parsed.ok) {
        pkg = parsed.value;
        pkgName = parsed.value.name || pkgName;
        pkgVersion = parsed.value.version || pkgVersion;
        deps = parsed.value.dependencies || {};
        devDeps = parsed.value.devDependencies || {};
      } else {
        issues.push({
          type: 'error',
          message: 'package.json ist fehlerhaft',
          details: parsed.error,
        });
      }
    } else {
      issues.push({
        type: 'error',
        message: 'package.json fehlt',
        details: 'Diese Datei ist zwingend erforderlich',
      });
    }

    // Expo config (app.json / app.config.*)
    const expoParse = parseExpoConfig(files);
    let appName = pkgName;
    let packageName = '';
    let owner = '';

    const hasAnyAppConfig = expoParse.source !== null;
    if (!hasAnyAppConfig) {
      issues.push({
        type: 'error',
        message: 'Expo Config fehlt',
        details: 'app.json oder app.config.(js|ts) ist für den Build erforderlich',
      });
    } else if (!expoParse.config) {
      issues.push({
        type: expoParse.hasCanonicalConflict ? 'error' : 'warning',
        message: expoParse.hasCanonicalConflict
          ? `${expoParse.source} enthält widersprüchliche kanonische Duplikate`
          : `${expoParse.source} konnte nicht gelesen werden`,
        details: expoParse.error,
      });
    } else {
      appName = expoParse.config.name || appName;
      packageName = expoParse.config.android?.package || '';
      owner = expoParse.config.owner || '';
    }

    if (hasAnyAppConfig && !packageName && !projectData.packageName) {
      issues.push({
        type: 'error',
        message: 'Android Package Name fehlt',
        details: 'expo.android.package muss in der Expo Config definiert sein',
      });
    }

    // Entry point validation (package.json main or known defaults)
    const entryCheck = resolveEntryPoint(files, pkg);
    if (!entryCheck.ok) {
      issues.push({
        type: 'error',
        message: 'Entry-Point fehlt',
        details: entryCheck.missingPath
          ? `package.json main zeigt auf fehlende Datei: ${entryCheck.missingPath}`
          : 'Entry-Point konnte nicht gefunden werden',
      });
    }

    // Required deps (check both deps and devDeps to avoid false positives)
    const combinedDeps = { ...deps, ...devDeps };
    const requiredDeps = ['expo', 'react', 'react-native'];
    requiredDeps.forEach(dep => {
      if (!combinedDeps[dep]) {
        issues.push({
          type: 'error',
          message: `Fehlende Dependency: ${dep}`,
          details: 'Diese Dependency ist erforderlich',
        });
      }
    });

    // Expo version / SDK
    const expoVersion = combinedDeps.expo || '';
    let sdkVersion = 'Unknown';
    if (expoVersion) {
      const versionMatch = expoVersion.match(/~?(\d+)\./);
      if (versionMatch) sdkVersion = `SDK ${versionMatch[1]}`;
    }

    // Statistics (avoid heavy work for huge files)
    const totalLines = files.reduce((sum, f) => sum + countLinesSafe(String(f.content)), 0);

    const config: BuildConfig = {
      appName,
      packageName: packageName || projectData.packageName || 'nicht gesetzt',
      version: pkgVersion,
      expoVersion,
      sdkVersion,
      owner: owner || 'nicht gesetzt',
    };

    const stats: ProjectStats = {
      totalFiles: files.length,
      totalLines,
      dependencies: Object.keys(deps).length,
      devDependencies: Object.keys(devDeps).length,
      // Reuse existing fields, but broaden meaning:
      // - hasAppConfig: some Expo config source
      // - hasAppTsx: resolved entry point exists
      hasAppConfig: hasAnyAppConfig,
      hasPackageJson: !!pkgFile,
      hasAppTsx: entryCheck.ok,
    };

    const dependenciesList = Object.entries(deps)
      .map(([name, version]) => ({ name, version: String(version) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const fileGroups: Record<string, string[]> = {};
    files.forEach(file => {
      const parts = file.path.split('/');
      const dir = parts.length > 1 ? parts[0] : 'root';
      if (!fileGroups[dir]) fileGroups[dir] = [];
      fileGroups[dir].push(file.path);
    });

    const fileTree: FileTree = Object.entries(fileGroups)
      .map(([dir, list]) => [dir, list.sort((a, b) => a.localeCompare(b))] as [string, string[]])
      .sort((a, b) => a[0].localeCompare(b[0]));

    const fileTreeCounts: Record<string, number> = {};
    fileTree.forEach(([dir, list]) => {
      fileTreeCounts[dir] = list.length;
    });

    // Info message only if no errors/warnings
    if (issues.length === 0) {
      issues.push({
        type: 'info',
        message: '✓ Projekt ist bereit für den Build',
        details: 'Alle Validierungen erfolgreich',
      });
    }

    return {
      buildConfig: config,
      projectStats: stats,
      validationIssues: issues,
      dependencies: dependenciesList.slice(0, MAX_DEP_ITEMS),
      dependenciesTotal: dependenciesList.length,
      fileTree: fileTree.slice(0, MAX_DIRS).map(([dir, list]) => [dir, list.slice(0, MAX_FILES_PER_DIR)]),
      fileDirsTotal: fileTree.length,
      fileTreeCounts,
    };
  }, [isLoading, isRecoveryMode, projectData]);

  const handleExport = useCallback(() => {
    Alert.alert(
      'Projekt exportieren',
      'Möchten Sie das Projekt als ZIP-Datei exportieren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Exportieren',
          onPress: () => exportProjectAsZip(),
        },
      ]
    );
  }, [exportProjectAsZip]);

  return {
    projectData,
    isLoading,
    activeSection,
    setActiveSection,
    buildConfig: derived.buildConfig,
    projectStats: derived.projectStats,
    validationIssues: derived.validationIssues,
    dependencies: derived.dependencies,
    fileTree: derived.fileTree,
    dependenciesTotal: derived.dependenciesTotal,
    fileDirsTotal: derived.fileDirsTotal,
    fileTreeCounts: derived.fileTreeCounts,
    handleExport,
  };
}
