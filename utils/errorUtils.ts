// utils/errorUtils.ts
// Zentrales Error-Handling für die App

export type AppErrorSeverity = 'info' | 'warn' | 'error' | 'fatal';

export type AppError = {
  code: string; // z.B. 'NETWORK_TIMEOUT', 'SUPABASE_UNAUTHORIZED'
  message: string;
  severity?: AppErrorSeverity;
  meta?: Record<string, unknown>;
  originalError?: unknown;
};

/**
 * Hilfsfunktion, um aus beliebigen Fehlern einen AppError zu machen.
 */
export const toAppError = (
  error: unknown,
  fallback: Partial<AppError> = {},
): AppError => {
  if (isAppError(error)) {
    return error;
  }

  const base: AppError = {
    code: fallback.code || 'UNKNOWN_ERROR',
    message:
      fallback.message ||
      (error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Unbekannter Fehler'),
    severity: fallback.severity || 'error',
    meta: fallback.meta || {},
  };

  return {
    ...base,
    originalError: error,
  };
};

/**
 * Type Guard: Prüft, ob ein Wert bereits ein AppError ist.
 */
export const isAppError = (value: unknown): value is AppError => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as any).code === 'string'
  );
};

/**
 * Liefert eine kurze, nutzerfreundliche Fehlermeldung für UI / Alerts.
 */
export const getUserFriendlyMessage = (
  error: unknown,
  fallbackMessage = 'Es ist ein unerwarteter Fehler aufgetreten.',
): string => {
  if (!error) return fallbackMessage;

  if (isAppError(error)) {
    return error.message || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  if (typeof error === 'string') {
    return error;
  }

  return fallbackMessage;
};

/**
 * Konsistentes Logging für Fehler.
 * In Zukunft kannst du das z.B. an Sentry, Supabase-Logs etc. anschließen.
 */
export const logAppError = (error: unknown, context?: string): void => {
  const appError = toAppError(error);

  const payload = {
    code: appError.code,
    message: appError.message,
    severity: appError.severity,
    meta: appError.meta,
    context,
  };

  // Aktuell: simples console.log – kann später ersetzt werden
  // eslint-disable-next-line no-console
  console.log('[AppError]', JSON.stringify(payload));
};

/**
 * Helper, um async-Operationen sicher auszuführen.
 * Gibt entweder den Wert zurück oder null, wenn ein Fehler auftritt.
 */
export const safeAsync = async <T>(
  fn: () => Promise<T>,
  opts?: {
    onError?: (error: AppError) => void;
    fallback?: Partial<AppError>;
  },
): Promise<T | null> => {
  try {
    return await fn();
  } catch (err) {
    const appError = toAppError(err, opts?.fallback);
    logAppError(appError);
    if (opts?.onError) {
      opts.onError(appError);
    }
    return null;
  }
};
