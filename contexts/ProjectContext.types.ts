// contexts/ProjectContext.types.ts
// Extracted from ProjectContext.tsx: type definitions and constants.

// contexts/ProjectContext.tsx (V15 - ALL CRITICAL FIXES APPLIED)
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { materializeProjectData, sanitizeAndroidPackage, slugify } from "../lib/projectMaterializer";
import { Alert, AppState, AppStateStatus } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { Mutex } from "async-mutex";

import { logger } from "../lib/logger";

import type { ChatMessage } from "../shared/types/chat";
import type { BuildHistoryEntry } from "../shared/types/build";
import type { ProjectData, ProjectFile, TemplateId } from "../shared/types/project";
import type { AutoFixRequest, LastPreviewMeta, ProjectContextProps } from "./types";

import {
  saveProjectToStorage,
  loadProjectFromStorage,
} from "../infra/storage/projectPersistence";

import {
  getGitHubToken,
  getWorkflowRuns,
} from "../infra/github/githubService";

import { loadTemplateFromFile } from "../project/services/templateLoader";
import { applyProjectFileUpdates, mergeProjectFiles } from "../project/domain/projectFileMutations";
import {
  exportProjectZip,
  exportTextFilesZip,
  importProjectZip,
} from "../project/services/projectArchiveService";
import { startBuildJob } from "../project/services/buildStartService";
import { useBuildStatus } from "../hooks/useBuildStatus";

// ✅ FIX: Einheitlicher Validator-Wrapper
import { validateFilePath, validateFileContent } from "../lib/validators";
import type { BuildStatus } from "../shared/types/build";
import {
  addBuildToHistory,
  updateBuildInHistory,
} from "../lib/buildHistoryStorage";
import { CONFIG } from "../config";
import { resolveEffectiveTemplateId } from "../lib/diagnostics/templates";

export const SAVE_DEBOUNCE_MS = 500;
