import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';

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

// ✅ FIX: Log-Counter mit Overflow-Schutz (max 2^31-1)
let logCounter = 0;
const MAX_LOG_COUNTER = 2147483647; // 2^31 - 1

// ✅ FIX: Konfigurierbare Console Override (standardmäßig AUS für Sicherheit)
const ENABLE_CONSOLE_OVERRIDE = false; // Set to true to enable global console override

export const TerminalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConsoleOverrideEnabled, setIsConsoleOverrideEnabled] = useState(ENABLE_CONSOLE_OVERRIDE);
  
  // ✅ FIX: Batch-Processing für bessere Performance
  const logBatchRef = useRef<LogEntry[]>([]);
  const flushScheduledRef = useRef(false);

  const addLog = useCallback((message: string, type: 'log' | 'warn' | 'error' = 'log') => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3 
    });
    
    // ✅ FIX: Overflow-Schutz für Log-Counter
    if (logCounter >= MAX_LOG_COUNTER) {
      logCounter = 0;
      console.warn('[TerminalContext] Log-Counter zurückgesetzt (Overflow-Schutz)');
    }
    
    const newLog: LogEntry = {
      id: logCounter++,
      timestamp,
      message: String(message),
      type,
    };
    
    // ✅ FIX: Batch logs und flush in nächstem Frame
    logBatchRef.current.push(newLog);
    
    if (!flushScheduledRef.current) {
      flushScheduledRef.current = true;
      requestAnimationFrame(() => {
        setLogs(prevLogs => {
          const newLogs = [...logBatchRef.current, ...prevLogs];
          
          // ✅ FIX: Cleanup wenn zu viele Logs (600 Threshold, 500 behalten)
          if (newLogs.length > 600) {
            console.warn('[Terminal] Log limit reached, cleaning up');
            return newLogs.slice(0, 500);
          }
          
          return newLogs;
        });
        logBatchRef.current = [];
        flushScheduledRef.current = false;
      });
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    logCounter = 0; // Reset counter on clear
  }, []);

  const getLogsByType = useCallback((type: 'log' | 'warn' | 'error') => {
    return logs.filter(log => log.type === type);
  }, [logs]);

  const getLogStats = useCallback(() => {
    const errors = logs.filter(l => l.type === 'error').length;
    const warnings = logs.filter(l => l.type === 'warn').length;
    const info = logs.filter(l => l.type === 'log').length;
    return { total: logs.length, errors, warnings, info };
  }, [logs]);

  // ✅ FIX: Optional Console Override (nur wenn aktiviert)
  useEffect(() => {
    if (!isConsoleOverrideEnabled) {
      console.log('[TerminalContext] Console Override deaktiviert - nutze createTerminalLogger() für Opt-in');
      return;
    }

    console.log('[TerminalContext] ⚠️  Console Override AKTIVIERT - kann Debugging beeinträchtigen');
    
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const formatArgs = (args: any[]): string => {
      return args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
    };

    // ✅ FIX: Bessere Spam-Filter
    const ignorePatterns = [
      'Text strings must be rendered within a <Text> component',
      'VirtualizedLists should never be nested',
      'Require cycle:',
      'componentWillReceiveProps has been renamed',
      'componentWillMount has been renamed',
      'Warning: Failed prop type',
      '[TerminalContext]', // Verhindere Rekursion
    ];
    
    const shouldIgnore = (message: string): boolean => {
      return ignorePatterns.some(pattern => message.includes(pattern));
    };

    console.log = (...args) => {
      const message = formatArgs(args);
      if (!shouldIgnore(message)) {
        addLog(message, 'log');
      }
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      const message = formatArgs(args);
      if (!shouldIgnore(message)) {
        addLog(message, 'warn');
      }
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      const message = formatArgs(args);
      if (!shouldIgnore(message)) {
        addLog(message, 'error');
      }
      originalError.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      console.log('[TerminalContext] Console Override deaktiviert (Cleanup)');
    };
  }, [addLog, isConsoleOverrideEnabled]);

  const setConsoleOverride = useCallback((enabled: boolean) => {
    setIsConsoleOverrideEnabled(enabled);
    console.log(`[TerminalContext] Console Override ${enabled ? 'AKTIVIERT' : 'DEAKTIVIERT'}`);
  }, []);

  return (
    <TerminalContext.Provider value={{ 
      logs, 
      addLog, 
      clearLogs, 
      getLogsByType, 
      getLogStats,
      isConsoleOverrideEnabled,
      setConsoleOverride,
    }}>
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminal = () => {
  const context = useContext(TerminalContext);
  if (context === undefined) {
    throw new Error('useTerminal muss innerhalb eines TerminalProvider verwendet werden');
  }
  return context;
};

// ✅ FIX: Opt-in Terminal Logger (Alternative zum globalen Console Override)
export const createTerminalLogger = (terminalContext: TerminalContextProps) => ({
  log: (message: string) => {
    console.log(message);
    terminalContext.addLog(message, 'log');
  },
  warn: (message: string) => {
    console.warn(message);
    terminalContext.addLog(message, 'warn');
  },
  error: (message: string) => {
    console.error(message);
    terminalContext.addLog(message, 'error');
  },
  info: (message: string) => {
    console.log(`ℹ️  ${message}`);
    terminalContext.addLog(message, 'log');
  },
  success: (message: string) => {
    console.log(`✅ ${message}`);
    terminalContext.addLog(message, 'log');
  },
});
