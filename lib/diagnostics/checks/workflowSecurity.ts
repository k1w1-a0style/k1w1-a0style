// Auto-extracted from lib/diagnostics/preflightChecks.ts
import type { ProjectFile } from "../../../shared/types/project";
import type { PreflightCheck } from "../preflightTypes";
import {
  normalizePath, byPath, has, getText, ok, mkFix, mkJsonFix,
  existsAny, parseJson, statusBySeverity, ensureEndsWithNewline,
  normalizeGitignoreEntry, gitignoreAppendMissing, npmrcLockfileSetting,
} from "../preflightHelpers";

const GH_EXPR_REF_RE =
  /^\$\{\{\s*(secrets|env|vars|inputs)\.[A-Za-z0-9_]+\s*\}\}$/i;
const SHELL_ENV_REF_RE = /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/;

// JWT-like AND generic secret-like tokens (long, base64-ish / urlsafe-ish)
const JWT_LIKE_RE =
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/;
const GENERIC_SECRET_RE = /^[A-Za-z0-9._-]{40,}$/;

function stripInlineYamlComment(value: string): string {
  const v = value.trim();
  if (!v) return v;
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v;
  }
  return v.replace(/\s+#.*$/, "").trim();
}

function unquoteYamlScalar(value: string): string {
  const v = value.trim();
  return v.replace(/^["']|["']$/g, "");
}

function scanWorkflowServiceRoleUsage(text: string): {
  leaks: string[];
  fixed?: string;
} {
  const lines = (text ?? "").split(/\r?\n/);
  const outLines = [...lines];
  const leaks: string[] = [];

  // single-line: KEY: VALUE
  const assignRe =
    /^([\t -]*)?([A-Za-z0-9_]*SERVICE_ROLE[A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/i;

  // block scalar start: KEY: | / KEY: >
  const blockStartRe =
    /^([\t -]*)?([A-Za-z0-9_]*SERVICE_ROLE[A-Za-z0-9_]*)\s*:\s*([|>])\s*$/i;

  const looksSecret = (raw: string) => {
    const v = unquoteYamlScalar(stripInlineYamlComment(raw)).trim();
    if (!v) return false;
    if (GH_EXPR_REF_RE.test(v) || SHELL_ENV_REF_RE.test(v)) return false;
    return JWT_LIKE_RE.test(v) || (GENERIC_SECRET_RE.test(v) && !/\s/.test(v));
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // block scalar case (cannot safely auto-fix multi-line content)
    const bm = raw.match(blockStartRe);
    if (bm) {
      const key = bm[2] ?? "";
      // scan subsequent indented lines until indentation drops
      const baseIndent = (bm[1] ?? "").length;
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j] ?? "";
        const indent = l.match(/^(\s*)/)?.[1]?.length ?? 0;
        if (l.trim() && indent <= baseIndent) break;
        if (looksSecret(l)) {
          leaks.push(`${key} (block, near line ${i + 1})`);
          break;
        }
      }
      continue;
    }

    const m = raw.match(assignRe);
    if (!m) continue;

    const indent = m[1] ?? "";
    const key = m[2] ?? "";
    const valueRaw = m[3] ?? "";
    if (!looksSecret(valueRaw)) continue;

    leaks.push(`${key} (line ${i + 1})`);
    const normalized = unquoteYamlScalar(stripInlineYamlComment(valueRaw)).trim();
    const isQuoted = /^\s*["']/.test(valueRaw.trim());
    const replacementExpr = "${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}";
    if (/^SUPABASE_SERVICE_ROLE_KEY$/i.test(key) && normalized !== replacementExpr) {
      const replacementValue = isQuoted ? `"${replacementExpr}"` : replacementExpr;
      outLines[i] = `${indent}${key}: ${replacementValue}`;
    }
}

  const fixed = outLines.join("\n");
  const changed = fixed !== (text ?? "");
  return { leaks, fixed: changed ? fixed : undefined };
}

export const checkWorkflowServiceRoleKeyLeak: PreflightCheck = {
  id: "security-workflow-service-role-key",
  title: "Security: Service Role Key Leak in Workflows",
  severity: "high",
  run(files) {
    const m = byPath(files);
    const workflowFiles = files
      .map((f) => normalizePath(f.path))
      .filter((p) => /^(?:\.github\/workflows\/).+\.(yml|yaml)$/i.test(p));

    if (!workflowFiles.length) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const details: string[] = [];
    const fixes: Array<{ path: string; content: string }> = [];

    for (const p of workflowFiles) {
      const f = m.get(p);
      if (!f) continue;

      const scan = scanWorkflowServiceRoleUsage(f.content ?? "");
      if (!scan.leaks.length) continue;

      details.push(`${p}: ${scan.leaks.join(", ")}`);
      details.push(`${p}: Manual: Schlüssel rotieren und auf secrets.SUPABASE_SERVICE_ROLE_KEY umstellen.`);
      if (scan.fixed) fixes.push({ path: p, content: scan.fixed });
    }

    if (!details.length) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message:
        "Möglicher hardcoded Supabase Service Role Key in GitHub Workflows gefunden. Nutze GitHub Secrets (secrets.*) statt Klartext.",
      details,
      fix: fixes.length
        ? {
            patch: mkFix(
              fixes,
              [],
              "Service Role Key(s) in GitHub Workflows auf secrets.* umstellen",
            ),
          }
        : undefined,
    };
  },
};



export const checkWorkflowYamlNameColonQuoting: PreflightCheck = {
  id: "workflow-yaml-name-colon-quoting",
  title: "Workflow YAML: quote names containing ': '",
  severity: "critical",
  run(files) {
    const fileMap = byPath(files);
    const workflowFiles = files.filter(
      (f) =>
        f.path.startsWith(".github/workflows/") &&
        (f.path.endsWith(".yml") || f.path.endsWith(".yaml")),
    );

    if (workflowFiles.length === 0) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        message: "Keine Workflow-Dateien gefunden.",
      });
    }

    const stepNameRe = /^(\s*-\s*name:\s*)(.+?)\s*$/;
    const workflowNameRe = /^(\s*name:\s*)(.+?)\s*$/;

    let touchedFiles = 0;
    let touchedLines = 0;

    const upserts: Array<{ path: string; content: string }> = [];

    for (const wf of workflowFiles) {
      // fileMap is a Map created by byPath(files)
      const original = fileMap.get(wf.path)?.content ?? "";
      if (!original.trim()) continue;

      const lines = original.split(/\r?\n/);
      let changed = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const stepMatch = line.match(stepNameRe);
        const nameMatch = stepMatch ? null : line.match(workflowNameRe);

        const match = stepMatch ?? nameMatch;
        if (!match) continue;

        const prefix = match[1];
        const rawValue = match[2].trim();

        // Already quoted => fine
        if (rawValue.startsWith("'") || rawValue.startsWith("\"")) continue;

        // YAML pitfall: plain scalars containing ": " can be parsed unexpectedly.
        if (!rawValue.includes(": ")) continue;

        const quoted = JSON.stringify(rawValue);
        const nextLine = `${prefix}${quoted}`;

        if (nextLine !== line) {
          lines[i] = nextLine;
          changed = true;
          touchedLines++;
        }
      }

      if (changed) {
        touchedFiles++;
        upserts.push({ path: wf.path, content: lines.join("\n") });
      }
    }

    if (touchedFiles === 0) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        message: "Keine kritischen YAML-Fallen gefunden.",
      });
    }

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message:
        `Gefunden: ${touchedLines} unquoted name-Werte mit ': ' in ${touchedFiles} Workflow-Datei(en). ` +
        "Das kann YAML/Actions kaputt parsen (Build startet dann nicht).",
      fix: {
        label: "Auto-Fix: Quote Workflow 'name' und step 'name' Werte",
        patch: mkFix(upserts, [], "Quote Workflow 'name' und step 'name' Werte"),
      },
    };
  },
};


