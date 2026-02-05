import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useProject } from '../../../contexts/ProjectContext';
import type {
  BuildConfig,
  DependencyItem,
  FileTree,
  ProjectStats,
  SectionType,
  ValidationIssue,
} from '../types';

export function useAppStatusScreen() {
  const { projectData, isLoading, exportProjectAsZip } = useProject();
  const [activeSection, setActiveSection] = useState<SectionType>('overview');

  const { buildConfig, projectStats, validationIssues, dependencies, fileTree } = useMemo(() => {

    if (!projectData) {
      return {
        buildConfig: null,
        projectStats: null,
        validationIssues: [],
        dependencies: [],
        fileTree: [],
      };
    }

    const files = projectData.files || [];
    const issues: ValidationIssue[] = [];

    // Parse package.json
    const pkgFile = files.find(f => f.path === 'package.json');
    let pkgData: any = null;
    let pkgName = projectData.name || 'Unknown Project';
    let pkgVersion = '1.0.0';
    let deps: any = {};
    let devDeps: any = {};

    if (pkgFile) {
      try {
        pkgData = JSON.parse(String(pkgFile.content));
        pkgName = pkgData.name || pkgName;
        pkgVersion = pkgData.version || pkgVersion;
        deps = pkgData.dependencies || {};
        devDeps = pkgData.devDependencies || {};
      } catch (error) {
        issues.push({
          type: 'error',
          message: 'package.json ist fehlerhaft',
          details: 'JSON Parse Fehler',
        });
      }
    } else {
      issues.push({
        type: 'error',
        message: 'package.json fehlt',
        details: 'Diese Datei ist zwingend erforderlich',
      });
    }

    // Parse app.config.js
    const appConfigFile = files.find(f => f.path === 'app.config.js');
    let appName = pkgName;
    let packageName = '';
    let owner = '';
    let expoVersion = '';
    let sdkVersion = '';

    if (appConfigFile) {
      try {
        const content = String(appConfigFile.content);
        // Extract values using regex (simple parsing)
        const nameMatch = content.match(/name:\s*["']([^"']+)["']/);
        const packageMatch = content.match(/package:\s*["']([^"']+)["']/);
        const ownerMatch = content.match(/owner:\s*["']([^"']+)["']/);
        
        if (nameMatch) appName = nameMatch[1];
        if (packageMatch) packageName = packageMatch[1];
        if (ownerMatch) owner = ownerMatch[1];

        if (!packageName) {
          issues.push({
            type: 'error',
            message: 'Android Package Name fehlt',
            details: 'android.package muss in app.config.js definiert sein',
          });
        }
      } catch (error) {
        issues.push({
          type: 'warning',
          message: 'app.config.js konnte nicht gelesen werden',
        });
      }
    } else {
      issues.push({
        type: 'error',
        message: 'app.config.js fehlt',
        details: 'Diese Datei ist für den Build erforderlich',
      });
    }

    // Check for App.tsx
    const appTsxFile = files.find(f => f.path === 'App.tsx');
    if (!appTsxFile) {
      issues.push({
        type: 'error',
        message: 'App.tsx fehlt',
        details: 'Entry-Point der App fehlt',
      });
    }

    // Check for required dependencies
    if (pkgData) {
      const requiredDeps = ['expo', 'react', 'react-native'];
      requiredDeps.forEach(dep => {
        if (!deps[dep]) {
          issues.push({
            type: 'error',
            message: `Fehlende Dependency: ${dep}`,
            details: 'Diese Dependency ist erforderlich',
          });
        }
      });

      if (deps['expo']) {
        expoVersion = deps['expo'];
        // Extract SDK version from expo version
        const versionMatch = expoVersion.match(/~?(\d+)\./);
        if (versionMatch) {
          sdkVersion = `SDK ${versionMatch[1]}`;
        }
      }
    }

    // Calculate statistics
    const totalLines = files.reduce((sum, f) => {
      return sum + String(f.content).split('\n').length;
    }, 0);

    // Build config object
    const config: BuildConfig = {
      appName,
      packageName: packageName || projectData.packageName || 'nicht gesetzt',
      version: pkgVersion,
      expoVersion,
      sdkVersion: sdkVersion || 'Unknown',
      owner: owner || 'nicht gesetzt',
    };

    // Project statistics
    const stats: ProjectStats = {
      totalFiles: files.length,
      totalLines,
      dependencies: Object.keys(deps).length,
      devDependencies: Object.keys(devDeps).length,
      hasAppConfig: !!appConfigFile,
      hasPackageJson: !!pkgFile,
      hasAppTsx: !!appTsxFile,
    };

    // Dependencies list
    const dependenciesList = Object.entries(deps).map(([name, version]) => ({
      name,
      version: String(version),
    }));

    // File tree (group by directory)
    const fileGroups: { [key: string]: string[] } = {};
    files.forEach(file => {
      const parts = file.path.split('/');
      const dir = parts.length > 1 ? parts[0] : 'root';
      if (!fileGroups[dir]) fileGroups[dir] = [];
      fileGroups[dir].push(file.path);
    });

    // Add info messages
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
      dependencies: dependenciesList,
      fileTree: Object.entries(fileGroups),
    };
  }, [projectData]);

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
    buildConfig: buildConfig as BuildConfig | null,
    projectStats: projectStats as ProjectStats | null,
    validationIssues: validationIssues as ValidationIssue[],
    dependencies: dependencies as DependencyItem[],
    fileTree: fileTree as FileTree,
    handleExport,
  };
}
