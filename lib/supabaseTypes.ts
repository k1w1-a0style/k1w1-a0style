/**
 * TypeScript-Typen für Supabase Edge Functions
 * 
 * ✅ TYPENSICHERHEIT: Verhindert Runtime-Errors durch Type-Checking
 * 
 * @author k1w1-team
 * @version 1.0.0
 */

import { BuildStatus } from './buildStatusMapper';

// ============================================
// TRIGGER-EAS-BUILD
// ============================================

export interface TriggerEASBuildRequest {
  githubRepo: string;
  githubToken: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  easToken?: string;
}

export interface TriggerEASBuildResponse {
  success: boolean;
  job_id?: number;
  message?: string;
  error?: string;
  step?: string;
  hint?: string;
}

// ============================================
// CHECK-EAS-BUILD
// ============================================

export interface CheckEASBuildRequest {
  jobId: number;
  easToken?: string;
}

export interface CheckEASBuildResponse {
  ok: boolean;
  status: string; // Raw status from API
  jobId: number;
  urls?: {
    html?: string | null;
    artifacts?: string | null;
  };
  download_url?: string | null;
  error?: string;
  raw?: any;
}

// ============================================
// GITHUB-WORKFLOW-RUNS
// ============================================

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  html_url: string;
  run_number: number;
  created_at: string;
  updated_at: string;
  head_branch: string;
  head_sha: string;
}

export interface GitHubWorkflowRunsRequest {
  githubRepo: string;
  githubToken?: string;
}

export interface GitHubWorkflowRunsResponse {
  ok: boolean;
  runs: GitHubWorkflowRun[];
  error?: string;
}

// ============================================
// GITHUB-WORKFLOW-LOGS
// ============================================

export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  step?: string;
}

export interface GitHubWorkflowLogsRequest {
  githubRepo: string;
  runId: number;
  githubToken?: string;
}

export interface GitHubWorkflowLogsResponse {
  ok: boolean;
  logs: LogEntry[];
  workflowRun?: GitHubWorkflowRun;
  error?: string;
}

// ============================================
// BUILD DETAILS (Database)
// ============================================

export interface BuildDetails {
  id: number;
  github_repo: string;
  build_profile?: string;
  build_type?: string;
  status: string;
  eas_build_id?: string | null;
  github_run_id?: string | null;
  artifact_url?: string | null;
  created_at: string;
  updated_at: string;
  error_message?: string | null;
  metadata?: Record<string, any>;
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Type Guard für TriggerEASBuildResponse
 */
export function isTriggerEASBuildResponse(
  data: any
): data is TriggerEASBuildResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.success === 'boolean'
  );
}

/**
 * Type Guard für CheckEASBuildResponse
 */
export function isCheckEASBuildResponse(
  data: any
): data is CheckEASBuildResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.ok === 'boolean' &&
    typeof data.status === 'string'
  );
}

/**
 * Type Guard für GitHubWorkflowRunsResponse
 */
export function isGitHubWorkflowRunsResponse(
  data: any
): data is GitHubWorkflowRunsResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.ok === 'boolean' &&
    Array.isArray(data.runs)
  );
}

/**
 * Type Guard für GitHubWorkflowLogsResponse
 */
export function isGitHubWorkflowLogsResponse(
  data: any
): data is GitHubWorkflowLogsResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.ok === 'boolean' &&
    Array.isArray(data.logs)
  );
}

/**
 * Type Guard für BuildDetails
 */
export function isBuildDetails(data: any): data is BuildDetails {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'number' &&
    typeof data.github_repo === 'string' &&
    typeof data.status === 'string'
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validiert und parsed eine Supabase-Response
 * 
 * @param data - Raw response data
 * @param guard - Type guard function
 * @returns Typed data oder wirft Error
 */
export function validateSupabaseResponse<T>(
  data: any,
  guard: (data: any) => data is T,
  errorMessage: string = 'Invalid response format'
): T {
  if (!guard(data)) {
    console.error('[SupabaseTypes] Validation failed:', data);
    throw new Error(errorMessage);
  }
  return data;
}

/**
 * Sicherer Zugriff auf nested Properties
 */
export function safeGet<T>(
  obj: any,
  path: string,
  defaultValue: T
): T {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }
  
  return current !== undefined ? current : defaultValue;
}
