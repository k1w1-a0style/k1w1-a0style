import type { ProjectFile } from "../shared/types/project";
import { truncateWithMarker } from "./secretRedaction";
import { sanitizeFileContentForPrompt, sanitizeTextForLlm, PROMPT_FILE_CONTENT_LIMIT } from "./promptSanitizer";
import { estimateTokens, estimateTokensForArray } from "./tokenEstimator";

type PromptLikeMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type PromptBudgetMode = "planner" | "builder" | "validator";

export type PromptBudgetStats = {
  droppedHistoryCount: number;
  droppedFileCount: number;
  trimmedFileCount: number;
};

export type PromptBudgetResult = {
  history: PromptLikeMessage[];
  projectFiles: ProjectFile[];
  note: string | null;
  stats: PromptBudgetStats;
};

const MODE_LIMITS: Record<PromptBudgetMode, number> = {
  planner: 4_600,
  builder: 6_800,
  validator: 5_600,
};

const MODE_RESERVE: Record<PromptBudgetMode, number> = {
  planner: 900,
  builder: 1_200,
  validator: 1_400,
};

const MAX_FILES_PER_MODE: Record<PromptBudgetMode, number> = {
  planner: 18,
  builder: 24,
  validator: 16,
};

const FILE_CHAR_STEPS = [PROMPT_FILE_CONTENT_LIMIT, 4_000, 2_000, 1_200, 700, 350] as const;

function collectFocusTerms(userFocus: string): string[] {
  const lowered = String(userFocus ?? "").toLowerCase();
  const rawTokens = lowered.match(/[a-z0-9_.\/-]{3,}/g) ?? [];
  const stop = new Set([
    "und", "oder", "aber", "nicht", "mit", "ohne", "dass", "dies", "eine", "einen", "der", "die", "das",
    "den", "dem", "des", "für", "von", "auf", "ist", "sind", "bitte", "kann", "können", "soll", "sollte",
    "mach", "mache", "baue", "bauen", "weiter", "noch", "mehr", "input", "budget", "prompt", "kontext",
    "the", "and", "for", "with", "without", "from", "into", "onto", "that", "this", "these", "those",
    "please", "can", "could", "should", "would", "make", "create", "add", "update", "improve",
  ]);

  return [...new Set(rawTokens.filter((token) => !stop.has(token)).slice(0, 24))];
}

function fileRelevanceScore(file: ProjectFile, focusTerms: string[]): number {
  const path = String(file.path ?? "").toLowerCase();
  const content = String(file.content ?? "").toLowerCase();
  let score = 0;

  for (const term of focusTerms) {
    if (!term) continue;
    if (path.includes(term)) score += 8;
    if (content.includes(term)) score += 3;
  }

  if (/\b(app|screen|chat|prompt|normalizer|validator|builder|planner|flow)\b/.test(path)) score += 2;
  if (/^app\.|(^|\/)package\.json$|(^|\/)tsconfig/.test(path)) score += 1;
  return score;
}

function prioritizeFiles(files: ProjectFile[], userFocus: string): ProjectFile[] {
  const focusTerms = collectFocusTerms(userFocus);
  return [...files]
    .map((file, index) => ({ file, index, score: fileRelevanceScore(file, focusTerms) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.file.path !== b.file.path) return a.file.path.localeCompare(b.file.path);
      return a.index - b.index;
    })
    .map(({ file }) => file);
}

function tokenCostForFiles(files: ProjectFile[], provider?: string | null): number {
  return estimateTokensForArray(files.map((file) => `${file.path}\n${file.content}`), provider ?? undefined);
}

function tokenCostForHistory(history: PromptLikeMessage[], provider?: string | null): number {
  return estimateTokensForArray(history.map((msg) => `${msg.role}\n${msg.content}`), provider ?? undefined);
}

