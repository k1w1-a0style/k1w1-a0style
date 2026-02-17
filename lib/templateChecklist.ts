/**
 * @deprecated Legacy entrypoint / facade for the template hard checklist.
 * Prefer importing from: lib/diagnostics/templates
 * This file will be removed once all external callers are migrated.
 */
export type {
  CoreTemplateId,
  TemplateId,
  ChecklistSeverity,
  ChecklistItem,
  TemplateChecklistReport,
  TemplateChecklistOptions,
} from "./diagnostics/templates";

export {
  detectCoreTemplateId,
  resolveEffectiveTemplateId,
  runTemplateHardChecklist,
} from "./diagnostics/templates";
