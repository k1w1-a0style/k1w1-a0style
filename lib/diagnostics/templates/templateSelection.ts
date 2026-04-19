// lib/diagnostics/templates/templateSelection.ts
// Template selection heuristics and "auto" resolution.


// Template selection (auto mode)
import type { ProjectFile } from "../../../shared/types/project";
export type CoreTemplateId = "base" | "navigation" | "crud" | "full";
export type TemplateId = CoreTemplateId | "auto";

export function detectCoreTemplateId(files: ProjectFile[]): CoreTemplateId {
  const paths = files.map((f) => f.path);
  const pathSet = new Set(paths);
  const hasPath = (re: RegExp) => paths.some((p) => re.test(p));

  // Strong navigation signals
  const nav =
    hasPath(/^src\/navigation\//) ||
    hasPath(/^src\/screens\/.*Screen\.tsx$/) ||
    hasPath(/^src\/screens\/navigation\//) ||
    hasPath(/^src\/routes\//) ||
    files.some((f) => /@react-navigation\//.test(f.content ?? "")) ||
    files.some((f) => /NavigationContainer/.test(f.content ?? ""));

  // CRUD-ish / "app already has a shared theme / data layer" signals
  const crud =
    pathSet.has("theme.ts") ||
    hasPath(/^src\/(services|store|data|api|db)\//) ||
    hasPath(/^src\/features\//) ||
    files.some((f) => {
      const c = f.content ?? "";
      return (
        /\bCRUD\b/i.test(c) ||
        /create\s*read\s*update\s*delete/i.test(c) ||
        /AsyncStorage/.test(c)
      );
    });

  if (nav && crud) return "full";
  if (crud) return "crud";
  if (nav) return "navigation";
  // Safe default: Full (läuft in allen Fällen und spart Auswahl-Stress)
  return "full";
}

export function resolveEffectiveTemplateId(
  templateId: TemplateId | undefined,
  _files: ProjectFile[],
): { mode: TemplateId; effective: CoreTemplateId } {
  const mode: TemplateId = templateId ?? "auto";
  // Auto-Mode soll **immer** "full" als Default nehmen.
  // (Auch wenn die Files eher nach "navigation" oder "crud" aussehen,
  //  weil "full" beides abdeckt und damit 0 Auswahl/0 Fehlklick-Drama.)
  if (mode === "auto") return { mode, effective: "full" };
  return { mode, effective: mode };
}
