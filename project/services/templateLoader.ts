// project/services/templateLoader.ts
// Extracted from contexts/ProjectContext.tsx to keep ProjectContext slimmer.
// No behavioral changes intended.

import type { CoreTemplateId, ProjectFile, TemplateId } from '../../shared/types/project';
import { runTemplateHardChecklist } from '../../lib/templateChecklist';

export const loadTemplateFromFile = async (templateId: TemplateId = "base"): Promise<ProjectFile[]> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const template =
      templateId === "navigation"
        ? require("../../templates/expo-sdk54-navigation.json")
        : templateId === "crud"
          ? require("../../templates/expo-sdk54-crud.json")
          : templateId === "full"
            ? require("../../templates/expo-sdk54-full.json")
            : require("../../templates/expo-sdk54-base.json");
    if (!Array.isArray(template) || template.length === 0) {
      throw new Error("Template ist ungültig");
    }
    const mapped = template.map((file: any) => ({
      ...file,
      content:
        typeof file.content === "string"
          ? file.content
          : JSON.stringify(file.content ?? "", null, 2),
    })) as ProjectFile[];

    // ✅ Harte Template-Checkliste (Autofix aktiv): verhindert "halbkaputte" New-Projects
    const firstPass = runTemplateHardChecklist(mapped, { autofix: true });
    const secondPass = runTemplateHardChecklist(firstPass.files, { autofix: false });

    if (!secondPass.report.ok) {
      const issues = secondPass.report.issues
        .map((i) => `- [${i.severity}] ${i.file ?? "(global)"}: ${i.reason}${i.fix ? ` → FIX: ${i.fix}` : ""}`)
        .join("\n");

      // Wir lassen das Projekt trotzdem entstehen (autofix hat schon viel repariert),
      // aber legen einen Report ab, damit du sofort siehst, was noch fehlt.
      const reportFile: ProjectFile = {
        path: "TEMPLATE_CHECKLIST_REPORT.md",
        content: `# Template Checklist Report\n\n${secondPass.report.summary}\n\n${issues}\n`,
      };

      return [reportFile, ...firstPass.files];
    }

    return firstPass.files;
  } catch (error) {
    console.error("X Template Fehler:", error);
    return [{ path: "README.md", content: "# Template Fehler" }];
  }
};

export const TEMPLATE_CATALOG: Record<CoreTemplateId, { id: CoreTemplateId; label: string; description: string; files: any[] }> = {
  base: {
    id: "base",
    label: "Base (Blank)",
    description: "Expo SDK 54 blank scaffold (Android-only) with EAS profiles (dev/preview/prod).",
    files: require("../../templates/expo-sdk54-base.json"),
  },
  navigation: {
    id: "navigation",
    label: "Navigation",
    description: "Blank + React Navigation stack + basic screens (Android-only).",
    files: require("../../templates/expo-sdk54-navigation.json"),
  },
  crud: {
    id: "crud",
    label: "CRUD",
    description: "Blank + simple CRUD sample + storage (Android-only).",
    files: require("../../templates/expo-sdk54-crud.json"),
  },
  full: {
    id: "full",
    label: "Full",
    description: "Blank + React Navigation + CRUD sample (Android-only).",
    files: require("../../templates/expo-sdk54-full.json"),
  },
};
