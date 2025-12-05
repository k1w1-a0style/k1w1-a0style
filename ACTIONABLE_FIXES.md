# 🔧 Actionable Fixes – Quick Reference

## ⚠️ KRITISCH (Sofort beheben!)

### 1. API-Keys aus Global-Scope entfernen
**Datei:** `contexts/AIContext.tsx`

```typescript
// ❌ AKTUELL (UNSICHER):
(global as any).GROQ_API_KEY = currentKey;

// ✅ BESSER:
import * as SecureStore from 'expo-secure-store';

const saveApiKey = async (provider: string, key: string) => {
  await SecureStore.setItemAsync(`api_key_${provider}`, key, {
    keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY,
  });
};

const getApiKey = async (provider: string): Promise<string | null> => {
  return await SecureStore.getItemAsync(`api_key_${provider}`);
};
```

---

### 2. LogBox.ignoreAllLogs() entfernen
**Datei:** `App.tsx`

```typescript
// ❌ ENTFERNEN:
LogBox.ignoreAllLogs(true);

// ✅ ERSETZEN MIT:
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Require cycle:',
]);
```

---

### 3. Input-Validierung in ChatScreen
**Datei:** `screens/ChatScreen.tsx`

```typescript
const MAX_INPUT_LENGTH = 10000; // 10k chars

const handleSend = async () => {
  const trimmed = textInput.trim();
  
  // Validierung
  if (!trimmed && !selectedFileAsset) return;
  
  if (trimmed.length > MAX_INPUT_LENGTH) {
    Alert.alert(
      'Eingabe zu lang',
      `Maximal ${MAX_INPUT_LENGTH} Zeichen erlaubt.`
    );
    return;
  }
  
  // Sanitize Input (basic)
  const sanitized = trimmed
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control chars
    .trim();
  
  // ... rest of code
};
```

---

### 4. Error Boundary implementieren
**Neue Datei:** `components/ErrorBoundary.tsx`

```typescript
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    // TODO: Send to monitoring service (Sentry, etc.)
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>❌ Etwas ist schiefgelaufen</Text>
          <Text style={styles.error}>{this.state.error.message}</Text>
          <TouchableOpacity style={styles.button} onPress={this.resetError}>
            <Text style={styles.buttonText}>App neu laden</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.palette.background,
    padding: 20,
  },
  title: {
    fontSize: 20,
    color: theme.palette.error,
    marginBottom: 10,
  },
  error: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: theme.palette.background,
    fontWeight: 'bold',
  },
});
```

**In `App.tsx` wrappen:**

```typescript
export default function App() {
  return (
    <ErrorBoundary>
      <TerminalProvider>
        <AIProvider>
          <ProjectProvider>
            <GitHubProvider>
              <AppNavigation />
            </GitHubProvider>
          </ProjectProvider>
        </AIProvider>
      </TerminalProvider>
    </ErrorBoundary>
  );
}
```

---

## 🟡 WICHTIG (Diese Woche)

### 5. Race Condition in ProjectContext beheben
**Datei:** `contexts/ProjectContext.tsx`

```typescript
import { Mutex } from 'async-mutex';

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveMutex = useRef(new Mutex()); // ✅ NEU
  const latestProjectRef = useRef<ProjectData | null>(null); // ✅ NEU

  const debouncedSave = useCallback((project: ProjectData) => {
    latestProjectRef.current = project; // ✅ Immer aktuelle Version speichern
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      await saveMutex.current.runExclusive(async () => {
        const toSave = latestProjectRef.current;
        if (toSave) {
          await saveProjectToStorage(toSave);
        }
      });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // ... rest bleibt gleich
};
```

---

### 6. Memory Leak in TerminalContext fixen
**Datei:** `contexts/TerminalContext.tsx`

```typescript
export const TerminalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef<LogEntry[]>([]); // ✅ NEU

  // ✅ Stabile Callback-Referenz
  const addLog = useCallback((message: string, type: 'log' | 'warn' | 'error' = 'log') => {
    const timestamp = new Date().toLocaleTimeString();
    
    // ✅ Safe stringify für große Objekte
    let safeMessage = String(message);
    if (safeMessage.length > 5000) {
      safeMessage = safeMessage.slice(0, 5000) + '... [truncated]';
    }
    
    const newLog: LogEntry = {
      id: logCounter++,
      timestamp,
      message: safeMessage,
      type,
    };
    
    logsRef.current = [newLog, ...logsRef.current.slice(0, 199)];
    setLogs(logsRef.current);
  }, []); // ✅ Leere Dependencies!

  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      try {
        const msg = args.map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            // ✅ Safe stringify
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');
        
        queueMicrotask(() => addLog(msg, 'log'));
      } catch (e) {
        // Fail silently to prevent infinite loops
      }
      originalLog.apply(console, args);
    };

    // ... analog für warn/error

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [addLog]); // ✅ Stabile Dependency

  // ✅ Auto-Cleanup alte Logs
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      logsRef.current = logsRef.current.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return now - logTime < 3600000; // 1 Stunde
      });
      setLogs(logsRef.current);
    }, 60000); // Jede Minute

    return () => clearInterval(interval);
  }, []);

  // ... rest
};
```

