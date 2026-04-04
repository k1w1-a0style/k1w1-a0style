import { Alert } from "react-native";

export const confirmWithAlert = (params: {
  title: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
}): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    Alert.alert(params.title, params.message, [
      { text: params.cancelText ?? "Abbrechen", style: "cancel", onPress: () => resolve(false) },
      { text: params.confirmText ?? "Weiter", onPress: () => resolve(true) },
    ]);
  });

export const buildBatchRiskPromptMessage = (params: {
  hasRisk: boolean;
  shortPaths: string[];
  more: string;
  softLines: string[];
}): string => {
  const header = params.hasRisk
    ? "Einige Fixes betreffen CI/Build/Infra Dateien."
    : "Einige Fixes sind sehr groß/komplex.";
  const pathsBlock = params.hasRisk
    ? `\n\nBetroffene Pfade:\n- ${params.shortPaths.join("\n- ")}${params.more}`
    : "";
  const softNote = params.softLines.length
    ? `\n\nGroße Fixes (Bestätigung nötig):\n${params.softLines.join("\n")}`
    : "";
  return `${header}${pathsBlock}${softNote}\n\nWillst du wirklich fortfahren?`;
};

export const buildSmartFixLimitMessage = (params: {
  max: number;
  total: number;
}): string =>
  `Es werden nur ${params.max}/${params.total} empfohlenen Fixes angewendet. Filtere oder führe erneut aus, um weitere anzuwenden.`;

export const buildSelectedFixLimitMessage = (params: {
  max: number;
  selectedCount: number;
}): string =>
  `Es sind ${params.selectedCount} Fixes ausgewählt, aber maximal ${params.max} können auf einmal angewendet werden.\n\nTipp: Nutze Filter (z.B. fail-only), oder führe AutoFix mehrfach aus.`;

export const buildAutoFixStartMessage = (params: {
  count: number;
  autoFixScope: "visible" | "all";
  autoFixIncludeWarn: boolean;
}): string =>
  `Es werden ${params.count} Fix(es) automatisch angewendet.\nScope: ${params.autoFixScope}\nIncludes warnings: ${params.autoFixIncludeWarn ? "ja" : "nein"}\n\nTipp: Mit „Re-Run“ nach dem Fix wird automatisch gegengecheckt.`;
