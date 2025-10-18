import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TerminalContextProps {
  logs: string[];
  addLog: (log: string) => void;
}

const TerminalContext = createContext<TerminalContextProps | undefined>(undefined);

interface TerminalProviderProps {
  children: ReactNode;
}

export const TerminalProvider: React.FC<TerminalProviderProps> = ({ children }) => {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (log: string) => {
    // Füge Logs am ENDE des Arrays hinzu, schneide alte vorne ab
    setLogs((prevLogs) => [...prevLogs.slice(-99), log]); // Max 100 Zeilen
  };

  return (
    <TerminalContext.Provider value={{ logs, addLog }}>
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminal = () => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal muss innerhalb eines TerminalProvider verwendet werden');
  }
  return context;
};
