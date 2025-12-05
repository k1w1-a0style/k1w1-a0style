/**
 * Zentrale Build-Status-Mapping-Funktion
 * 
 * ✅ KONSISTENZ: Eine einzige Quelle der Wahrheit für Status-Mapping
 * 
 * Unterstützte Eingabe-Status:
 * - GitHub Actions: queued, in_progress, completed, success, failure, cancelled
 * - EAS Build: pending, building, succeeded, failed, error
 * - Supabase: pending, queued, running, building, completed, success, failed, error
 * 
 * @author k1w1-team
 * @version 1.0.0
 */

export type BuildStatus =
  | 'idle'
  | 'queued'
  | 'building'
  | 'success'
  | 'failed'
  | 'error';

/**
 * Mappt verschiedene Build-Status-Werte auf ein einheitliches Schema
 * 
 * @param rawStatus - Raw status string from API
 * @returns Normalized BuildStatus
 */
export function mapBuildStatus(rawStatus: string | undefined | null): BuildStatus {
  if (!rawStatus) return 'idle';
  
  const status = rawStatus.toString().toLowerCase().trim();
  
  // Queued/Pending States
  if (
    status === 'queued' ||
    status === 'pending' ||
    status === 'waiting' ||
    status === 'scheduled'
  ) {
    return 'queued';
  }
  
  // Building/Running States
  if (
    status === 'building' ||
    status === 'in_progress' ||
    status === 'running' ||
    status === 'in-progress'
  ) {
    return 'building';
  }
  
  // Success States
  if (
    status === 'success' ||
    status === 'completed' ||
    status === 'succeeded' ||
    status === 'finished'
  ) {
    return 'success';
  }
  
  // Failed States
  if (
    status === 'failed' ||
    status === 'failure' ||
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'aborted'
  ) {
    return 'failed';
  }
  
  // Error States
  if (
    status === 'error' ||
    status === 'errored' ||
    status === 'timeout' ||
    status === 'timed_out'
  ) {
    return 'error';
  }
  
  // Unknown -> idle
  console.warn(`[BuildStatusMapper] Unknown status: "${rawStatus}" -> mapping to "idle"`);
  return 'idle';
}

/**
 * Prüft ob ein Status final ist (Polling kann gestoppt werden)
 */
export function isFinalStatus(status: BuildStatus): boolean {
  return status === 'success' || status === 'failed' || status === 'error';
}

/**
 * Prüft ob ein Status aktiv ist (Polling sollte weiterlaufen)
 */
export function isActiveStatus(status: BuildStatus): boolean {
  return status === 'queued' || status === 'building';
}

/**
 * Gibt eine benutzerfreundliche Status-Beschreibung zurück
 */
export function getBuildStatusDescription(status: BuildStatus): string {
  switch (status) {
    case 'idle':
      return 'Kein Build aktiv';
    case 'queued':
      return 'Build wartet in Warteschlange...';
    case 'building':
      return 'Build läuft...';
    case 'success':
      return 'Build erfolgreich abgeschlossen';
    case 'failed':
      return 'Build fehlgeschlagen';
    case 'error':
      return 'Build-Fehler aufgetreten';
    default:
      return 'Unbekannter Status';
  }
}

/**
 * Gibt ein passendes Emoji für den Status zurück
 */
export function getBuildStatusEmoji(status: BuildStatus): string {
  switch (status) {
    case 'idle':
      return '⚪';
    case 'queued':
      return '⏳';
    case 'building':
      return '🔨';
    case 'success':
      return '✅';
    case 'failed':
      return '❌';
    case 'error':
      return '⚠️';
    default:
      return '❓';
  }
}
