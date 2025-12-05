# Comprehensive Test & Security Plan
**k1w1-a0style Production-Ready Foundation**

**Status:** ✅ Production-Ready Foundation (Tests/Security noch offen)  
**Erstellt:** 5. Dezember 2025  
**Ziel:** Production-Ready Status erreichen

---

## 📋 Executive Summary

Nach einer umfassenden Code-Analyse wurden folgende Bereiche identifiziert, die für Production-Readiness kritisch sind:

### Aktueller Status
- ✅ **Architektur:** Solide Grundlage mit Context API, TypeScript, modularisiert
- ✅ **Core Features:** Funktional (AI Integration, File Management, GitHub Integration)
- ⚠️ **Tests:** 0% Coverage - **KRITISCH**
- ⚠️ **Security:** Mehrere kritische Schwachstellen identifiziert

### Aufwandschätzung
| Kategorie | Priorität | Aufwand | Status |
|-----------|-----------|---------|--------|
| **Security Fixes** | 🔴 KRITISCH | 16-24h | ❌ Offen |
| **Test Infrastructure** | 🔴 KRITISCH | 8-12h | ❌ Offen |
| **Unit Tests** | 🟡 HOCH | 24-32h | ❌ Offen |
| **Integration Tests** | 🟡 HOCH | 16-20h | ❌ Offen |
| **E2E Tests** | 🟢 MITTEL | 12-16h | ❌ Offen |
| **Security Hardening** | 🟡 HOCH | 8-12h | ❌ Offen |
| **Documentation** | 🟢 MITTEL | 4-6h | ❌ Offen |
| **GESAMT** | - | **88-122h** | ❌ Offen |

---

## 🔐 TEIL 1: SECURITY AUDIT

### 1.1 Kritische Sicherheitslücken (Sofort beheben!)

#### 🔴 SEC-001: API Key Exposure in Global Scope
**Severity:** 10/10 CRITICAL  
**Location:** `contexts/AIContext.tsx:306-342`, `lib/orchestrator.ts:100-171`

**Problem:**
```typescript
// ❌ GEFÄHRLICH: API-Keys im globalThis
(global as any).__K1W1_AI_CONFIG = cfg;
(global as any).GROQ_API_KEY = currentKey;
(global as any).GEMINI_API_KEY = currentKey;
```

**Risiken:**
- API-Keys können von jedem Code-Teil ausgelesen werden
- Bei einem XSS/Code-Injection-Angriff sind alle Keys kompromittiert
- Console-Logs könnten versehentlich Keys enthalten
- Memory Dumps bei Crashes könnten Keys enthalten

**Lösung:**
```typescript
// ✅ SICHER: Closure-basierter Scope
class SecureKeyManager {
  private static keys = new Map<AllAIProviders, string[]>();
  
  static setKeys(provider: AllAIProviders, keys: string[]) {
    this.keys.set(provider, keys);
  }
  
  static getCurrentKey(provider: AllAIProviders): string | null {
    const keys = this.keys.get(provider);
    return keys?.[0] ?? null;
  }
  
  // Keys nie in globalThis, nur über getter
}
```

**Action Items:**
- [ ] `SecureKeyManager` Klasse erstellen
- [ ] AIContext refactoren: `updateRuntimeGlobals` entfernen
- [ ] Orchestrator refactoren: `resolveApiKey` mit SecureKeyManager
- [ ] Alle `console.log` mit API-Keys entfernen
- [ ] Unit-Tests für SecureKeyManager
- [ ] Integration-Test: Keys nie in globalThis

**Aufwand:** 4-6 Stunden  
**Deadline:** Sofort

---

#### 🔴 SEC-002: Input Validation fehlt bei File Operations
**Severity:** 9/10 CRITICAL  
**Location:** `lib/fileWriter.ts`, `contexts/projectStorage.ts`, `ChatScreen.tsx`

**Problem:**
```typescript
// ❌ User-Input wird direkt verwendet
const createFile = async (path: string, content: string) => {
  // Keine Validierung von path!
  updateProject(prev => ({
    ...prev,
    files: [...prev.files, { path, content }]
  }));
};
```

**Risiken:**
- **Path Traversal:** `../../etc/passwd` könnte geschrieben werden
- **Oversize Files:** 1GB Datei crasht App
- **Malicious Filenames:** `<script>alert('xss')</script>.tsx`
- **Code Injection:** Dateiinhalt mit eval(), require(), etc.

**Lösung:**
```typescript
// ✅ SICHER: Strikte Validierung
import { z } from 'zod';

const FilePathSchema = z.string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_\-\/\.]+$/)
  .refine(path => !path.includes('..'), 'Path traversal nicht erlaubt')
  .refine(path => !path.startsWith('/'), 'Absolute Pfade nicht erlaubt');

const FileContentSchema = z.string()
  .max(10 * 1024 * 1024); // 10MB max

export const createFile = async (path: string, content: string) => {
  // Validierung
  const validPath = FilePathSchema.parse(path);
  const validContent = FileContentSchema.parse(content);
  
  // Zusätzliche Prüfung
  if (PROTECTED_FILES.has(validPath)) {
    throw new Error('Protected file cannot be modified');
  }
  
  // Rest der Logik...
};
```

