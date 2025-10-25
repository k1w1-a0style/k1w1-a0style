import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

type LogEntry = {
  id: number;
  timestamp: string;
  message: string;
  type: 'log' | 'warn' | 'error';
};

interface TerminalContextProps {
  logs: LogEntry[];
  addLog: (message: string, type?: 'log' | 'warn' | 'error') => void;
  clearLogs: () => void;
}

const TerminalContext = createContext<TerminalContextProps | undefined>(undefined);

let logCounter = 0;

export const TerminalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, type: 'log' | 'warn' | 'error' = 'log') => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog: LogEntry = {
      id: logCounter++,
      timestamp,
      message: String(message),
      type,
    };
    setLogs(prevLogs => [newLog, ...prevLogs.slice(0, 199)]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      queueMicrotask(() => {
        addLog(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '), 'log');
      });
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      queueMicrotask(() => {
        addLog(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '), 'warn');
      });
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      const msg = args.map(arg => typeof arg === 'object' ? String(arg) : arg).join(' ');
      
      // ✅ FIX: Erweiterte Filter für bekannte harmlose Spam-Meldungen
      const ignorePatterns = [
        'Text strings must be rendered within a <Text> component',
        'VirtualizedLists should never be nested',
        'Require cycle:',
      ];
      
      const shouldIgnore = ignorePatterns.some(pattern => msg.includes(pattern));
      
      if (!shouldIgnore) {
        queueMicrotask(() => {
          addLog(msg, 'error');
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
    <TerminalContext.Provider value={{ logs, addLog, clearLogs }}>
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
