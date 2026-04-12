import type { AllAIProviders } from "../../../contexts/AIContext";

type ProjectFileLike = {
  path: string;
  content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function toProjectFiles(value: unknown): ProjectFileLike[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is ProjectFileLike =>
      isRecord(entry) && typeof entry.path === "string" && typeof entry.content === "string",
  );
}

export function getPackageNameFromProjectFiles(projectFiles: ProjectFileLike[]): string {
  const pkgJson = projectFiles.find((f) => f.path === "package.json");
  if (!pkgJson || typeof pkgJson.content !== "string") {
    return "meine-app";
  }

  try {
    const parsed = JSON.parse(pkgJson.content) as { name?: unknown };
    return typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : "meine-app";
  } catch {
    return "meine-app";
  }
}

export function getIconPreviewFromProjectFiles(projectFiles: ProjectFileLike[]): string | null {
  const iconFile = projectFiles.find((f) => f.path === "assets/icon.png");
  if (!iconFile?.content) {
    return null;
  }

  let base64Data = iconFile.content;
  if (base64Data.startsWith("base64:")) {
    base64Data = base64Data.slice("base64:".length);
  }
  if (base64Data.startsWith("data:image/")) {
    base64Data = base64Data.split(",")[1] ?? "";
  }

  if (base64Data && base64Data.length > 100 && /^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
    return `data:image/png;base64,${base64Data}`;
  }

  return null;
}

export function toProjectBinaryBase64(content: string): string {
  const trimmed = String(content || "").trim();
  const withoutDataUri = trimmed.startsWith("data:image/")
    ? trimmed.split(",")[1] ?? ""
    : trimmed;
  const normalized = withoutDataUri.startsWith("base64:")
    ? withoutDataUri.slice("base64:".length)
    : withoutDataUri;
  return `base64:${normalized}`;
}

export function getAssetsStatusFromProjectFiles(projectFiles: ProjectFileLike[]): {
  icon: boolean;
  adaptiveIcon: boolean;
  splash: boolean;
  favicon: boolean;
} {
  if (!projectFiles.length) {
    return { icon: false, adaptiveIcon: false, splash: false, favicon: false };
  }

  const hasAsset = (path: string) =>
    projectFiles.some((file) => file.path === path && file.content.length > 100);

  return {
    icon: hasAsset("assets/icon.png"),
    adaptiveIcon: hasAsset("assets/adaptive-icon.png"),
    splash: hasAsset("assets/splash.png"),
    favicon: hasAsset("assets/favicon.png"),
  };
}

export function countMessages(projectData: {
  chatHistory?: unknown;
  messages?: unknown;
} | null | undefined): number {
  const list = Array.isArray(projectData?.chatHistory)
    ? projectData.chatHistory
    : projectData?.messages;
  return Array.isArray(list) ? list.length : 0;
}

export function getApiKeysCount(apiKeys: Record<AllAIProviders, string[]>): Record<string, number> {
  const counts: Record<string, number> = {};
  (Object.keys(apiKeys) as AllAIProviders[]).forEach((provider) => {
    counts[provider] = (apiKeys[provider] || []).length;
  });
  return counts;
}