**Action Items:**
- [ ] `zod` installieren: `npm install zod`
- [ ] Input-Validierungs-Layer erstellen (`lib/validators.ts`)
- [ ] Alle File-Operationen validieren (create, update, delete, rename)
- [ ] ZIP-Import validieren (Dateigröße, Anzahl, Namen)
- [ ] Chat-Input sanitizen (HTML, Script-Tags entfernen)
- [ ] Unit-Tests für alle Validatoren
- [ ] Fuzzing-Tests für Edge Cases

**Aufwand:** 6-8 Stunden  
**Deadline:** Diese Woche

---

#### 🔴 SEC-003: GitHub Token Storage ohne Encryption-at-Rest
**Severity:** 8/10 CRITICAL  
**Location:** `contexts/githubService.ts:10-28`

**Problem:**
```typescript
// ⚠️ SecureStore ist gut, aber:
export const saveGitHubToken = async (token: string) => {
  await SecureStore.setItemAsync(GH_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY,
  });
};
```

**Risiken:**
- Auf gerooteten/jailbroken Geräten kann SecureStore kompromittiert werden
- Bei Backup werden Tokens ggf. exportiert
- Keine Token-Rotation implementiert
- Keine Ablaufdatum-Prüfung

**Lösung:**
```typescript
// ✅ BESSER: Zusätzliche Verschlüsselung + Expiry
import * as Crypto from 'expo-crypto';

class SecureTokenManager {
  private static ENCRYPTION_KEY: string | null = null;
  
  static async initialize() {
    // Device-spezifischer Encryption Key
    this.ENCRYPTION_KEY = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Constants.deviceId + SECRET_SALT
    );
  }
  
  static async saveToken(key: string, token: string, expiresAt?: Date) {
    const encrypted = await this.encrypt(token);
    const data = JSON.stringify({
      token: encrypted,
      expiresAt: expiresAt?.toISOString(),
      createdAt: new Date().toISOString()
    });
    
    await SecureStore.setItemAsync(key, data, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  }
  
  static async getToken(key: string): Promise<string | null> {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    
    const data = JSON.parse(raw);
    
    // Check expiry
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      await this.deleteToken(key);
      return null;
    }
    
    return await this.decrypt(data.token);
  }
  
  private static async encrypt(text: string): Promise<string> {
    // Implementierung mit crypto-js oder native crypto
  }
  
  private static async decrypt(encrypted: string): Promise<string> {
    // Implementierung
  }
}
```

**Action Items:**
- [ ] `expo-crypto` verwenden (bereits installiert)
- [ ] `SecureTokenManager` implementieren
- [ ] Alle Token-Operationen migrieren
- [ ] Token-Rotation-Mechanismus implementieren
- [ ] Expiry-Handling testen
- [ ] Migration für existierende User

**Aufwand:** 4-6 Stunden  
**Deadline:** Diese Woche

---

### 1.2 Hohe Priorität Sicherheitsprobleme

#### 🟠 SEC-004: Race Conditions in ProjectContext
**Severity:** 7/10 HIGH  
**Location:** `contexts/ProjectContext.tsx:54-74`

**Problem:**
```typescript
// ⚠️ Race Condition möglich
const updateProject = useCallback((updater) => {
  setProjectData(prev => {
    if (!prev) return prev;
    const updated = updater(prev);
    const finalProject = { ...updated, lastModified: new Date().toISOString() };
    debouncedSave(finalProject); // ❌ Async, keine Garantie
    return finalProject;
  });
}, [debouncedSave]);
```

**Risiken:**
- Zwei gleichzeitige Updates können sich überschreiben
- Debounced Save kann verloren gehen
- State und Storage können out-of-sync sein

**Lösung:**
```typescript
import { Mutex } from 'async-mutex';

// ✅ SICHER: Mutex für atomare Updates
const mutex = new Mutex();

const updateProject = useCallback(async (updater) => {
  const release = await mutex.acquire();
  
  try {
    setProjectData(prev => {
      if (!prev) return prev;
      const updated = updater(prev);
      const finalProject = { 
        ...updated, 
        lastModified: new Date().toISOString() 
      };
      
      // Sofort speichern statt debounce
      saveProjectToStorage(finalProject).catch(console.error);
      
      return finalProject;
    });
  } finally {
    release();
  }
}, []);
```

**Action Items:**
- [ ] Mutex für alle Context-Updates implementieren
- [ ] Debounce nur für UI-Updates, nicht für kritische Operationen
- [ ] Integration-Test: Concurrent Updates
- [ ] Stress-Test: 100 Updates in 1 Sekunde

**Aufwand:** 3-4 Stunden

---

#### 🟠 SEC-005: Memory Leaks in TerminalContext
**Severity:** 7/10 HIGH  
**Location:** `contexts/TerminalContext.tsx` (wenn vorhanden)

**Problem:**
- Event-Listener werden nicht aufgeräumt
- Large Strings werden in State gehalten
- Kein Limit für Log-Größe

**Lösung:**
```typescript
// ✅ Cleanup + Size Limits
const MAX_LOG_LINES = 1000;
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

useEffect(() => {
  const listener = (data) => {
    setLogs(prev => {
      const newLogs = [...prev, data];
      
      // Trim if too large
      if (newLogs.length > MAX_LOG_LINES) {
        return newLogs.slice(-MAX_LOG_LINES);
      }
      
      return newLogs;
    });
  };
  
  terminal.on('data', listener);
  
  return () => {
    terminal.off('data', listener); // ✅ Cleanup
  };
}, []);
```

