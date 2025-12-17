/**
 * Build Status Mapper
 * Zentralisiert die BuildStatus Type Definition und Mapping-Logik
 */

/**
 * Unified BuildStatus Type
 * Wird von allen Hooks verwendet
 */
export type BuildStatus =
  | 'idle'
  | 'queued'
  | 'building'
  | 'success'
  | 'failed'
  | 'error';

/**
 * Mappt rohe Status-Strings zu unserem unified BuildStatus Type
 * Unterstützt verschiedene Formate (GitHub Actions, EAS, Supabase)
 */
export function mapBuildStatus(rawStatus: string | undefined): BuildStatus {
  const status = (rawStatus || '').toString().toLowerCase();
  
  switch (status) {
    case 'queued':
    case 'pending':
    case 'waiting':
      return 'queued';
      
    case 'building':
    case 'in_progress':
    case 'running':
      return 'building';
      
    case 'success':
    case 'completed':
    case 'succeeded':
      return 'success';
      
    case 'failed':
    case 'failure':
    case 'cancelled':
      return 'failed';
      
    case 'error':
      return 'error';
      
    default:
      return 'idle';
  }
}
