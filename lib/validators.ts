/**
 * Input Validators - Sichere Validierung aller User-Inputs
 * 
 * ✅ SICHERHEIT:
 * - Verhindert Path Traversal Angriffe
 * - Verhindert Code Injection
 * - Verhindert XSS
 * - Verhindert Oversize Attacks
 * 
 * Verwendet Zod für strikte Schema-Validierung
 * 
 * @author k1w1-security-team
 * @version 1.0.0
 */

import { z } from 'zod';

// ============================================
// FILE PATH VALIDATION
// ============================================

/**
 * Sichere Validierung von Dateipfaden
 * 
 * Erlaubt: a-z, A-Z, 0-9, _, -, /, .
 * Verbietet: .., absolute Pfade, Sonderzeichen
 */
export const FilePathSchema = z.string()
  .min(1, 'Dateipfad darf nicht leer sein')
  .max(255, 'Dateipfad zu lang (max 255 Zeichen)')
  .regex(
    /^[a-zA-Z0-9_\-\/\.]+$/,
    'Ungültige Zeichen im Dateipfad. Erlaubt: a-z A-Z 0-9 _ - / .'
  )
  .refine(
    (path) => !path.includes('..'),
    'Path Traversal nicht erlaubt (..)' 
  )
  .refine(
    (path) => !path.startsWith('/'),
    'Absolute Pfade nicht erlaubt'
  )
  .refine(
    (path) => !path.startsWith('./'),
    'Relative Pfade sollten ohne ./ beginnen'
  )
  .refine(
    (path) => !path.endsWith('/'),
    'Pfad darf nicht mit / enden'
  )
  .refine(
    (path) => path.split('/').every(part => part.length > 0),
    'Leere Pfad-Segmente nicht erlaubt'
  );

/**
 * Helper-Funktion für einfache Path-Validierung
 */
export function validateFilePath(path: string): {
  valid: boolean;
  errors: string[];
  normalized?: string;
} {
  try {
    const validated = FilePathSchema.parse(path);
    return {
      valid: true,
      errors: [],
      normalized: validated
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => e.message)
      };
    }
    return {
      valid: false,
      errors: ['Unbekannter Validierungsfehler']
    };
  }
}

// ============================================
// FILE CONTENT VALIDATION
// ============================================

/**
 * Maximale Dateigröße: 10MB
 * Verhindert Memory-Exhaustion-Angriffe
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const FileContentSchema = z.string()
  .max(MAX_FILE_SIZE, `Datei zu groß (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)`);

/**
 * Helper-Funktion für File-Content-Validierung
 */
export function validateFileContent(content: string): {
  valid: boolean;
  error?: string;
  sizeBytes: number;
  sizeMB: number;
} {
  const sizeBytes = new Blob([content]).size;
  const sizeMB = sizeBytes / (1024 * 1024);
  
  try {
    FileContentSchema.parse(content);
    return {
      valid: true,
      sizeBytes,
      sizeMB: Math.round(sizeMB * 100) / 100
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: error.errors[0].message,
        sizeBytes,
        sizeMB: Math.round(sizeMB * 100) / 100
      };
    }
    return {
      valid: false,
      error: 'Unbekannter Validierungsfehler',
      sizeBytes,
      sizeMB
    };
  }
}

// ============================================
// GITHUB REPO VALIDATION
// ============================================

/**
 * Validiert GitHub Repository Format: owner/repo
 */
export const GitHubRepoSchema = z.string()
  .min(3, 'Repository-Name zu kurz')
  .max(100, 'Repository-Name zu lang')
  .regex(
    /^[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+$/,
    'Ungültiges Repository-Format. Erwartet: owner/repo'
  );

/**
 * Helper-Funktion für GitHub Repo Validierung
 */
export function validateGitHubRepo(repo: string): {
  valid: boolean;
  error?: string;
  owner?: string;
  name?: string;
} {
  try {
    const validated = GitHubRepoSchema.parse(repo);
    const [owner, name] = validated.split('/');
    return {
      valid: true,
      owner,
      name
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: error.errors[0].message
      };
    }
    return {
      valid: false,
      error: 'Unbekannter Validierungsfehler'
    };
  }
}

// ============================================
// CHAT INPUT VALIDATION
// ============================================

/**
 * Validiert Chat-Nachrichten mit umfassendem XSS-Schutz
 * - Max 10.000 Zeichen pro Nachricht
 * - Keine HTML-Tags (XSS-Schutz)
 * - Keine Event-Handler (XSS-Schutz)
 * - Keine JavaScript-Protokolle (XSS-Schutz)
 */