---

### 7. AbortController für Fetch-Requests
**Datei:** `lib/orchestrator.ts`

```typescript
async function callGroq(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  signal?: AbortSignal, // ✅ NEU
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const body = {
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: 0.15,
    max_tokens: 4096,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal, // ✅ NEU
  });

  // ... rest bleibt gleich
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  abortController?: AbortController, // ✅ NEU
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      abortController?.abort(); // ✅ Cancelt Request
      reject(new Error(`Timeout nach ${ms}ms: ${label}`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]);
}

// Usage:
async function callProviderWithRetry(...) {
  const abortController = new AbortController();
  
  try {
    const result = await withTimeout(
      callGroq(apiKey, model, messages, abortController.signal),
      TIMEOUT_MS,
      `${provider}:${model}`,
      abortController,
    );
    return { result, rotations };
  } catch (e) {
    abortController.abort(); // Cleanup
    throw e;
  }
}
```

---

## ✅ VERBESSERUNGEN (Nächste Woche)

### 8. Magic Numbers nach config.ts verschieben

```typescript
// config.ts
export const CONFIG = {
  VALIDATION: {
    // ... existing
  },
  TERMINAL: {
    MAX_LOGS: 200,
    MAX_LOG_LENGTH: 5000,
    LOG_RETENTION_MS: 3600000, // 1 hour
  },
  CHAT: {
    MAX_INPUT_LENGTH: 10000,
    MAX_HISTORY_MESSAGES: 10,
  },
  PROMPT: {
    MAX_FILES_IN_SNAPSHOT: 20,
    MAX_LINES_PER_FILE: 40,
  },
  ORCHESTRATOR: {
    TIMEOUT_MS: 30000,
    MAX_KEY_RETRIES: 3,
  },
  // ... rest
};
```

---

### 9. Type Guards für Error-Handling

```typescript
// utils/typeGuards.ts
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isApiError(error: unknown): error is { message: string; status?: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

// Usage:
try {
  // ...
} catch (error) {
  if (isError(error)) {
    console.error('Standard error:', error.message);
  } else if (isApiError(error)) {
    console.error('API error:', error.message, error.status);
  } else {
    console.error('Unknown error:', String(error));
  }
}
```

---

### 10. Unit-Tests hinzufügen

**Setup:**
```bash
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native
```

**Beispiel-Test:** `lib/__tests__/fileWriter.test.ts`

```typescript
import { applyFilesToProject } from '../fileWriter';
import { ProjectFile } from '../../contexts/types';

describe('fileWriter', () => {
  describe('applyFilesToProject', () => {
    it('should create new files', () => {
      const existing: ProjectFile[] = [];
      const incoming: ProjectFile[] = [
        { path: 'test.ts', content: 'console.log("test");' },
      ];

      const result = applyFilesToProject(existing, incoming);

      expect(result.created).toEqual(['test.ts']);
      expect(result.updated).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.files).toHaveLength(1);
    });

    it('should update existing files with different content', () => {
      const existing: ProjectFile[] = [
        { path: 'test.ts', content: 'old content' },
      ];
      const incoming: ProjectFile[] = [
        { path: 'test.ts', content: 'new content' },
      ];

      const result = applyFilesToProject(existing, incoming);

      expect(result.created).toEqual([]);
      expect(result.updated).toEqual(['test.ts']);
      expect(result.skipped).toEqual([]);
    });

    it('should skip protected files', () => {
      const existing: ProjectFile[] = [
        { path: 'package.json', content: '{}' },
      ];
      const incoming: ProjectFile[] = [
        { path: 'package.json', content: '{ "new": true }' },
      ];

      const result = applyFilesToProject(existing, incoming);

      expect(result.created).toEqual([]);
      expect(result.updated).toEqual([]);
      expect(result.skipped).toEqual(['package.json']);
    });
  });
});
```

---

## 🎯 CHECKLISTE FÜR MERGE

Bevor du zurück zu `main` mergst:

- [ ] Alle kritischen Sicherheitsprobleme behoben
- [ ] `LogBox.ignoreAllLogs(true)` entfernt
- [ ] Error Boundaries implementiert
- [ ] Race Conditions behoben
- [ ] Memory Leaks gefixt
- [ ] Input-Validierung hinzugefügt
- [ ] AbortController implementiert
- [ ] Mindestens 50% Code-Coverage mit Tests
- [ ] ESLint ohne Fehler
- [ ] TypeScript ohne `any`-Warnings (wo möglich)
- [ ] README mit bekannten Issues aktualisiert

---

**Letzte Aktualisierung:** 5. Dezember 2025
