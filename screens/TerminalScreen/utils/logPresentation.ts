import type { LogType } from "../types";

export const getLogLabel = (type: LogType) =>
  type === "log" ? "INFO" : type.toUpperCase();