export const ChatInputSchema = z.string()
  .min(1, 'Nachricht darf nicht leer sein')
  .max(10000, 'Nachricht zu lang (max 10.000 Zeichen)')
  // Script-Tags
  .refine(
    (text) => !/<script[^>]*>.*?<\/script>/gi.test(text),
    'Script-Tags nicht erlaubt'
  )
  // iFrame-Tags
  .refine(
    (text) => !/<iframe[^>]*>.*?<\/iframe>/gi.test(text),
    'iFrame-Tags nicht erlaubt'
  )
  // Object/Embed-Tags
  .refine(
    (text) => !/<(object|embed|applet)[^>]*>/gi.test(text),
    'Object/Embed/Applet-Tags nicht erlaubt'
  )
  // Event-Handler (onload, onerror, onclick, etc.)
  .refine(
    (text) => !/\bon\w+\s*=/gi.test(text),
    'Event-Handler nicht erlaubt (onload, onerror, onclick, etc.)'
  )
  // JavaScript-Protokolle
  .refine(
    (text) => !/javascript:/gi.test(text),
    'JavaScript-Protokoll nicht erlaubt'
  )
  // Data-URLs mit HTML/Script
  .refine(
    (text) => !/data:text\/html/gi.test(text),
    'HTML Data-URLs nicht erlaubt'
  )
  // SVG mit Script
  .refine(
    (text) => !/<svg[^>]*>.*?<script/gi.test(text),
    'SVG mit Script nicht erlaubt'
  )
  // Meta-Refresh (kann für Phishing genutzt werden)
  .refine(
    (text) => !/<meta[^>]*http-equiv\s*=\s*["']?refresh/gi.test(text),
    'Meta-Refresh nicht erlaubt'
  )
  // Base-Tag (kann Relative URLs umleiten)
  .refine(
    (text) => !/<base[^>]*>/gi.test(text),
    'Base-Tag nicht erlaubt'
  )
  // Form-Tags (können für Phishing genutzt werden)
  .refine(
    (text) => !/<form[^>]*>/gi.test(text),
    'Form-Tags nicht erlaubt'
  );

/**
 * Helper-Funktion für Chat Input Validierung
 */
export function validateChatInput(input: string): {
  valid: boolean;
  error?: string;
  sanitized?: string;
} {
  try {
    const validated = ChatInputSchema.parse(input);
    return {
      valid: true,
      sanitized: validated
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: error.errors[0].message
      };
    }
    return {
      valid: false,
      error: 'Unbekannter Validierungsfehler'
    };
  }
}

// ============================================
// PROJECT NAME VALIDATION
// ============================================

/**
 * Validiert Projektnamen
 */
export const ProjectNameSchema = z.string()
  .min(1, 'Projektname darf nicht leer sein')
  .max(100, 'Projektname zu lang (max 100 Zeichen)')
  .regex(
    /^[a-zA-Z0-9äöüÄÖÜß\s_\-\.]+$/,
    'Ungültige Zeichen im Projektnamen'
  );

// ============================================
// PACKAGE NAME VALIDATION
// ============================================

/**
 * Validiert Package-Namen (com.company.app)
 */
export const PackageNameSchema = z.string()
  .min(3, 'Package-Name zu kurz')
  .max(100, 'Package-Name zu lang')
  .regex(
    /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/,
    'Ungültiges Package-Format. Erwartet: com.company.app'
  );

// ============================================
// ZIP IMPORT VALIDATION
// ============================================

/**
 * Maximale Anzahl Dateien in ZIP
 * Verhindert ZIP-Bomb-Angriffe
 */
export const MAX_FILES_IN_ZIP = 1000;

/**
 * Validiert ZIP-Import-Operationen
 */
export function validateZipImport(files: Array<{ path: string; content: string }>): {
  valid: boolean;
  errors: string[];
  validFiles: Array<{ path: string; content: string }>;
  invalidFiles: Array<{ path: string; reason: string }>;
} {
  const errors: string[] = [];
  const validFiles: Array<{ path: string; content: string }> = [];
  const invalidFiles: Array<{ path: string; reason: string }> = [];
  
  // Check file count
  if (files.length > MAX_FILES_IN_ZIP) {
    errors.push(
      `Zu viele Dateien im ZIP (${files.length}). ` +
      `Maximum: ${MAX_FILES_IN_ZIP}`
    );
  }
  
  // Validate each file
  files.forEach(file => {
    // Validate path
    const pathValidation = validateFilePath(file.path);
    if (!pathValidation.valid) {
      invalidFiles.push({
        path: file.path,
        reason: pathValidation.errors.join(', ')
      });
      return;
    }
    
    // Validate content size
    const contentValidation = validateFileContent(file.content);
    if (!contentValidation.valid) {
      invalidFiles.push({
        path: file.path,
        reason: contentValidation.error || 'Content validation failed'
      });
      return;
    }
    
    validFiles.push({
      path: pathValidation.normalized || file.path,
      content: file.content
    });
  });
  
  return {
    valid: errors.length === 0 && invalidFiles.length === 0,
    errors,
    validFiles,
    invalidFiles
  };
}

// ============================================
// XSS SANITIZATION
// ============================================

/**
 * Escaped HTML-Entities zur sicheren Anzeige von User-Input
 * 
 * ✅ SICHERHEIT: Verhindert XSS durch Escaping
 * 
 * @param unsafe - Unsicherer String
 * @returns Escaped String
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Erweiterte XSS-Sanitization mit zusätzlichen Checks
 * 
 * @param input - User-Input
 * @returns Sanitized String
 */
export function sanitizeForDisplay(input: string): string {
  // 1. Escape HTML
  let sanitized = escapeHtml(input);
  
  // 2. Entferne NULL-Bytes
  sanitized = sanitized.replace(/\x00/g, '');
  
  // 3. Normalisiere Whitespace (verhindert Unicode-basierte Angriffe)
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  return sanitized;
}

// ============================================
// EXPORTS
// ============================================

export const Validators = {
  filePath: validateFilePath,
  fileContent: validateFileContent,
  githubRepo: validateGitHubRepo,
  chatInput: validateChatInput,
  zipImport: validateZipImport,
  escapeHtml,
  sanitizeForDisplay,
  
  // Schemas für direkte Nutzung
  schemas: {
    FilePath: FilePathSchema,
    FileContent: FileContentSchema,
    GitHubRepo: GitHubRepoSchema,
    ChatInput: ChatInputSchema,
    ProjectName: ProjectNameSchema,
    PackageName: PackageNameSchema,
  },
  
  // Konstanten
  constants: {
    MAX_FILE_SIZE,
    MAX_FILES_IN_ZIP,
  }
};

export default Validators;
