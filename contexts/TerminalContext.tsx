import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';

export type LogEntry = {
  id: number;
  timestamp: string;
  message: string;
  type: 'log' | 'warn' | 'error';
};

interface TerminalContextProps {
  logs: LogEntry[];
  addLog: (message: string, type?: 'log' | 'warn' | 'error') => void;
  clearLogs: () => void;

  getLogsByType: (type: 'log' | 'warn' | 'error') => LogEntry[];
  getLogStats: () => { total: number; errors: number; warnings: number; info: number };

  isConsoleOverrideEnabled: boolean;
  setConsoleOverride: (enabled: boolean) => void;
}

const TerminalContext = createContext<TerminalContextProps | undefined>(undefined);

// Counter (Overflow safe)
let logCounter = 0;
const MAX_LOG_COUNTER = 2147483647;

// ✅ Default: ON (damit Build-Logs etc. automatisch auftauchen)
const DEFAULT_CONSOLE_OVERRIDE = true;

// Filter: Noise / Spam
const NOISE_PATTERNS: (string | RegExp)[] = [
  'Require cycle:',
  'Reanimated 2',
  'SecureStore',
  /Running "main" with/i,
  /Remote debugger/i,
];

const shouldIgnore = (msg: string) => {
  if (!msg) return true;
  return NOISE_PATTERNS.some((p) => (typeof p === 'string' ? msg.includes(p) : p.test(msg)));
};

const formatArgs = (args: any[]) => {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
};

export const TerminalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConsoleOverrideEnabled, setIsConsoleOverrideEnabled] = useState(DEFAULT_CONSOLE_OVERRIDE);

  // batch flush for performance
  const logBatchRef = useRef<LogEntry[]>([]);
  const flushScheduledRef = useRef(false);

  // keep original console refs
  const originalsRef = useRef<{
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
  } | null>(null);

  const flushBatch = useCallback(() => {
    setLogs((prev) => {
      const next = [...logBatchRef.current, ...prev];

      // cleanup threshold
      if (next.length > 600) {
        return next.slice(0, 500);
      }
      return next;
    });

    logBatchRef.current = [];
    flushScheduledRef.current = false;
  }, []);

  const addLog = useCallback((message: string, type: 'log' | 'warn' | 'error' = 'log') => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });

    if (logCounter >= MAX_LOG_COUNTER) {
      logCounter = 0;
    }

    const msg = String(message ?? '');
    if (shouldIgnore(msg)) return;

    const entry: LogEntry = {
      id: logCounter++,
      timestamp,
      message: msg,
      type,
    };

    logBatchRef.current.push(entry);

    if (!flushScheduledRef.current) {
      flushScheduledRef.current = true;
      requestAnimationFrame(flushBatch);
    }
  }, [flushBatch]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    logCounter = 0;
  }, []);

  const getLogsByType = useCallback(
    (type: 'log' | 'warn' | 'error') => logs.filter((l) => l.type === type),
    [logs]
  );

  const getLogStats = useCallback(() => {
    const errors = logs.filter((l) => l.type === 'error').length;
    const warnings = logs.filter((l) => l.type === 'warn').length;
    const info = logs.filter((l) => l.type === 'log').length;
    return { total: logs.length, errors, warnings, info };
  }, [logs]);

  const applyConsoleOverride = useCallback(() => {
    if (originalsRef.current) return;

    const originalLog = console.log.bind(console);
    const originalWarn = console.warn.bind(console);
    const originalError = console.error.bind(console);

    originalsRef.current = { log: originalLog, warn: originalWarn, error: originalError };

    console.log = (...args: any[]) => {
      const msg = formatArgs(args);
      addLog(msg, 'log');
      originalLog(...args);
    };

    console.warn = (...args: any[]) => {
      const msg = formatArgs(args);
      addLog(msg, 'warn');
      originalWarn(...args);
    };

    console.error = (...args: any[]) => {
      const msg = formatArgs(args);
      addLog(msg, 'error');
      originalError(...args);
    };

    addLog('🚀 Terminal Console Override aktiv', 'log');
  }, [addLog]);

  const removeConsoleOverride = useCallback(() => {
    const o = originalsRef.current;
    if (!o) return;

    console.log = o.log;
    console.warn = o.warn;
    console.error = o.error;
    originalsRef.current = null;

    addLog('🛑 Terminal Console Override deaktiviert', 'warn');
  }, [addLog]);

  const setConsoleOverride = useCallback(
    (enabled: boolean) => {
      setIsConsoleOverrideEnabled(enabled);
    },
    []
  );

  useEffect(() => {
    if (isConsoleOverrideEnabled) applyConsoleOverride();
    else removeConsoleOverride();

    return () => {
      // cleanup on unmount
      removeConsoleOverride();
    };
  }, [isConsoleOverrideEnabled, applyConsoleOverride, removeConsoleOverride]);

  const value: TerminalContextProps = {
    logs,
    addLog,
    clearLogs,
    getLogsByType,
    getLogStats,
    isConsoleOverrideEnabled,
    setConsoleOverride,
  };

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
};

export const useTerminal = () => {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error('useTerminal must be used within TerminalProvider');
  return ctx;
};
