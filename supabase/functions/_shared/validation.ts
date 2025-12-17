// supabase/functions/_shared/validation.ts
// ✅ SEC-011: Supabase Function Input Validation

/**
 * Input Validation für Supabase Edge Functions
 * Verhindert:
 * - Injection Attacks
 * - Oversized Payloads
 * - Invalid Data Types
 */

// Maximale Größen
const MAX_REPO_LENGTH = 100;
const MAX_BUILD_PROFILE_LENGTH = 50;
const MAX_STRING_LENGTH = 500;
const MAX_JOB_ID = 2147483647; // PostgreSQL INT max

/**
 * Validiert GitHub Repository Format (owner/repo)
 */
export function validateGitHubRepo(repo: unknown): {
  valid: boolean;
  value?: string;
  error?: string;
} {
  if (typeof repo !== 'string') {
    return { valid: false, error: 'githubRepo must be a string' };
  }
  
  if (repo.length === 0) {
    return { valid: false, error: 'githubRepo cannot be empty' };
  }
  
  if (repo.length > MAX_REPO_LENGTH) {
    return { valid: false, error: `githubRepo too long (max ${MAX_REPO_LENGTH} chars)` };
  }
  
  // Format: owner/repo (nur alphanumerisch, Unterstriche, Bindestriche)
  const repoRegex = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;
  if (!repoRegex.test(repo)) {
    return { 
      valid: false, 
      error: 'Invalid githubRepo format. Expected: owner/repo' 
    };
  }
  
  // Verhindere Path Traversal
  if (repo.includes('..') || repo.includes('//')) {
    return { valid: false, error: 'Invalid characters in githubRepo' };
  }
  
  return { valid: true, value: repo };
}

/**
 * Validiert Build Profile
 */
export function validateBuildProfile(profile: unknown): {
  valid: boolean;
  value?: string;
  error?: string;
} {
  if (profile === undefined || profile === null) {
    // Default: 'preview'
    return { valid: true, value: 'preview' };
  }
  
  if (typeof profile !== 'string') {
    return { valid: false, error: 'buildProfile must be a string' };
  }
  
  if (profile.length > MAX_BUILD_PROFILE_LENGTH) {
    return { valid: false, error: `buildProfile too long (max ${MAX_BUILD_PROFILE_LENGTH} chars)` };
  }
  
  // Erlaubte Profile
  const allowedProfiles = ['development', 'preview', 'production'];
  if (!allowedProfiles.includes(profile)) {
    return { 
      valid: false, 
      error: `Invalid buildProfile. Allowed: ${allowedProfiles.join(', ')}` 
    };
  }
  
  return { valid: true, value: profile };
}

/**
 * Validiert Job ID
 */
export function validateJobId(jobId: unknown): {
  valid: boolean;
  value?: number;
  error?: string;
} {
  if (jobId === undefined || jobId === null) {
    return { valid: false, error: 'jobId is required' };
  }
  
  const numericJobId = typeof jobId === 'string' ? parseInt(jobId, 10) : jobId;
  
  if (typeof numericJobId !== 'number' || isNaN(numericJobId)) {
    return { valid: false, error: 'jobId must be a number' };
  }
  
  if (!Number.isInteger(numericJobId)) {
    return { valid: false, error: 'jobId must be an integer' };
  }
  
  if (numericJobId <= 0) {
    return { valid: false, error: 'jobId must be positive' };
  }
  
  if (numericJobId > MAX_JOB_ID) {
    return { valid: false, error: 'jobId exceeds maximum value' };
  }
  
  return { valid: true, value: numericJobId };
}

/**
 * Validiert Run ID (GitHub Actions)
 */
export function validateRunId(runId: unknown): {
  valid: boolean;
  value?: number;
  error?: string;
} {
  if (runId === undefined || runId === null) {
    return { valid: true, value: undefined }; // Optional
  }
  
  const numericRunId = typeof runId === 'string' ? parseInt(runId, 10) : runId;
  
  if (typeof numericRunId !== 'number' || isNaN(numericRunId)) {
    return { valid: false, error: 'runId must be a number' };
  }
  
  if (!Number.isInteger(numericRunId)) {
    return { valid: false, error: 'runId must be an integer' };
  }
  
  if (numericRunId <= 0) {
    return { valid: false, error: 'runId must be positive' };
  }
  
  return { valid: true, value: numericRunId };
}

/**
 * Sanitized String (allgemein)
 */
export function sanitizeString(
  input: unknown,
  maxLength: number = MAX_STRING_LENGTH
): {
  valid: boolean;
  value?: string;
  error?: string;
} {
  if (input === undefined || input === null) {
    return { valid: true, value: '' };
  }
  
  if (typeof input !== 'string') {
    return { valid: false, error: 'Input must be a string' };
  }
  
  if (input.length > maxLength) {
    return { valid: false, error: `Input too long (max ${maxLength} chars)` };
  }
  
  // Basis-Sanitization: Entferne potenziell gefährliche Zeichen
  const sanitized = input
    .replace(/[<>]/g, '') // HTML Tags
    .replace(/javascript:/gi, '') // JavaScript URIs
    .replace(/on\w+=/gi, '') // Event Handler
    .trim();
  
  return { valid: true, value: sanitized };
}

/**
 * Validiert vollständigen trigger-eas-build Request Body
 */
export function validateTriggerBuildRequest(body: unknown): {
  valid: boolean;
  data?: {
    githubRepo: string;
    buildProfile: string;
    buildType?: string;
  };
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }
  
  const bodyObj = body as Record<string, unknown>;
  
  // Validate githubRepo
  const repoValidation = validateGitHubRepo(bodyObj.githubRepo);
  if (!repoValidation.valid) {
    errors.push(repoValidation.error!);
  }
  
  // Validate buildProfile
  const profileValidation = validateBuildProfile(bodyObj.buildProfile);
  if (!profileValidation.valid) {
    errors.push(profileValidation.error!);
  }
  
  // Validate buildType (optional)
  let buildType: string | undefined;
  if (bodyObj.buildType !== undefined) {
    const typeValidation = sanitizeString(bodyObj.buildType, 20);
    if (!typeValidation.valid) {
      errors.push(typeValidation.error!);
    } else {
      buildType = typeValidation.value;
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    data: {
      githubRepo: repoValidation.value!,
      buildProfile: profileValidation.value!,
      buildType,
    },
    errors: [],
  };
}

/**
 * Validiert check-eas-build Request Body
 */
export function validateCheckBuildRequest(body: unknown): {
  valid: boolean;
  data?: {
    jobId: number;
  };
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }
  
  const bodyObj = body as Record<string, unknown>;
  
  // Validate jobId
  const jobIdValidation = validateJobId(bodyObj.jobId);
  if (!jobIdValidation.valid) {
    errors.push(jobIdValidation.error!);
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    data: {
      jobId: jobIdValidation.value!,
    },
    errors: [],
  };
}
