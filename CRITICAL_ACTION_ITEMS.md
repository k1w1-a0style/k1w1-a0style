# 🚨 Kritische Action Items - k1w1-a0style

**Status:** ⚠️ **NICHT Production-Ready**  
**Datum:** 5. Dezember 2025

---

## 🔴 SOFORT (Diese Woche) - KRITISCH

### 1. API-Keys aus Global Scope entfernen
- **Risiko:** 🔴 10/10 - Sicherheitslücke
- **Aufwand:** 8-12 Stunden
- **Dateien:**
  - `contexts/AIContext.tsx` (Zeilen 306-342)
  - `lib/orchestrator.ts` (Zeilen 102-171)

**To-Do:**
```typescript
// ✅ Implementiere SecureStore-Integration
import * as SecureStore from 'expo-secure-store';

// Ersetze:
(global as any).GROQ_API_KEY = currentKey; // ❌

// Mit:
await SecureStore.setItemAsync('api_key_groq', key); // ✅
```

---

### 2. Input-Validierung in ChatScreen
- **Risiko:** 🔴 8/10 - Prompt Injection möglich
- **Aufwand:** 4-6 Stunden
- **Datei:** `screens/ChatScreen.tsx` (Zeilen 86-110)

**To-Do:**
```typescript
// ✅ Füge hinzu:
const MAX_MESSAGE_LENGTH = 10000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const sanitizeInput = (input: string): string => {
  return input.slice(0, MAX_MESSAGE_LENGTH).trim();
};

const validateFile = (asset: DocumentResultAsset): boolean => {
  if (asset.size && asset.size > MAX_FILE_SIZE) return false;
  const allowedExt = ['.txt', '.md', '.json', '.ts', '.tsx'];
  const ext = asset.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext && allowedExt.includes(ext);
};
```

---

### 3. Error Boundaries implementieren
- **Risiko:** 🟡 5/10 - App-Crashes
- **Aufwand:** 2-3 Stunden
- **Datei:** `App.tsx`

**To-Do:**
```typescript
// ✅ Erstelle ErrorBoundary.tsx
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallbackUI onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

// In App.tsx einbinden
```

**Gesamt-Aufwand Woche 1:** 14-21 Stunden

---

## 🟠 KURZFRISTIG (Nächste 2 Wochen)

### 4. Race Conditions in ProjectContext
- **Risiko:** 🟠 7/10 - Datenverlust
- **Aufwand:** 4-6 Stunden
- **Datei:** `contexts/ProjectContext.tsx` (Zeilen 54-74)

**To-Do:**
```typescript
import { Mutex } from 'async-mutex'; // ✅ Bereits installiert!

const saveMutex = useRef(new Mutex()).current;
const latestProjectRef = useRef<ProjectData | null>(null);

// ✅ Mutex-basiertes Saving implementieren
```

---

### 5. Memory Leak in TerminalContext
- **Risiko:** 🟠 6/10 - Performance-Degradation
- **Aufwand:** 3-4 Stunden
- **Datei:** `contexts/TerminalContext.tsx` (Zeilen 38-82)

**To-Do:**
```typescript
// ✅ Circular-Reference-Safe-Serialization
const safeStringify = (obj: unknown): string => {
  const seen = new WeakSet();
  // Implementierung...
};

// ✅ Log-TTL hinzufügen
const LOG_TTL_MS = 5 * 60 * 1000; // 5 Minuten
```

---

### 6. AbortController für Fetch-Requests
- **Risiko:** 🟠 6/10 - Resource Leaks
- **Aufwand:** 6-8 Stunden
- **Datei:** `lib/orchestrator.ts` (Zeilen 79-97)

**To-Do:**
```typescript
// ✅ Implementiere AbortController
async function withTimeout<T>(
  fetchFn: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  const controller = new AbortController();
  // Implementierung...
}
```

---

### 7. Unit-Tests für kritische Module
- **Risiko:** 🔴 8/10 - Keine Test-Abdeckung!
- **Aufwand:** 20-30 Stunden
- **Dateien:** Alle `lib/*` und `utils/*`

**To-Do:**
```bash
# ✅ Setup Testing
npm install --save-dev @testing-library/react-native jest

# ✅ Erstelle Tests für:
# - lib/orchestrator.ts
# - lib/normalizer.ts
# - lib/fileWriter.ts
# - utils/chatUtils.ts
# - contexts/AIContext.tsx (Key-Rotation)
```

**Gesamt-Aufwand Woche 2-3:** 33-48 Stunden

---

## 🟡 MITTELFRISTIG (Nächster Monat)

### 8. Type-Safety verbessern
- **Aufwand:** 6-8 Stunden
- **Problem:** 47x `(global as any)`, 23x `error: any`

**To-Do:**
```typescript
// ✅ Definiere globale Types
declare global {
  var __K1W1_AI_CONFIG: AIConfig | undefined;
  var GROQ_API_KEY: string | undefined;
  // ...
}

// ✅ Type Guards für Errors
function isErrorWithMessage(error: unknown): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error;
}

// ✅ ESLint-Regel hinzufügen
// '@typescript-eslint/no-explicit-any': 'error'
```

