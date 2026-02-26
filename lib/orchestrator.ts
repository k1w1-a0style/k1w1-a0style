// lib/orchestrator.ts
// REFACTORED → see ./orchestrator/ folder
export {
  runOrchestrator,
  runValidatorOrchestrator,
  parseFilesFromText,
} from "./orchestrator/index";
export type { LlmMessage, OrchestratorResult } from "./orchestrator/types";
