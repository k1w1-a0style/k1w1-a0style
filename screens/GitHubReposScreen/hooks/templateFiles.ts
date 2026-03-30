// screens/GitHubReposScreen/hooks/templateFiles.ts
// Extracted from useGitHubReposScreen.ts: template data + loading helpers.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject } from "../../../contexts/ProjectContext";
import {
  createRepo,
  pushFilesToRepo,
  deleteRepo as deleteGitHubRepo,
  renameRepo as renameGitHubRepo,
  createBranch,
  deleteBranch,
  renameBranch,
  createOrUpdateFile,
  getRepoFileText,
  getGitHubToken,
} from "../../../infra/github/githubService";
import { getGitHubUser } from "../../../infra/github/user";
import { autoSyncRepoSecrets } from "../../../lib/autoSyncRepoSecrets";
import { useGitHubRepos, GitHubRepo, WorkflowRun } from "../../../hooks/useGitHubRepos";
import { combineRepos, splitFullName, isValidRepoName } from "../utils/repos";
import { runTemplateHardChecklist, resolveEffectiveTemplateId } from "../../../lib/diagnostics/templates";
import type { TemplateId, CoreTemplateId } from "../../../shared/types/project";


export type TemplateFile = { path: string; content: string };

export type RepoFilterType = "all" | "activeOnly" | "recentOnly";

export const CORE_TEMPLATE_FILES: readonly string[] = [
  ".github/workflows/eas-link.yml",
  ".github/workflows/eas-build.yml",
  ".github/workflows/k1w1-triggered-build.yml",
  ".github/workflows/deploy-supabase-functions.yml",
] as const;

export const loadCoreTemplateFiles = (templateId: CoreTemplateId = "navigation"): TemplateFile[] => {
  try {
    const templateUnknown = (
      templateId === "full"
        ? require("../../../templates/expo-sdk54-full.json")
        : templateId === "navigation"
          ? require("../../../templates/expo-sdk54-navigation.json")
          : templateId === "crud"
            ? require("../../../templates/expo-sdk54-crud.json")
            : require("../../../templates/expo-sdk54-base.json")
    ) as unknown;
    const template = Array.isArray(templateUnknown) ? templateUnknown : [];
    if (!Array.isArray(template)) return [];

    const mapped = template
      .filter((f) => f && typeof f.path === "string")
      .map((f) => ({
        path: String(f.path),
        content:
          typeof f.content === "string"
            ? f.content
            : JSON.stringify(f.content ?? "", null, 2),
      }));

    // Core-Template Dateien sollen nie "halbkaputt" sein.
    // Autofix: wir nutzen hier nur die gefixten Inhalte als Quelle für Core-Workflows.
    const checked = runTemplateHardChecklist(
      mapped.map((f) => ({ path: f.path, content: f.content })),
      { autofix: true },
    );

    return checked.files.map((f) => ({ path: f.path, content: f.content }));
  } catch {
    return [];
  }
};

export const getCoreFileContent = (path: string, templateId: CoreTemplateId = "base"): string | null => {
  const files = loadCoreTemplateFiles(templateId);
  const hit = files.find((f) => f.path === path);
  return hit?.content ?? null;
};
