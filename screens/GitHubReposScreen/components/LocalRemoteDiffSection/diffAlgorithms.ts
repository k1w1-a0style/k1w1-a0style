import { theme } from "../../../../theme";
import { DiffStatus } from "./types";

export function statusGlyph(s: DiffStatus) {
  if (s === "localOnly") return "+";
  if (s === "remoteOnly") return "-";
  if (s === "modified") return "±";
  if (s === "same") return "=";
  if (s === "skipped") return "·";
  return "!";
}

export function statusColor(s: DiffStatus) {
  if (s === "localOnly") return theme.palette.success;
  if (s === "remoteOnly") return theme.palette.error;
  if (s === "modified") return theme.palette.warning;
  if (s === "error") return theme.palette.error;
  return theme.palette.text.muted;
}

export function safeSliceLines(text: string, maxLines: number) {
  const lines = String(text ?? "").split("\n");
  if (lines.length <= maxLines) return { text: lines.join("\n"), truncated: false, total: lines.length };
  return { text: lines.slice(0, maxLines).join("\n"), truncated: true, total: lines.length };
}

export function unifiedLineDiff(localText: string, remoteText: string, maxLinesOut = 600): string {
  const a = String(localText ?? "").split("\n");
  const b = String(remoteText ?? "").split("\n");

  const n = a.length;
  const m = b.length;

  if (n * m > 200_000) {
    return "(Diff Preview ist zu groß – zeige nur Local/Remote Inhalte an.)";
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m && out.length < maxLinesOut) {
    if (a[i] === b[j]) {
      out.push(`  ${a[i]}`);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push(`- ${a[i]}`);
      i++;
    } else {
      out.push(`+ ${b[j]}`);
      j++;
    }
  }
  while (i < n && out.length < maxLinesOut) out.push(`- ${a[i++]}`);
  while (j < m && out.length < maxLinesOut) out.push(`+ ${b[j++]}`);
  if (out.length >= maxLinesOut) out.push("… (gekürzt)");
  return out.join("\n");
}

export function compactUnifiedDiff(diffText: string, ctx = 3, maxOutLines = 260): string {
  const lines = String(diffText ?? "").split("\n");
  if (lines.length <= maxOutLines) return diffText;

  const keep = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i] ?? "";
    const isChange = ln.startsWith("+") || ln.startsWith("-");
    if (isChange) {
      for (let j = Math.max(0, i - ctx); j <= Math.min(lines.length - 1, i + ctx); j++) keep.add(j);
    }
    if (ln.startsWith("@@")) keep.add(i);
  }

  const out: string[] = [];
  let lastKept = -2;
  for (let i = 0; i < lines.length; i++) {
    if (!keep.has(i)) continue;
    if (i > lastKept + 1) out.push("…");
    out.push(lines[i]);
    lastKept = i;
    if (out.length >= maxOutLines) {
      out.push("… (gekürzt)");
      break;
    }
  }

  if (!out.length) {
    return `${lines.slice(0, maxOutLines).join("\n")}\n… (gekürzt)`;
  }
  return out.join("\n");
}

export function diffLineStyle(line: string) {
  if (line.startsWith("+")) return { color: theme.palette.success };
  if (line.startsWith("-")) return { color: theme.palette.error };
  if (line.startsWith("@@")) return { color: theme.palette.text.muted };
  if (line.startsWith("…")) return { color: theme.palette.text.muted };
  return { color: theme.palette.text.secondary };
}
