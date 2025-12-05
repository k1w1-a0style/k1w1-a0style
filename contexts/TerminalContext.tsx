import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

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
}

const TerminalContext = createContext<TerminalContextProps | undefined>(undefined);

let logCounter = 0;

export const TerminalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, type: 'log' | 'warn' | 'error' = 'log') => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3 
    });
    const newLog: LogEntry = {
      id: logCounter++,
      timestamp,
      message: String(message),
      type,
    };
    setLogs(prevLogs => [newLog, ...prevLogs.slice(0, 499)]); // Increased buffer to 500 logs
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

  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      queueMicrotask(() => {
        const message = args.map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');
        addLog(message, 'log');
      });
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      queueMicrotask(() => {
        const message = args.map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');
        addLog(message, 'warn');
      });
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      const message = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      // Enhanced filter for known harmless spam messages
      const ignorePatterns = [
        'Text strings must be rendered within a <Text> component',
        'VirtualizedLists should never be nested',
        'Require cycle:',
        'componentWillReceiveProps has been renamed',
        'componentWillMount has been renamed',
      ];
      
      const shouldIgnore = ignorePatterns.some(pattern => message.includes(pattern));
      
      if (!shouldIgnore) {
        queueMicrotask(() => {
          addLog(message, 'error');
        });
      }
      originalError.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [addLog]);

  return (
    <TerminalContext.Provider value={{ logs, addLog, clearLogs, getLogsByType, getLogStats }}>
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
