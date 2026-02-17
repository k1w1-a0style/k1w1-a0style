// lib/templateChecklist.ts
// Legacy entrypoint / facade for the template hard checklist.
// The implementation lives under lib/diagnostics/templates/*.

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
