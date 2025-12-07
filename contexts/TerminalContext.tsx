import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from 'react';

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

const TerminalContext = createContext<TerminalContextProps | undefined>(
  undefined,
);

let logCounter = 0;

export const TerminalProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback(
    (message: string, type: 'log' | 'warn' | 'error' = 'log') => {
      const timestamp = new Date().toLocaleTimeString();
      const newLog: LogEntry = {
        id: logCounter++,
        timestamp,
        message: String(message),
        type,
      };
      setLogs(prevLogs => [newLog, ...prevLogs.slice(0, 199)]);
    },
    [],
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      queueMicrotask(() => {
        addLog(
          args
            .map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg),
            )
            .join(' '),
          'log',
        );
      });
      originalLog.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      queueMicrotask(() => {
        addLog(
          args
            .map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg),
            )
            .join(' '),
          'warn',
        );
      });
      originalWarn.apply(console, args);
    };

    console.error = (...args: any[]) => {
      queueMicrotask(() => {
        addLog(
          args
            .map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg),
            )
            .join(' '),
          'error',
        );
      });
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

export const useTerminal = (): TerminalContextProps => {
  const ctx = useContext(TerminalContext);
  if (!ctx) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return ctx;
};
