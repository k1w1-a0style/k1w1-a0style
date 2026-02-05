export type SectionType = 'overview' | 'config' | 'dependencies' | 'files' | 'validation';

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

export interface BuildConfig {
  appName: string;
  packageName: string;
  version: string;
  expoVersion: string;
  sdkVersion: string;
  owner: string;
}

export interface ProjectStats {
  totalFiles: number;
  totalLines: number;
  dependencies: number;
  devDependencies: number;
  hasAppConfig: boolean;
  hasPackageJson: boolean;
  hasAppTsx: boolean;
}

export interface DependencyItem {
  name: string;
  version: string;
}

export type FileTree = Array<[string, string[]]>;
