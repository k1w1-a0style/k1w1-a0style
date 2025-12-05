/**
 * Exponential Backoff Retry-Strategie
 * 
 * ✅ BEST PRACTICE: Verhindert Server-Überlastung bei Fehlern
 * 
 * Features:
 * - Exponential Backoff mit Jitter
 * - Konfigurierbare Retry-Anzahl
 * - Selektive Retry-Logik (nur bei bestimmten Fehlern)
 * - Timeout-Support
 * 
 * @author k1w1-team
 * @version 1.0.0
 */

export interface RetryOptions {
  /**
   * Maximale Anzahl Retries (default: 3)
   */
  maxRetries?: number;
  
  /**
   * Basis-Delay in Millisekunden (default: 1000)
   */
  baseDelay?: number;
  
  /**
   * Maximaler Delay in Millisekunden (default: 30000)
   */
  maxDelay?: number;
  
  /**
   * Exponential-Faktor (default: 2)
   */
  factor?: number;
  
  /**
   * Jitter-Faktor 0-1 (default: 0.1 = 10% Jitter)
   */
  jitter?: number;
  
  /**
   * Timeout pro Versuch in Millisekunden (optional)
   */
  timeout?: number;
  
  /**
   * Callback bei jedem Retry
   */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  
  /**
   * Prüft ob ein Fehler retry-bar ist (default: alle Fehler)
   */
  shouldRetry?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

/**
 * Standard-Retry-Logik: Nur bei Netzwerk- und Server-Fehlern
 */
export function defaultShouldRetry(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Retry bei Netzwerkfehlern
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout')
  ) {
    return true;
  }
  
  // Retry bei Server-Fehlern (5xx)
  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  ) {
    return true;
  }
  
  // Retry bei Rate Limits (429)
  if (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return true;
  }
  
  // KEIN Retry bei Client-Fehlern (4xx außer 429)
  if (
    message.includes('400') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('404')
  ) {
    return false;
  }
  
  // Default: Retry
  return true;
}

/**
 * Berechnet Delay mit Exponential Backoff und Jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  factor: number,
  jitter: number
): number {
  // Exponential: baseDelay * (factor ^ attempt)
  const exponential = baseDelay * Math.pow(factor, attempt);
  
  // Cap bei maxDelay
  const capped = Math.min(exponential, maxDelay);
  
  // Jitter: ±jitter% zufällige Variation
  const jitterAmount = capped * jitter;
  const jitterOffset = (Math.random() * 2 - 1) * jitterAmount;
  
  return Math.max(0, capped + jitterOffset);
}

/**
 * Führt eine Funktion mit Exponential Backoff Retry aus
 * 
 * @param fn - Async-Funktion die ausgeführt werden soll
 * @param options - Retry-Optionen
 * @returns Promise mit Ergebnis
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    jitter = 0.1,
    timeout,
    onRetry,
    shouldRetry = defaultShouldRetry,
  } = options;
  
  const startTime = Date.now();
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Timeout-Wrapper falls konfiguriert
      if (timeout) {
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout nach ${timeout}ms`)),
              timeout
            )
          ),
        ]);
        return result;
      } else {
        return await fn();
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Letzter Versuch? Fehler werfen
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Retry-Logik prüfen
      if (!shouldRetry(lastError)) {
        console.log(
          `[Retry] Fehler nicht retry-bar, breche ab: ${lastError.message}`
        );
        throw lastError;
      }
      
      // Delay berechnen
      const delay = calculateDelay(attempt, baseDelay, maxDelay, factor, jitter);
      
      console.log(
        `[Retry] Versuch ${attempt + 1}/${maxRetries} fehlgeschlagen: ${
          lastError.message
        }. Retry in ${Math.round(delay)}ms...`
      );
      
      // Callback
      onRetry?.(attempt + 1, lastError, delay);
      
      // Warten
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  // Sollte nie erreicht werden, aber TypeScript braucht es
  throw lastError || new Error('Retry failed');
}

/**
 * Fetch-Wrapper mit Exponential Backoff
 * 
 * @param url - URL
 * @param options - Fetch-Options
 * @param retryOptions - Retry-Options
 * @returns Response
 */
export async function fetchWithBackoff(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return retryWithBackoff(async () => {
    const response = await fetch(url, options);
    
    // Bei HTTP-Fehlern werfen (außer sie sind retry-bar)
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      throw error;
    }
    
    return response;
  }, retryOptions);
}

/**
 * Batch-Retry: Führt mehrere Operationen parallel mit Retry aus
 * 
 * @param operations - Array von Async-Funktionen
 * @param options - Retry-Options
 * @returns Array von Ergebnissen
 */
export async function retryBatch<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<RetryResult<T>>> {
  const results = await Promise.allSettled(
    operations.map(async (op) => {
      const startTime = Date.now();
      let attempts = 0;
      
      try {
        const data = await retryWithBackoff(
          async () => {
            attempts++;
            return await op();
          },
          options
        );
        
        return {
          success: true,
          data,
          attempts,
          totalTime: Date.now() - startTime,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          attempts,
          totalTime: Date.now() - startTime,
        };
      }
    })
  );
  
  return results.map((result) =>
    result.status === 'fulfilled' ? result.value : result.reason
  );
}
