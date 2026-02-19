/**
 * Build Status Mapper
 * Zentralisiert die BuildStatus Type Definition und Mapping-Logik
 */

// Single source of truth for BuildStatus lives in shared/types/build.
// We re-export here to keep older imports working while preventing type drift.
import type { BuildStatus } from "../shared/types/build";

/**
 * @deprecated Import BuildStatus from "shared/types/build" directly.
 */
export type { BuildStatus } from "../shared/types/build";

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
