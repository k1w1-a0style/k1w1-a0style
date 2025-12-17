/**
 * Retry with Backoff
 * Wiederholungslogik mit exponentiellem Backoff für API-Calls
 */

/**
 * Führt einen fetch-Request mit Retry-Logik aus
 * 
 * @param url - Die URL für den Request
 * @param options - Fetch-Optionen
 * @param maxRetries - Maximale Anzahl an Versuchen (Standard: 3)
 * @returns Response-Promise
 */
export async function fetchWithBackoff(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);

      // Bei Erfolg oder Client-Fehlern (404, 403) nicht wiederholen
      if (res.ok || res.status === 404 || res.status === 403) {
        return res;
      }

      // Bei Server-Fehlern (5xx) wiederholen, außer beim letzten Versuch
      if (res.status >= 500 && i < maxRetries - 1) {
        const delay = calculateBackoff(i);
        console.log(`[retryWithBackoff] Server error ${res.status}, retry ${i + 1}/${maxRetries} in ${delay}ms`);
        await sleep(delay);
        continue;
      }

      return res;
    } catch (e) {
      // Bei Netzwerkfehlern wiederholen, außer beim letzten Versuch
      if (i === maxRetries - 1) throw e;
      
      const delay = calculateBackoff(i);
      console.log(`[retryWithBackoff] Network error, retry ${i + 1}/${maxRetries} in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw new Error('Max retries reached');
}

/**
 * Berechnet Backoff-Delay basierend auf Versuchsnummer
 * Exponentieller Backoff: 1s, 2s, 4s, ...
 * 
 * @param attemptNumber - Die Versuchsnummer (0-basiert)
 * @returns Delay in Millisekunden
 */
function calculateBackoff(attemptNumber: number): number {
  return 1000 * Math.pow(2, attemptNumber);
}

/**
 * Promise-basierte Sleep-Funktion
 * 
 * @param ms - Wartezeit in Millisekunden
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generische Retry-Funktion für beliebige async Operationen
 * 
 * @param operation - Die auszuführende Operation
 * @param maxRetries - Maximale Anzahl an Versuchen
 * @param shouldRetry - Funktion die bestimmt ob retry sinnvoll ist
 * @returns Das Ergebnis der Operation
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  shouldRetry?: (error: any) => boolean
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      // Letzter Versuch - Error werfen
      if (i === maxRetries - 1) {
        throw error;
      }

      // Prüfen ob Retry sinnvoll ist
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      const delay = calculateBackoff(i);
      console.log(`[retryWithBackoff] Retry ${i + 1}/${maxRetries} in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw new Error('Max retries reached');
}
