import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import type { LogType } from "../types";

export const getLogLabel = (type: LogType) =>
  type === "log" ? "INFO" : type.toUpperCase();

export const getLogIcon = (type: LogType): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case "warn":
      return "warning";
    case "error":
      return "close-circle";
    default:
      return "information-circle";
  }
};

export const getLogColor = (type: LogType) => {
  switch (type) {
    case "warn":
      return theme.palette.warning;
    case "error":
      return theme.palette.error;
    default:
      return theme.palette.primary;
  }
};