**Action Items:**
- [ ] Alle Event-Listener aufräumen
- [ ] Log-Size-Limits implementieren
- [ ] Memory-Leak-Tests mit Detox
- [ ] Performance-Monitoring

**Aufwand:** 2-3 Stunden

---

#### 🟠 SEC-006: Keine Rate Limiting bei API-Calls
**Severity:** 7/10 HIGH  
**Location:** `lib/orchestrator.ts`, alle API-Calls

**Problem:**
```typescript
// ❌ User kann unbegrenzt API-Calls machen
export async function runOrchestrator(...) {
  // Kein Rate Limit!
  const result = await callProvider(...);
}
```

**Risiken:**
- Denial-of-Service möglich
- API-Kosten explodieren
- Rate-Limits der Provider werden getriggert

**Lösung:**
```typescript
import { RateLimiter } from 'limiter';

// ✅ Rate Limiting pro Provider
const rateLimiters = {
  groq: new RateLimiter({ tokensPerInterval: 10, interval: 'minute' }),
  gemini: new RateLimiter({ tokensPerInterval: 5, interval: 'minute' }),
  // ...
};

export async function runOrchestrator(provider, ...) {
  const limiter = rateLimiters[provider];
  
  const allowed = await limiter.removeTokens(1);
  if (!allowed) {
    throw new Error('Rate limit exceeded. Please wait.');
  }
  
  // Rest der Logik
}
```

**Action Items:**
- [ ] `limiter` Package installieren
- [ ] Rate Limiters für alle Provider
- [ ] UI: User-Feedback bei Rate Limit
- [ ] Persistent Counter in AsyncStorage
- [ ] Unit-Tests für Rate Limiting

**Aufwand:** 2-3 Stunden

---

#### 🟠 SEC-007: XSS-Risiko in Chat-Rendering
**Severity:** 6/10 MEDIUM  
**Location:** `screens/ChatScreen.tsx`, `components/MessageItem.tsx`

**Problem:**
```typescript
// ⚠️ User-Content wird direkt gerendert
<Text>{message.content}</Text>
```

**Risiken:**
- Wenn AI-Response malicious Code enthält, wird dieser gerendert
- Bei HTML-Rendering: XSS möglich

**Lösung:**
```typescript
import DOMPurify from 'isomorphic-dompurify';

// ✅ Sanitize User/AI Content
const SafeText = ({ content }: { content: string }) => {
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre'],
    ALLOWED_ATTR: []
  });
  
  return <Text>{sanitized}</Text>;
};
```

**Action Items:**
- [ ] `isomorphic-dompurify` installieren
- [ ] Alle User/AI-Inhalte sanitizen
- [ ] Code-Highlighting sicher implementieren
- [ ] Unit-Tests mit XSS-Payloads

**Aufwand:** 2-3 Stunden

---

### 1.3 Medium Priorität

#### 🟡 SEC-008: Supabase Client ohne Row-Level-Security
**Severity:** 6/10 MEDIUM  
**Location:** `lib/supabase.ts`, Supabase Backend

**Problem:**
- Keine Row-Level-Security Policies definiert
- Jeder mit Anon-Key kann auf alle Daten zugreifen