function totalPromptTokens(params: {
  history: PromptLikeMessage[];
  projectFiles: ProjectFile[];
  userContent: string;
  provider?: string | null;
  reserve: number;
  extraTexts?: string[];
}): number {
  const { history, projectFiles, userContent, provider, reserve, extraTexts = [] } = params;
  return (
    reserve +
    estimateTokens(userContent, provider ?? undefined) +
    estimateTokensForArray(extraTexts, provider ?? undefined) +
    tokenCostForHistory(history, provider) +
    tokenCostForFiles(projectFiles, provider)
  );
}

function sanitizeHistory(history: PromptLikeMessage[]): PromptLikeMessage[] {
  return history.map((message) => ({
    role: message.role,
    content: sanitizeTextForLlm(String(message.content ?? "")),
  }));
}

function sanitizeFiles(files: ProjectFile[], maxChars = PROMPT_FILE_CONTENT_LIMIT): ProjectFile[] {
  return files.map((file) => ({
    path: file.path,
    content: sanitizeFileContentForPrompt(file.path, String(file.content ?? ""), maxChars),
  }));
}

export function trimPromptContextToBudget(params: {
  history?: PromptLikeMessage[];
  projectFiles: ProjectFile[];
  userContent: string;
  mode: PromptBudgetMode;
  provider?: string | null;
  extraTexts?: string[];
}): PromptBudgetResult {
  const {
    history = [],
    projectFiles,
    userContent,
    mode,
    provider,
    extraTexts = [],
  } = params;

  const limit = MODE_LIMITS[mode];
  const reserve = MODE_RESERVE[mode];
  const prioritizedFiles = prioritizeFiles(projectFiles, userContent).slice(0, MAX_FILES_PER_MODE[mode]);

  const resultHistory = sanitizeHistory(history);
  let resultFiles = sanitizeFiles(prioritizedFiles, FILE_CHAR_STEPS[0]);

  let droppedHistoryCount = 0;
  let droppedFileCount = Math.max(0, projectFiles.length - prioritizedFiles.length);
  let trimmedFileCount = 0;

  while (
    resultHistory.length > 0 &&
    totalPromptTokens({
      history: resultHistory,
      projectFiles: resultFiles,
      userContent,
      provider,
      reserve,
      extraTexts,
    }) > limit
  ) {
    resultHistory.shift();
    droppedHistoryCount += 1;
  }

  while (
    resultFiles.length > 1 &&
    totalPromptTokens({
      history: resultHistory,
      projectFiles: resultFiles,
      userContent,
      provider,
      reserve,
      extraTexts,
    }) > limit
  ) {
    resultFiles.pop();
    droppedFileCount += 1;
  }

  for (const charLimit of FILE_CHAR_STEPS.slice(1)) {
    const nextFiles = resultFiles.map((file) => {
      const nextContent = truncateWithMarker(file.content, charLimit);
      return nextContent === file.content ? file : { ...file, content: nextContent };
    });

    const changedCount = nextFiles.filter((file, index) => file.content !== resultFiles[index]?.content).length;
    resultFiles = nextFiles;
    if (changedCount > 0) {
      trimmedFileCount = Math.max(trimmedFileCount, changedCount);
    }

    if (
      totalPromptTokens({
        history: resultHistory,
        projectFiles: resultFiles,
        userContent,
        provider,
        reserve,
        extraTexts,
      }) <= limit
    ) {
      break;
    }
  }

  const noteParts: string[] = [];
  if (droppedHistoryCount > 0) noteParts.push(`ältere History: -${droppedHistoryCount}`);
  if (droppedFileCount > 0) noteParts.push(`Snapshot-Dateien: -${droppedFileCount}`);
  if (trimmedFileCount > 0) noteParts.push(`Dateiausschnitte gekürzt: ${trimmedFileCount}`);

  return {
    history: resultHistory,
    projectFiles: resultFiles,
    note: noteParts.length > 0 ? `Kontext gekürzt (${noteParts.join(", ")}).` : null,
    stats: {
      droppedHistoryCount,
      droppedFileCount,
      trimmedFileCount,
    },
  };
}
