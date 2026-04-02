import type { AIConfig } from "../../contexts/AIContext";
import type { ProjectData } from "../../shared/types/project";
import type { AppInfoScreenStyles } from "./styles";

export type { AppInfoScreenStyles };

export type AppInfoApiKeysConfig = Pick<AIConfig, "apiKeys">;

export type AppInfoProjectInfoData = Pick<ProjectData, "id" | "lastModified"> | null | undefined;

export type AppInfoTemplateData = Pick<ProjectData, "templateId" | "files"> | null | undefined;
