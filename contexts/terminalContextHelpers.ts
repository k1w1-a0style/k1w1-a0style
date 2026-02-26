// contexts/terminalContextHelpers.ts
// NOTE: This helper file was introduced during refactor attempts.
// It is kept minimal and syntactically correct so typecheck/lint stay green.

export type LogEntry = {
  id: number;
  timestamp: string;
  message: string;
  type: "log" | "warn" | "error";
};

export type TerminalContextProps = {
  logs: LogEntry[];
  addLog: (message: string, type?: LogEntry["type"]) => void;
  clearLogs: () => void;
  getLogsByType: (type: LogEntry["type"]) => LogEntry[];
  getLogStats: () => { total: number; errors: number; warnings: number; info: number };
  isConsoleOverrideEnabled: boolean;
  setConsoleOverride: (enabled: boolean) => void;
};

export const MAX_LOG_COUNTER = 2147483647;
let logCounter = 0;

export const getNextLogId = (): number => {
  if (logCounter >= MAX_LOG_COUNTER) logCounter = 0;
  return logCounter++;
};

export const resetLogCounter = (): void => {
  logCounter = 0;
};