**Lösung:**
```sql
-- ✅ RLS aktivieren
ALTER TABLE build_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: User kann nur eigene Jobs sehen
CREATE POLICY "Users can only see own jobs"
  ON build_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: User kann nur eigene Jobs erstellen
CREATE POLICY "Users can create own jobs"
  ON build_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Action Items:**
- [ ] Supabase Auth implementieren
- [ ] RLS Policies für alle Tables
- [ ] Migration-Script erstellen
- [ ] Integration-Tests für RLS

**Aufwand:** 4-6 Stunden

---

#### 🟡 SEC-009: Keine Input-Validierung in Supabase Functions
**Severity:** 6/10 MEDIUM  
**Location:** `supabase/functions/*/index.ts`

**Problem:**
```typescript
// ❌ Body wird direkt verwendet
const body = await req.json();
if (!body.githubRepo) { // Nur existence check
  return error();
}
```

**Lösung:**
```typescript
import { z } from 'zod';

// ✅ Strikte Schema-Validierung
const TriggerBuildSchema = z.object({
  githubRepo: z.string()
    .min(3)
    .max(100)
    .regex(/^[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+$/),
  platform: z.enum(['android', 'ios']).optional(),
  profile: z.enum(['development', 'preview', 'production']).optional()
});

serve(async (req) => {
  const body = await req.json().catch(() => null);
  
  // Validate
  const validated = TriggerBuildSchema.safeParse(body);
  if (!validated.success) {
    return new Response(
      JSON.stringify({ 
        error: 'Invalid input', 
        details: validated.error.issues 
      }),
      { status: 400, headers: corsHeaders }
    );
  }
  
  // Use validated.data
});
```

**Action Items:**
- [ ] Zod für alle Supabase Functions
- [ ] Input-Schemas definieren
- [ ] Error-Response standardisieren
- [ ] Unit-Tests für Validierung

**Aufwand:** 2-3 Stunden

---

#### 🟡 SEC-010: CORS zu permissive
**Severity:** 5/10 MEDIUM  
**Location:** `supabase/functions/_shared/cors.ts`

**Problem:**
```typescript
// ❌ Alle Origins erlaubt
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
};
```

**Lösung:**
```typescript
// ✅ Nur spezifische Origins
const ALLOWED_ORIGINS = [
  'https://k1w1.app',
  'https://app.k1w1.dev',
  process.env.NODE_ENV === 'development' ? 'http://localhost:8081' : null
].filter(Boolean);

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": 
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Credentials": "true"
});
```

**Action Items:**
- [ ] Origin-Whitelist implementieren
- [ ] Environment-based CORS
- [ ] Unit-Tests für CORS-Logic

**Aufwand:** 1-2 Stunden

---

### 1.4 Dependency Security

#### 🟡 SEC-011: Dependency Audit benötigt
**Severity:** 6/10 MEDIUM

**Problem:**
- Keine automatischen Security-Updates
- Keine Vulnerability-Scans in CI

**Lösung:**
```yaml
# .github/workflows/security-audit.yml
name: Security Audit

on:
  schedule:
    - cron: '0 0 * * 0' # Wöchentlich
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm audit --audit-level=moderate
      - run: npm audit fix --dry-run
      
      # Snyk Security Scan
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

**Action Items:**
- [ ] `npm audit` in CI einbauen
- [ ] Snyk oder Dependabot aktivieren
- [ ] Auto-Update für Security Patches
- [ ] Dependency-Review in PR-Prozess

**Aufwand:** 2-3 Stunden

---

## 🧪 TEIL 2: TEST STRATEGY

### 2.1 Test Infrastructure Setup

#### Phase 1: Foundation (8-12h)

**Tools & Setup:**
```json
{
  "devDependencies": {
    "@testing-library/react-native": "^12.4.0",
    "@testing-library/jest-native": "^5.4.3",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "@types/jest": "^29.5.11",
    "jest-expo": "^50.0.1",
    "react-test-renderer": "18.3.1",
    
    // E2E Testing
    "detox": "^20.14.0",
    "@types/detox": "^20.14.0",
    
    // Mocking
    "jest-mock-extended": "^3.0.5",
    "msw": "^2.0.0",
    
    // Coverage
    "nyc": "^15.1.0"
  }
}
```

**Jest Config:**
```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageThresholds: {
    global: {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60
    }
  }
};
```

**Action Items:**
- [ ] Dependencies installieren
- [ ] Jest konfigurieren
- [ ] Test-Helpers erstellen (`__tests__/helpers`)
- [ ] Mock-Setup (`__mocks__`)
- [ ] CI Integration (GitHub Actions)

---

### 2.2 Unit Tests (24-32h)

#### 2.2.1 Core Library Tests

**`lib/orchestrator.test.ts` (HIGH PRIORITY)**

```typescript
import { runOrchestrator, parseFilesFromText } from '../lib/orchestrator';

describe('Orchestrator', () => {
  describe('runOrchestrator', () => {
    beforeEach(() => {
      // Mock global config
      (global as any).__K1W1_AI_CONFIG = {
        apiKeys: { groq: ['test-key-123'] }
      };
    });
    
    afterEach(() => {
      delete (global as any).__K1W1_AI_CONFIG;
    });
    
    it('should call primary provider first', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Test response' } }]
        })
      } as Response);
      
      const result = await runOrchestrator('groq', 'auto-groq', 'speed', [
        { role: 'user', content: 'Test' }
      ]);
      
      expect(result.ok).toBe(true);
      expect(result.provider).toBe('groq');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key-123'
          })
        })
      );
    });
    
    it('should fallback to next provider on error', async () => {
      (global as any).__K1W1_AI_CONFIG.apiKeys.gemini = ['gemini-key'];
      
      const fetchSpy = jest.spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('Groq failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Fallback response' }] } }]
          })
        } as Response);
      
      const result = await runOrchestrator('groq', 'auto-groq', 'speed', [
        { role: 'user', content: 'Test' }
      ]);
      
      expect(result.ok).toBe(true);
      expect(result.provider).toBe('gemini');
    });
    
    it('should rotate API key on 429 error', async () => {
      (global as any).__K1W1_AI_CONFIG.apiKeys.groq = ['key-1', 'key-2'];
      
      const fetchSpy = jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limit' } })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Success with key-2' } }]
          })
        } as Response);
      
      const result = await runOrchestrator('groq', 'auto-groq', 'speed', [
        { role: 'user', content: 'Test' }
      ]);
      
      expect(result.ok).toBe(true);
      expect(result.keysRotated).toBe(1);
    });
    
    it('should timeout after 30s', async () => {
      jest.spyOn(global, 'fetch').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 35000))
      );
      
      const result = await runOrchestrator('groq', 'auto-groq', 'speed', [
        { role: 'user', content: 'Test' }
      ]);
      
      expect(result.ok).toBe(false);
      expect(result.errors[0].error).toContain('Timeout');
    }, 35000);
  });
  
  describe('parseFilesFromText', () => {
    it('should parse valid JSON array', () => {
      const input = JSON.stringify([
        { path: 'App.tsx', content: 'export default App;' }
      ]);
      
      const result = parseFilesFromText(input);
      
      expect(result).toHaveLength(1);
      expect(result![0].path).toBe('App.tsx');
    });
    
    it('should filter out empty files', () => {
      const input = JSON.stringify([
        { path: 'valid.tsx', content: 'code' },
        { path: 'empty.tsx', content: '' },
        { path: 'whitespace.tsx', content: '   ' }
      ]);
      
      const result = parseFilesFromText(input);
      
      expect(result).toHaveLength(1);
      expect(result![0].path).toBe('valid.tsx');
    });
    
    it('should handle malformed JSON gracefully', () => {
      const input = 'not valid json {]';
      
      const result = parseFilesFromText(input);
      
      expect(result).toBeNull();
    });
  });
});
```

**Coverage Target:** 80%  
**Aufwand:** 6-8 Stunden

---

**`lib/fileWriter.test.ts` (HIGH PRIORITY)**

```typescript
import { applyFilesToProject } from '../lib/fileWriter';
import { ProjectFile } from '../contexts/types';

describe('FileWriter', () => {
  describe('applyFilesToProject', () => {
    const existingFiles: ProjectFile[] = [
      { path: 'App.tsx', content: 'old content' },
      { path: 'README.md', content: 'docs' }
    ];
    
    it('should create new files', () => {
      const incoming: ProjectFile[] = [
        { path: 'NewComponent.tsx', content: 'new component' }
      ];
      
      const result = applyFilesToProject(existingFiles, incoming);
      
      expect(result.created).toEqual(['NewComponent.tsx']);
      expect(result.files).toHaveLength(3);
    });
    
    it('should update existing files with different content', () => {
      const incoming: ProjectFile[] = [
        { path: 'App.tsx', content: 'new content' }
      ];
      
      const result = applyFilesToProject(existingFiles, incoming);
      
      expect(result.updated).toEqual(['App.tsx']);
      expect(result.files.find(f => f.path === 'App.tsx')?.content)
        .toBe('new content');
    });
    
    it('should skip protected files', () => {
      const incoming: ProjectFile[] = [
        { path: 'package.json', content: 'malicious' }
      ];
      
      const result = applyFilesToProject(existingFiles, incoming);
      
      expect(result.skipped).toEqual(['package.json']);
      expect(result.created).toHaveLength(0);
    });
    
    it('should normalize paths', () => {
      const incoming: ProjectFile[] = [
        { path: './components/Button.tsx', content: 'button' }
      ];
      
      const result = applyFilesToProject(existingFiles, incoming);
      
      expect(result.files.find(f => f.path === 'components/Button.tsx'))
        .toBeDefined();
    });
    
    it('should reject invalid paths', () => {
      const incoming: ProjectFile[] = [
        { path: '../../etc/passwd', content: 'hack' },
        { path: '<script>alert()</script>', content: 'xss' }
      ];
      
      const result = applyFilesToProject(existingFiles, incoming);
      
      expect(result.skipped.length).toBe(2);
      expect(result.created.length).toBe(0);
    });
  });
});
```

**Coverage Target:** 85%  
**Aufwand:** 3-4 Stunden

---

**`utils/chatUtils.test.ts` (MEDIUM PRIORITY)**

```typescript
import { 
  validateFilePath, 
  normalizePath, 
  extractJsonArray, 
  safeJsonParse 
} from '../utils/chatUtils';

describe('chatUtils', () => {
  describe('validateFilePath', () => {
    it('should accept valid paths', () => {
      const valid = [
        'components/Button.tsx',
        'screens/HomeScreen.tsx',
        'utils/helper.ts',
        'README.md'
      ];
      
      valid.forEach(path => {
        const result = validateFilePath(path);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should reject path traversal', () => {
      const invalid = [
        '../../../etc/passwd',
        'components/../../hack.tsx',
        '..\\windows\\system32'
      ];
      
      invalid.forEach(path => {
        const result = validateFilePath(path);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('traversal');
      });
    });
    
    it('should reject absolute paths', () => {
      const result = validateFilePath('/etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('absolute');
    });
    
    it('should reject paths with special characters', () => {
      const invalid = ['file<>.tsx', 'file?.tsx', 'file*.tsx'];
      
      invalid.forEach(path => {
        const result = validateFilePath(path);
        expect(result.valid).toBe(false);
      });
    });
    
    it('should enforce max length', () => {
      const longPath = 'a/'.repeat(200) + 'file.tsx';
      const result = validateFilePath(longPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('too long');
    });
  });
  
  describe('normalizePath', () => {
    it('should remove leading ./', () => {
      expect(normalizePath('./components/Button.tsx'))
        .toBe('components/Button.tsx');
    });
    
    it('should convert backslashes', () => {
      expect(normalizePath('components\\Button.tsx'))
        .toBe('components/Button.tsx');
    });
    
    it('should remove duplicate slashes', () => {
      expect(normalizePath('components//Button.tsx'))
        .toBe('components/Button.tsx');
    });
  });
  
  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });
    
    it('should return null for invalid JSON', () => {
      const result = safeJsonParse('not json {]');
      expect(result).toBeNull();
    });
    
    it('should handle already parsed objects', () => {
      const obj = { key: 'value' };
      const result = safeJsonParse(obj as any);
      expect(result).toEqual(obj);
    });
  });
});
```

**Coverage Target:** 90%  
**Aufwand:** 2-3 Stunden

---

#### 2.2.2 Context Tests

**`contexts/AIContext.test.tsx` (HIGH PRIORITY)**

```typescript
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AIProvider, useAI } from '../contexts/AIContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

describe('AIContext', () => {
  beforeEach(() => {
    AsyncStorage.clear();
  });
  
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AIProvider>{children}</AIProvider>
  );
  
  describe('API Key Management', () => {
    it('should add API key', async () => {
      const { result } = renderHook(() => useAI(), { wrapper });
      
      await act(async () => {
        await result.current.addApiKey('groq', 'test-key-123');
      });
      
      expect(result.current.config.apiKeys.groq).toContain('test-key-123');
    });
    
    it('should prevent duplicate keys', async () => {
      const { result } = renderHook(() => useAI(), { wrapper });
      
      await act(async () => {
        await result.current.addApiKey('groq', 'test-key');
      });
      
      await expect(
        result.current.addApiKey('groq', 'test-key')
      ).rejects.toThrow('existiert bereits');
    });
    
    it('should remove API key', async () => {
      const { result } = renderHook(() => useAI(), { wrapper });
      
      await act(async () => {
        await result.current.addApiKey('groq', 'key-1');
        await result.current.addApiKey('groq', 'key-2');
        await result.current.removeApiKey('groq', 'key-1');
      });
      
      expect(result.current.config.apiKeys.groq).not.toContain('key-1');
      expect(result.current.config.apiKeys.groq).toContain('key-2');
    });
    
    it('should rotate API keys', async () => {
      const { result } = renderHook(() => useAI(), { wrapper });
      
      await act(async () => {
        await result.current.addApiKey('groq', 'key-1');
        await result.current.addApiKey('groq', 'key-2');
        await result.current.addApiKey('groq', 'key-3');
        await result.current.rotateApiKey('groq');
      });
      
      expect(result.current.config.apiKeys.groq[0]).toBe('key-2');
      expect(result.current.config.apiKeys.groq[2]).toBe('key-1');
    });
    
    it('should get current API key', async () => {
      const { result } = renderHook(() => useAI(), { wrapper });
      
      await act(async () => {
        await result.current.addApiKey('groq', 'test-key');
      });
      
      const key = result.current.getCurrentApiKey('groq');
      expect(key).toBe('test-key');
    });
  });
  
  describe('Provider Selection', () => {
    it('should switch chat provider', async () => {
      const { result } = renderHook(() => useAI(), { wrapper });
      
      await act(async () => {
        result.current.setSelectedChatProvider('gemini');
      });
      
      expect(result.current.config.selectedChatProvider).toBe('gemini');
    });
    
    it('should persist config to storage', async () => {
      const { result } = renderHook(() => useAI(), { wrapper });
      
      await act(async () => {
        result.current.setSelectedChatProvider('openai');
      });
      
      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'ai_config_v2',
          expect.stringContaining('openai')
        );
      });
    });
  });
  
  describe('Quality Mode', () => {
    it('should toggle quality mode', async () => {
      const { result } = renderHook(() => useAI(), { wrapper });
      
      await act(async () => {
        result.current.setQualityMode('quality');
      });
      
      expect(result.current.config.qualityMode).toBe('quality');
    });
  });
});
```

**Coverage Target:** 75%  
**Aufwand:** 4-5 Stunden

---

**Test Suite Summary:**

| Module | Tests | Coverage | Aufwand |
|--------|-------|----------|---------|
| `orchestrator` | 15+ | 80% | 6-8h |
| `fileWriter` | 10+ | 85% | 3-4h |
| `chatUtils` | 12+ | 90% | 2-3h |
| `AIContext` | 12+ | 75% | 4-5h |
| `ProjectContext` | 15+ | 70% | 5-6h |
| `GitHubContext` | 8+ | 70% | 2-3h |
| `projectStorage` | 10+ | 75% | 3-4h |
| `syntaxValidator` | 8+ | 85% | 2-3h |
| **TOTAL** | **90+** | **78%** | **27-36h** |

---

### 2.3 Integration Tests (16-20h)

#### 2.3.1 Context Integration

**`__tests__/integration/ai-orchestrator.test.ts`**

```typescript
describe('AI Context + Orchestrator Integration', () => {
  it('should use API keys from context in orchestrator', async () => {
    const { result } = renderHook(() => useAI(), { wrapper: AIProvider });
    
    await act(async () => {
      await result.current.addApiKey('groq', 'integration-test-key');
    });
    
    const orchestratorResult = await runOrchestrator(
      'groq',
      'auto-groq',
      'speed',
      [{ role: 'user', content: 'test' }]
    );
    
    expect(orchestratorResult.ok).toBe(true);
    // Verify key was used from context
  });
  
  it('should rotate key on error and retry', async () => {
    // Multi-key scenario with orchestrator retry logic
  });
});
```

**Aufwand:** 4-5 Stunden

---

#### 2.3.2 File Operations Flow

**`__tests__/integration/file-operations.test.ts`**

```typescript
describe('File Operations Integration', () => {
  it('should create, update, and validate files end-to-end', async () => {
    // ProjectContext + FileWriter + Validation
  });
  
  it('should handle ZIP export/import correctly', async () => {
    // ProjectStorage + FileSystem + ZIP
  });
});
```

**Aufwand:** 5-6 Stunden

---

#### 2.3.3 GitHub Integration

**`__tests__/integration/github-workflow.test.ts`**

```typescript
describe('GitHub Integration', () => {
  it('should trigger build and poll status', async () => {
    // GitHubService + Supabase Functions + BuildStatus
  });
});
```

**Aufwand:** 4-5 Stunden

---

### 2.4 E2E Tests (12-16h)

#### Setup Detox

```javascript
// .detoxrc.js
module.exports = {
  testRunner: 'jest',
  runnerConfig: 'e2e/config.json',
  configurations: {
    'ios.sim.debug': {
      device: { type: 'iPhone 15 Pro' },
      app: 'ios.debug'
    },
    'android.emu.debug': {
      device: { avdName: 'Pixel_6_API_33' },
      app: 'android.debug'
    }
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      build: 'expo run:ios --configuration Debug',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/k1w1.app'
    },
    'android.debug': {
      type: 'android.apk',
      build: 'expo run:android --variant debug',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk'
    }
  }
};
```

#### Critical User Flows

**`e2e/chat-flow.test.ts`**

```typescript
describe('Chat Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });
  
  it('should send message and receive AI response', async () => {
    // Navigate to Chat
    await element(by.id('tab-chat')).tap();
    
    // Type message
    await element(by.id('chat-input')).typeText('Create a Button component');
    await element(by.id('send-button')).tap();
    
    // Wait for AI response
    await waitFor(element(by.id('ai-response-0')))
      .toBeVisible()
      .withTimeout(30000);
    
    // Verify file was created
    await element(by.id('tab-code')).tap();
    await expect(element(by.text('Button.tsx'))).toBeVisible();
  });
  
  it('should handle AI error gracefully', async () => {
    // Trigger error (no API key)
    await element(by.id('chat-input')).typeText('Test');
    await element(by.id('send-button')).tap();
    
    // Verify error message
    await waitFor(element(by.text(/API-Key fehlt/)))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

**Aufwand:** 6-8 Stunden

---

**`e2e/file-operations.test.ts`**

```typescript
describe('File Operations', () => {
  it('should create, edit, and delete files', async () => {
    // File CRUD operations
  });
  
  it('should export and import ZIP', async () => {
    // ZIP workflow
  });
});
```

**Aufwand:** 4-5 Stunden

---

**`e2e/build-trigger.test.ts`**

```typescript
describe('Build Trigger', () => {
  it('should trigger build and show status', async () => {
    // GitHub build workflow
  });
});
```

**Aufwand:** 3-4 Stunden

---

### 2.5 CI/CD Integration

**`.github/workflows/test.yml`**

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
  
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration
  
  e2e-tests:
    runs-on: macos-latest # iOS Simulator
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup Detox
        run: |
          brew tap wix/brew
          brew install applesimutils
      
      - name: Build iOS app
        run: expo run:ios --configuration Debug
      
      - name: Run E2E tests
        run: npm run test:e2e:ios
```

**Aufwand:** 2-3 Stunden

---

## 📊 TEIL 3: COVERAGE TARGETS

### Target Coverage Goals

| Category | Initial Target | Final Target |
|----------|----------------|--------------|
| **Overall** | 60% | 80% |
| **Critical Paths** | 80% | 95% |
| **lib/** | 70% | 85% |
| **contexts/** | 65% | 80% |
| **utils/** | 75% | 90% |
| **components/** | 50% | 70% |

### Critical Paths (Must be >90%)

1. **API Key Management** (AIContext)
2. **File Write/Validation** (fileWriter, projectStorage)
3. **Orchestrator Fallback Logic** (orchestrator)
4. **GitHub Token Handling** (githubService)
5. **Project State Management** (ProjectContext)

---

## 🚀 TEIL 4: IMPLEMENTATION ROADMAP

### Sprint 1: Security Critical (Woche 1)

**Ziel:** Kritische Sicherheitslücken schließen

| Task | Aufwand | Verantwortlich |
|------|---------|----------------|
| SEC-001: SecureKeyManager | 4-6h | Backend |
| SEC-002: Input Validation | 6-8h | Full-Stack |
| SEC-003: Token Encryption | 4-6h | Backend |
| SEC-004: Race Conditions Fix | 3-4h | Frontend |
| **SUMME** | **17-24h** | |

**Deliverables:**
- ✅ Keine API-Keys in globalThis
- ✅ Alle Inputs validiert
- ✅ Tokens verschlüsselt
- ✅ Keine Race Conditions

---

### Sprint 2: Test Infrastructure (Woche 2)

**Ziel:** Test-Setup vollständig konfiguriert

| Task | Aufwand | Verantwortlich |
|------|---------|----------------|
| Jest Setup | 2-3h | DevOps |
| Test Helpers | 2-3h | Full-Stack |
| CI Integration | 2-3h | DevOps |
| Mock Setup | 2-3h | Full-Stack |
| **SUMME** | **8-12h** | |

**Deliverables:**
- ✅ Jest läuft
- ✅ CI Pipeline für Tests
- ✅ Mocks für externe Services

---

### Sprint 3: Unit Tests Core (Woche 3-4)

**Ziel:** 60% Coverage für Core-Module

| Task | Aufwand | Verantwortlich |
|------|---------|----------------|
| orchestrator.test.ts | 6-8h | Backend |
| fileWriter.test.ts | 3-4h | Backend |
| chatUtils.test.ts | 2-3h | Full-Stack |
| AIContext.test.tsx | 4-5h | Frontend |
| ProjectContext.test.tsx | 5-6h | Frontend |
| **SUMME** | **20-26h** | |

**Deliverables:**
- ✅ 60% Overall Coverage
- ✅ 80% Coverage für lib/
- ✅ 70% Coverage für contexts/

---

### Sprint 4: Integration & Security Hardening (Woche 5)

**Ziel:** Integration-Tests + zusätzliche Security-Maßnahmen

| Task | Aufwand | Verantwortlich |
|------|---------|----------------|
| Integration Tests | 16-20h | Full-Stack |
| SEC-005 bis SEC-010 | 12-16h | Full-Stack |
| **SUMME** | **28-36h** | |

**Deliverables:**
- ✅ Integration-Tests laufen
- ✅ Alle Security-Issues (Medium) behoben

---

### Sprint 5: E2E Tests (Woche 6)

**Ziel:** Kritische User-Flows getestet

| Task | Aufwand | Verantwortlich |
|------|---------|----------------|
| Detox Setup | 2-3h | DevOps |
| E2E: Chat Flow | 6-8h | Full-Stack |
| E2E: File Ops | 4-5h | Full-Stack |
| **SUMME** | **12-16h** | |

**Deliverables:**
- ✅ E2E-Tests für 3 kritische Flows
- ✅ CI: E2E Tests auf PRs

---

### Sprint 6: Final Polish (Woche 7)

**Ziel:** 80% Coverage + Production-Ready

| Task | Aufwand | Verantwortlich |
|------|---------|----------------|
| Coverage auf 80% erhöhen | 8-12h | Full-Stack |
| Security Re-Audit | 4-6h | Security |
| Documentation | 4-6h | Tech-Writer |
| **SUMME** | **16-24h** | |

**Deliverables:**
- ✅ 80% Coverage
- ✅ Security Audit bestanden
- ✅ Test-Dokumentation vollständig

---

## 📈 TEIL 5: SUCCESS METRICS

### Quantitative Metrics

| Metric | Current | Target | Tracking |
|--------|---------|--------|----------|
| **Test Coverage** | 0% | 80% | CodeCov |
| **Security Issues** | 11 | 0 Critical | GitHub Security |
| **Tests Written** | 0 | 90+ | Jest |
| **E2E Flows** | 0 | 3 | Detox |
| **CI Success Rate** | N/A | >95% | GitHub Actions |

### Qualitative Metrics

- [ ] Alle kritischen Sicherheitslücken geschlossen
- [ ] Keine API-Keys im Global Scope
- [ ] Alle Inputs validiert
- [ ] Race Conditions behoben
- [ ] Memory Leaks gefixt
- [ ] Tests laufen in CI
- [ ] Code-Review-Prozess mit Tests
- [ ] Security-Audit bestanden

---

## 🎯 TEIL 6: QUICK WIN PRIORITIES

### Top 5 für sofortige Production-Readiness

1. **SEC-001:** API Keys aus globalThis entfernen (4-6h)
2. **SEC-002:** Input Validation (6-8h)
3. **SEC-003:** Token Encryption (4-6h)
4. **TEST-001:** Jest Setup + 10 Core Tests (8-12h)
5. **SEC-004:** Race Conditions Fix (3-4h)

**Gesamt Quick Wins:** 25-36 Stunden  
**Impact:** Kritische Sicherheitslücken geschlossen + Test-Foundation

---

## 📚 TEIL 7: RESOURCES & TOOLS

### Testing Tools
- **Jest:** Unit & Integration Tests
- **React Native Testing Library:** Component Tests
- **Detox:** E2E Tests
- **MSW:** API Mocking
- **CodeCov:** Coverage Tracking

### Security Tools
- **Snyk:** Dependency Scanning
- **npm audit:** Vulnerability Detection
- **ESLint Security Plugin:** Static Analysis
- **OWASP Dependency Check:** Known Vulnerabilities

### Documentation
- **Test Strategy:** Dieses Dokument
- **Security Guidelines:** [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/)
- **Jest Docs:** [jestjs.io](https://jestjs.io/)
- **Detox Docs:** [wix.github.io/Detox](https://wix.github.io/Detox/)

---

## ✅ NEXT STEPS

### Immediate Actions (Diese Woche)

1. **Review & Approve dieses Dokument**
2. **Assign Tasks an Team-Members**
3. **Setup Tracking (JIRA/GitHub Projects)**
4. **Start Sprint 1: Security Critical**

### Kommunikation

- **Daily Standup:** Test & Security Progress
- **Weekly Review:** Coverage-Zahlen + Security-Status
- **Sprint Demo:** Zeigen der Test-Ergebnisse

---

## 📞 KONTAKT & SUPPORT

**Fragen zu diesem Plan?**

- **Testing:** siehe [Jest Docs](https://jestjs.io/)
- **Security:** siehe [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
- **CI/CD:** siehe `.github/workflows/README.md`

---

**Last Updated:** 5. Dezember 2025  
**Version:** 1.0  
**Status:** ✅ Ready for Implementation
