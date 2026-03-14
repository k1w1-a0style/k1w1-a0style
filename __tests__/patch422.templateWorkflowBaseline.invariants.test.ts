import fs from "fs";
import path from "path";

type TemplateEntry = { path: string; content: string };

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const normalize = (value: string) => value.replace(/\r\n/g, "\n");

const getTemplateEntry = (templatePath: string, targetPath: string) => {
  const entries = JSON.parse(read(templatePath)) as TemplateEntry[];
  return entries.find((entry) => entry.path === targetPath)?.content ?? "";
};

describe("Patch 422 template workflow baseline invariants", () => {
  const baselinePairs = [
    {
      templatePath: "templates/expo-sdk54-base.json",
      workflowPath: ".github/workflows/deploy-supabase-functions.yml",
    },
    {
      templatePath: "templates/expo-sdk54-base.json",
      workflowPath: ".github/workflows/k1w1-triggered-build.yml",
    },
    {
      templatePath: "templates/expo-sdk54-base.json",
      workflowPath: ".github/workflows/release-build.yml",
    },
    {
      templatePath: "templates/expo-sdk54-base.json",
      workflowPath: ".github/workflows/eas-build.yml",
    },
    {
      templatePath: "templates/expo-sdk54-full.json",
      workflowPath: ".github/workflows/release-build.yml",
    },
    {
      templatePath: "templates/expo-sdk54-full.json",
      workflowPath: ".github/workflows/eas-build.yml",
    },
  ] as const;

  it.each(baselinePairs)(
    "$templatePath keeps $workflowPath aligned with live hardened workflow",
    ({ templatePath, workflowPath }) => {
      const live = read(workflowPath);
      const templateWorkflow = getTemplateEntry(templatePath, workflowPath);

      expect(templateWorkflow).toBeTruthy();
      expect(normalize(templateWorkflow)).toBe(normalize(live));
    },
  );
});
