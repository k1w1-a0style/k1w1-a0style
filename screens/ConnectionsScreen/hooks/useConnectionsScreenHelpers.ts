export type { ExpoProjectResponse, PersistableEntry, StorageLike } from "./useConnectionsScreenHelpers/types";

export {
  parseExpoProjectResponse,
  hasExpoProject,
  resolveEasProjectVerification,
  deriveSupabaseRefFromUrl,
} from "./useConnectionsScreenHelpers/parsing";

export {
  isPersistedEasState,
  resolvePersistedEasState,
  resolveEasTestPrecheck,
  resolveEasLinkWorkflowStartMessage,
  resolveEasLinkPostStartState,
  resolveRepoSelectionPersistence,
  resolveEasStatusPersistence,
  resolveEasProjectIdPersistenceAction,
  resolveEasLinkWorkflowTriggerInputs,
  resolveEasLaunchPlan,
} from "./useConnectionsScreenHelpers/eas";

export type { EasLaunchPlan } from "./useConnectionsScreenHelpers/eas";

export {
  buildRepoOkLine,
  resolveConnectionsStatusFlags,
  resolveMissingConnectionRequirements,
} from "./useConnectionsScreenHelpers/status";

export {
  resolveConnectionsAlertNotice,
  resolveEasWorkflowSelectionPrecheck,
  resolveEasWorkflowLaunchSelection,
  resolveConnectionsActionAlert,
} from "./useConnectionsScreenHelpers/notices";

export type {
  ConnectionsAlertNoticeKey,
  EasWorkflowSelectionPrecheckResult,
  EasWorkflowLaunchSelectionResult,
} from "./useConnectionsScreenHelpers/notices";

export type { ConnectionsSavePlan } from "./useConnectionsScreenHelpers/savePlan";
export { resolveConnectionsSavePlan } from "./useConnectionsScreenHelpers/savePlan";

export {
  resolveGitHubConnectionPersistence,
  resolveExpoConnectionPersistence,
  resolveSupabaseConnectionPersistence,
  runStorageMultiOpWithFallback,
  persistEntriesWithFallback,
  removeEntriesWithFallback,
  applyPersistenceDelta,
} from "./useConnectionsScreenHelpers/persistence";