---

### 9. File-Operations optimieren
- **Aufwand:** 2-3 Stunden
- **Datei:** `lib/fileWriter.ts`

**To-Do:**
```typescript
// ✅ Map-basierte Updates (O(n) statt O(n²))
const fileMap = new Map(existing.map(f => [f.path, f]));
// Update über Map statt findIndex
```

---

### 10. Offline-Support implementieren
- **Aufwand:** 12-16 Stunden

**To-Do:**
```typescript
// ✅ NetInfo-Integration
import NetInfo from '@react-native-community/netinfo';

// ✅ Request-Queue für Offline-Modus
// ✅ Retry-Logic mit exponential backoff
// ✅ Optimistic UI-Updates
```

---

### 11. Error-Handling standardisieren
- **Aufwand:** 8-10 Stunden

**To-Do:**
```typescript
// ✅ Zentrale Error-Handler-Klasse
class ErrorHandler {
  static handle(error: Error, context: string) {
    // Logging
    // Monitoring (Sentry)
    // User-Feedback
  }
}

// ✅ Standardisierte Error-Response-Formate
// ✅ Error-Tracking hinzufügen
```

**Gesamt-Aufwand Monat 1:** 28-37 Stunden

---

## 🔵 LANGFRISTIG (Nächstes Quarter)

### 12. Integration-Tests
- **Aufwand:** 16-20 Stunden
- **Scope:** Context-Provider-Interaktionen

### 13. E2E-Tests mit Detox
- **Aufwand:** 20-30 Stunden
- **Scope:** Kritische User-Flows

### 14. Monitoring & Analytics
- **Aufwand:** 8-12 Stunden
- **Tools:** Sentry, Firebase Analytics

### 15. CI/CD Pipeline verbessern
- **Aufwand:** 8-12 Stunden
- **Scope:** Automated Testing, Linting, Build

### 16. Performance-Optimierung
- **Aufwand:** 16-20 Stunden
- **Scope:** Context-Splitting, Code-Splitting, Lazy-Loading

**Gesamt-Aufwand Quarter:** 68-94 Stunden

---

## 📊 ZUSAMMENFASSUNG

| Phase | Aufwand | Priorität |
|-------|---------|-----------|
| **Woche 1** | 14-21h | 🔴 KRITISCH |
| **Woche 2-3** | 33-48h | 🟠 HOCH |
| **Monat 1** | 28-37h | 🟡 MITTEL |
| **Quarter** | 68-94h | 🔵 NIEDRIG |
| **GESAMT** | **143-200h** | **~4-5 Wochen** |

---

## ✅ DEFINITION OF DONE

### Woche 1 (Kritisch):
- [ ] API-Keys werden über SecureStore verwaltet
- [ ] Keine global-Scope API-Key-Referenzen mehr
- [ ] Input-Validierung in ChatScreen implementiert
- [ ] File-Upload-Validierung aktiv
- [ ] Error Boundary um gesamte App
- [ ] Fallback-UI für Fehler vorhanden

### Woche 2-3 (Kurzfristig):
- [ ] Race Conditions in ProjectContext behoben
- [ ] Mutex-basiertes Saving implementiert
- [ ] Memory Leak in TerminalContext gefixt
- [ ] AbortController für alle Fetch-Requests
- [ ] Unit-Tests für lib/orchestrator.ts
- [ ] Unit-Tests für lib/normalizer.ts
- [ ] Unit-Tests für lib/fileWriter.ts
- [ ] Unit-Tests für utils/chatUtils.ts
- [ ] Test-Coverage > 60%

### Monat 1 (Mittelfristig):
- [ ] Type-Safety verbessert (< 10 `any`-Vorkommen)
- [ ] File-Operations optimiert
- [ ] Offline-Support implementiert
- [ ] Error-Handling standardisiert
- [ ] Zentrale Error-Logger aktiv

### Quarter (Langfristig):
- [ ] Integration-Tests vorhanden
- [ ] E2E-Tests für kritische Flows
- [ ] Monitoring-System aktiv (Sentry)
- [ ] CI/CD Pipeline mit Auto-Tests
- [ ] Performance-Optimierungen implementiert
- [ ] Test-Coverage > 80%

---

## 🚨 KRITISCHE WARNUNG

**Das Projekt ist aktuell NICHT production-ready!**

Mindestanforderungen für Production:
1. ✅ API-Keys sicher verwaltet (SecureStore)
2. ✅ Input-Validierung implementiert
3. ✅ Error Boundaries aktiv
4. ✅ Kritische Tests vorhanden (> 60% Coverage)
5. ✅ Race Conditions behoben
6. ✅ Memory Leaks gefixt

**Geschätzte Zeit bis Production-Ready:** 2-3 Wochen (47-69 Stunden)

---

**Erstellt am:** 5. Dezember 2025  
**Review von:** Claude 4.5 Sonnet (Background Agent)  
**Nächstes Update:** Nach Woche 1 (kritische Fixes)
