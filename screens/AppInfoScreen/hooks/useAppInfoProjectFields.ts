import { useEffect, useMemo, useState } from "react";
import type { ProjectData } from "../../../contexts/types";
import type { AllAIProviders, AIConfig } from "../../../contexts/AIContext";

type AssetsStatus = {
  icon: boolean;
  adaptiveIcon: boolean;
  splash: boolean;
  favicon: boolean;
};

export const useAppInfoProjectFields = (
  projectData: ProjectData | null,
  config: AIConfig,
) => {
  const [appName, setAppName] = useState("");
  const [packageName, setPackageNameState] = useState("");
  const [iconPreview, setIconPreview] = useState<string | null>(null);

  // Load app name and package name from project
  useEffect(() => {
    if (!projectData?.files) return;

    setAppName(projectData.name || "Meine App");

    const pkgJson = projectData.files.find((f) => f.path === "package.json");
    if (pkgJson && typeof pkgJson.content === "string") {
      try {
        const parsed = JSON.parse(pkgJson.content);
        setPackageNameState(parsed.name || "meine-app");
      } catch {
        // Silently fallback to default
        setPackageNameState("meine-app");
      }
    }
  }, [projectData?.name, projectData?.files]);

  // Load icon preview separately to avoid unnecessary re-renders
  useEffect(() => {
    if (!projectData?.files) {
      setIconPreview(null);
      return;
    }

    const iconFile = projectData.files.find(
      (f) => f.path === "assets/icon.png",
    );
    if (!iconFile?.content) {
      setIconPreview(null);
      return;
    }

    let base64Data: string = iconFile.content;
    if (base64Data.startsWith("data:image/")) {
      const parts = base64Data.split(",");
      base64Data = parts[1] ?? "";
    }

    if (
      base64Data &&
      base64Data.length > 100 &&
      /^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)
    ) {
      setIconPreview(`data:image/png;base64,${base64Data}`);
    } else {
      setIconPreview(null);
    }
  }, [projectData?.files, projectData?.lastModified]);

  const fileCount = useMemo(
    () => projectData?.files?.length || 0,
    [projectData?.files],
  );

  const messageCount = useMemo(
    () => (projectData?.chatHistory || projectData?.messages)?.length || 0,
    [projectData?.chatHistory, projectData?.messages],
  );

  // (im Original berechnet, auch wenn nicht genutzt) – behalten für 0-Behavior-Change
  const apiKeysCount = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(config.apiKeys).forEach((provider) => {
      counts[provider] = (
        config.apiKeys[provider as AllAIProviders] || []
      ).length;
    });
    return counts;
  }, [config.apiKeys]);

  const assetsStatus: AssetsStatus = useMemo(() => {
    if (!projectData?.files)
      return {
        icon: false,
        adaptiveIcon: false,
        splash: false,
        favicon: false,
      };

    const hasIcon = projectData.files.some(
      (f) => f.path === "assets/icon.png" && f.content.length > 100,
    );
    const hasAdaptiveIcon = projectData.files.some(
      (f) => f.path === "assets/adaptive-icon.png" && f.content.length > 100,
    );
    const hasSplash = projectData.files.some(
      (f) => f.path === "assets/splash.png" && f.content.length > 100,
    );
    const hasFavicon = projectData.files.some(
      (f) => f.path === "assets/favicon.png" && f.content.length > 100,
    );

    return {
      icon: hasIcon,
      adaptiveIcon: hasAdaptiveIcon,
      splash: hasSplash,
      favicon: hasFavicon,
    };
  }, [projectData?.files]);

  return {
    appName,
    setAppName,
    packageName,
    setPackageNameState,
    iconPreview,
    setIconPreview,
    fileCount,
    messageCount,
    apiKeysCount,
    assetsStatus,
  };
};
