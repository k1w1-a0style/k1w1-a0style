// lib/diagnostics/templates/runHardChecklist.ts
// Extracted from lib/templateChecklist.ts (PR-6 Stage 4).
// No behavior changes intended.


import { normalizePath } from "../../validators";

import type { ChecklistItem, TemplateChecklistOptions, TemplateChecklistReport } from "./templateChecklistTypes";
import { DEFAULT_TOOLCHAIN, type Toolchain } from "./toolchain";
import { PNG_1x1_BASE64 } from "./assets";
import { REQUIRED_ASSETS_P0, REQUIRED_FILES_P0, REQUIRED_WORKFLOWS_P1 } from "./requiredFiles";
import { minimalDefaultFor, minimalAppJson, defaultEasIgnore } from "./defaults";
import { patchPackageJson } from "./patchers/packageJson";
import { patchAppJson } from "./patchers/appJson";
import { patchAppConfigJs } from "./patchers/appConfigJs";
import { patchEasJson } from "./patchers/easJson";

import type { ProjectFile } from "../../../shared/types/project";

function readProjectFileContent(file: ProjectFile): string {
  return typeof file.content === "string" ? file.content : String(file.content ?? "");
}

export function runTemplateHardChecklist(
  files: ProjectFile[],
  options: TemplateChecklistOptions = {},
): { files: ProjectFile[]; report: TemplateChecklistReport } {
  const toolchain: Toolchain = {
    ...DEFAULT_TOOLCHAIN,
    ...(options.toolchain ?? {}),
    // ensure required fields even if caller omits optional ones
    jestExpo: (options.toolchain?.jestExpo ?? DEFAULT_TOOLCHAIN.jestExpo) as string,
  };

  const issues: ChecklistItem[] = [];
  const autofix = !!options.autofix;

  const map = new Map<string, ProjectFile>();
  for (const f of files ?? []) {
    const p = normalizePath(String(f?.path ?? ""));
    if (!p) continue;
    const c = readProjectFileContent(f);
    map.set(p, { path: p, content: c });
  }

  const has = (p: string) => map.has(normalizePath(p));
  const get = (p: string) => map.get(normalizePath(p))?.content ?? "";
  const set = (p: string, content: string) => map.set(normalizePath(p), { path: normalizePath(p), content });

  // --- required root files ---
  for (const p of REQUIRED_FILES_P0) {
    if (!has(p)) {
      issues.push({
        severity: "P0",
        file: p,
        reason: `Pflichtdatei fehlt: ${p}`,
        fix: autofix ? "Wird als minimaler Default ergänzt." : "Datei im Template ergänzen.",
      });
      if (autofix) set(p, minimalDefaultFor(p));
    }
  }

  // --- required assets ---
  for (const p of REQUIRED_ASSETS_P0) {
    if (!has(p)) {
      issues.push({
        severity: "P0",
        file: p,
        reason: `Pflicht-Asset fehlt: ${p}`,
        fix: autofix ? "Wird als Base64-PNG ergänzt." : "Asset ins Template aufnehmen.",
      });
      if (autofix) set(p, `base64:${PNG_1x1_BASE64}`);
    }
  }

  // --- recommended workflows ---
  for (const p of REQUIRED_WORKFLOWS_P1) {
    if (!has(p)) {
      issues.push({
        severity: "P1",
        file: p,
        reason: `Workflow fehlt: ${p} (1-Click Build/Link kann fehlen)`,
        fix: "Workflow aus Core-Template/Repo übernehmen.",
      });
    }
  }

  // --- package.json sanity + pinned toolchain ---
  if (has("package.json")) {
    const raw = get("package.json");
    const { next, changed, parseOk, parseError, p0 } = patchPackageJson(raw, toolchain);
    if (!parseOk) {
      issues.push({
        severity: "P0",
        file: "package.json",
        reason: `package.json ist kein gültiges JSON (${parseError ?? "parse error"})`,
        fix: "package.json reparieren (valid JSON).",
      });
      if (autofix) set("package.json", next);
    } else {
      if (p0.length) issues.push(...p0);
      if (autofix && changed) set("package.json", next);
    }
  }

  // --- Expo config: prefer app.json; patch app.config.js if that's used ---
  const hasAppJson = has("app.json");
  const hasAppConfigJs = has("app.config.js");

  if (!hasAppJson && !hasAppConfigJs) {
    issues.push({
      severity: "P0",
      file: "app.json",
      reason: "Weder app.json noch app.config.js vorhanden (Expo Config fehlt).",
      fix: autofix ? "app.json wird ergänzt." : "app.json oder app.config.js hinzufügen.",
    });
    if (autofix) set("app.json", JSON.stringify(minimalAppJson(), null, 2));
  }

  if (hasAppJson) {
    const raw = get("app.json");
    const { next, changed, parseOk, parseError, p0 } = patchAppJson(raw);
    if (!parseOk) {
      issues.push({
        severity: "P0",
        file: "app.json",
        reason: `app.json ist kein gültiges JSON (${parseError ?? "parse error"})`,
        fix: "app.json reparieren (valid JSON).",
      });
      if (autofix) set("app.json", next);
    } else {
      if (p0.length) issues.push(...p0);
      if (autofix && changed) set("app.json", next);
    }
  } else if (hasAppConfigJs) {
    const raw = get("app.config.js");
    const { next, changed, p0, p1 } = patchAppConfigJs(raw, autofix);
    if (p0.length) issues.push(...p0);
    if (p1.length) issues.push(...p1);
    if (autofix && changed) set("app.config.js", next);
  }

  // --- eas.json sanity ---
  if (has("eas.json")) {
    const raw = get("eas.json");
    const { next, changed, parseOk, parseError, p0 } = patchEasJson(raw);
    if (!parseOk) {
      issues.push({
        severity: "P0",
        file: "eas.json",
        reason: `eas.json ist kein gültiges JSON (${parseError ?? "parse error"})`,
        fix: "eas.json reparieren (valid JSON).",
      });
      if (autofix) set("eas.json", next);
    } else {
      if (p0.length) issues.push(...p0);
      if (autofix && changed) set("eas.json", next);
    }
  }

  // --- ensure .easignore (optional but strongly recommended) ---
  if (!has(".easignore")) {
    issues.push({
      severity: "P2",
      file: ".easignore",
      reason: ".easignore fehlt (Uploads können unnötig groß werden / EPERM-Probleme wahrscheinlicher).",
      fix: autofix ? "Wird ergänzt." : "Datei hinzufügen.",
    });
    if (autofix) set(".easignore", defaultEasIgnore());
  }

  // --- final: build output ---
  const out: ProjectFile[] = [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
  const p0Count = issues.filter((i) => i.severity === "P0").length;
  const p1Count = issues.filter((i) => i.severity === "P1").length;
  const p2Count = issues.filter((i) => i.severity === "P2").length;

  const ok = p0Count === 0;
  const summary = `Template-Check: ${ok ? "OK" : "NICHT OK"} (P0=${p0Count}, P1=${p1Count}, P2=${p2Count})`;

  return { files: out, report: { ok, issues, summary } };
}
