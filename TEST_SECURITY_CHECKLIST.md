# Test & Security Implementation Checklist
**k1w1-a0style - Task Tracking**

---

## 🔴 SPRINT 1: Security Critical (Woche 1)

### SEC-001: API Keys aus Global Scope entfernen (4-6h)

- [ ] **Create `lib/SecureKeyManager.ts`**
  - [ ] Implementiere private key storage mit Map
  - [ ] Getter-Methoden ohne globalThis
  - [ ] Key-Rotation-Logik
  - [ ] Error-Handling

- [ ] **Refactor `contexts/AIContext.tsx`**
  - [ ] Entferne `updateRuntimeGlobals` Funktion (Zeile 306-342)
  - [ ] Ersetze durch `SecureKeyManager.setKeys()`
  - [ ] Entferne alle globalThis assignments
  - [ ] Update `getCurrentApiKey` zu SecureKeyManager

- [ ] **Refactor `lib/orchestrator.ts`**
  - [ ] Entferne `resolveApiKey` globalThis-Zugriffe (Zeile 100-171)
  - [ ] Nutze `SecureKeyManager.getCurrentKey()`
  - [ ] Entferne API-Key aus Console-Logs

- [ ] **Tests schreiben**
  - [ ] `lib/__tests__/SecureKeyManager.test.ts`
  - [ ] Test: Keys niemals in globalThis
  - [ ] Test: Key-Rotation funktioniert
  - [ ] Test: Concurrent access safe

- [ ] **Code Review & Merge**

---

### SEC-002: Input Validation (6-8h)

- [ ] **Install Zod**
  ```bash
  npm install zod
  ```

- [ ] **Create `lib/validators.ts`**
  - [ ] `FilePathSchema` (min/max length, no traversal, regex)
  - [ ] `FileContentSchema` (max size 10MB)
  - [ ] `GitHubRepoSchema` (owner/repo format)
  - [ ] `ChatInputSchema` (max length, sanitization)

- [ ] **Refactor File Operations**
  - [ ] `lib/fileWriter.ts`: Validate alle paths/content
  - [ ] `contexts/ProjectContext.tsx`: Validate createFile/renameFile
  - [ ] `contexts/projectStorage.ts`: Validate ZIP import
    - [ ] Max file size per file (10MB)
    - [ ] Max total files (1000)
    - [ ] Validate each path

- [ ] **Refactor Chat Input**
  - [ ] `screens/ChatScreen.tsx`: Sanitize user input
  - [ ] Remove HTML/Script tags
  - [ ] Max message length

- [ ] **Tests schreiben**
  - [ ] `lib/__tests__/validators.test.ts`
  - [ ] Test path traversal attacks (`../../etc/passwd`)
  - [ ] Test XSS payloads (`<script>alert()</script>`)
  - [ ] Test oversized inputs
  - [ ] Test malicious filenames
  - [ ] Fuzzing tests (random inputs)

- [ ] **Integration Test**
  - [ ] E2E: Try creating file with `../` in path → should fail
  - [ ] E2E: Try uploading 1GB file → should fail

- [ ] **Code Review & Merge**

---

### SEC-003: Token Encryption (4-6h)

- [ ] **Create `lib/SecureTokenManager.ts`**
  - [ ] Nutze `expo-crypto` (bereits installiert)
  - [ ] Device-spezifischer Encryption-Key
  - [ ] `saveToken(key, token, expiresAt)`
  - [ ] `getToken(key)` mit Expiry-Check
  - [ ] `deleteToken(key)`
  - [ ] `encrypt()` / `decrypt()` helpers

- [ ] **Refactor `contexts/githubService.ts`**
  - [ ] Ersetze `saveGitHubToken` mit `SecureTokenManager.saveToken`
  - [ ] Ersetze `getGitHubToken` mit `SecureTokenManager.getToken`
  - [ ] Gleiches für `saveExpoToken` / `getExpoToken`
  - [ ] Token-Rotation-Mechanismus (optional)

- [ ] **Migration für existierende User**
  - [ ] Funktion: alte Tokens migrieren
  - [ ] Einmalig beim App-Start ausführen
  - [ ] Alte Tokens löschen nach Migration

- [ ] **Tests schreiben**
  - [ ] `lib/__tests__/SecureTokenManager.test.ts`
  - [ ] Test: Encryption/Decryption
  - [ ] Test: Expiry-Handling
  - [ ] Test: Device-spezifisch
  - [ ] Mock: SecureStore

- [ ] **Code Review & Merge**

---

### SEC-004: Race Conditions fixen (3-4h)

- [ ] **Install async-mutex** (bereits installiert ✅)

- [ ] **Refactor `contexts/ProjectContext.tsx`**
  - [ ] Importiere `Mutex` from 'async-mutex'
  - [ ] Erstelle `const mutex = new Mutex()`
  - [ ] Wrappe `updateProject` mit `mutex.acquire()`
  - [ ] Entferne debounce für kritische Operationen
  - [ ] Save-Logic in try-finally

- [ ] **Refactor `contexts/AIContext.tsx`** (falls needed)
  - [ ] Gleiche Mutex-Logik für `persist()`

- [ ] **Tests schreiben**
  - [ ] `contexts/__tests__/ProjectContext.test.tsx`
  - [ ] Test: 100 concurrent updates
  - [ ] Test: State und Storage in sync
  - [ ] Stress-Test mit `Promise.all`

- [ ] **Code Review & Merge**

---

### TEST-001: Jest Setup (2-3h)

- [ ] **Install Test Dependencies**
  ```bash
  npm install --save-dev \
    @testing-library/react-native@^12.4.0 \
    @testing-library/jest-native@^5.4.3 \
    jest@^29.7.0 \
    ts-jest@^29.1.1 \
    @types/jest@^29.5.11 \
    jest-expo@^50.0.1 \
    react-test-renderer@18.3.1 \
    jest-mock-extended@^3.0.5
  ```

- [ ] **Create `jest.config.js`**
  - [ ] Preset: 'jest-expo'
  - [ ] Transform ignore patterns
  - [ ] Coverage config (60% threshold)
  - [ ] Setup files

- [ ] **Create `jest.setup.js`**
  - [ ] Mock AsyncStorage
  - [ ] Mock SecureStore
  - [ ] Mock FileSystem
  - [ ] Global test utilities

- [ ] **Create `__mocks__/` directory**
  - [ ] `@react-native-async-storage/async-storage.ts`
  - [ ] `expo-secure-store.ts`
  - [ ] `expo-file-system.ts`

- [ ] **Add npm scripts to `package.json`**
  ```json
  {
    "scripts": {
      "test": "jest",
      "test:watch": "jest --watch",
      "test:coverage": "jest --coverage",
      "test:unit": "jest --testPathPattern=__tests__",
      "test:integration": "jest --testPathPattern=integration"
    }
  }
  ```

- [ ] **First Smoke Test**
  - [ ] Create `__tests__/smoke.test.ts`
  - [ ] Simple test: `1 + 1 = 2`
  - [ ] Run: `npm test`
  - [ ] Verify: Test passes ✅

- [ ] **Code Review & Merge**

---

### TEST-002: First 10 Critical Tests (6-9h)

- [ ] **`lib/__tests__/orchestrator.test.ts`** (3 tests)
  - [ ] Test: Primary provider called first
  - [ ] Test: Fallback on error
  - [ ] Test: API key rotation on 429

- [ ] **`lib/__tests__/fileWriter.test.ts`** (3 tests)
  - [ ] Test: Create new file
  - [ ] Test: Update existing file
  - [ ] Test: Skip protected files

- [ ] **`contexts/__tests__/AIContext.test.tsx`** (2 tests)
  - [ ] Test: Add API key
  - [ ] Test: Rotate API key

- [ ] **`utils/__tests__/chatUtils.test.ts`** (2 tests)
  - [ ] Test: validateFilePath rejects traversal
  - [ ] Test: normalizePath cleans input

- [ ] **Verify Coverage: ~15-20%**
  ```bash
  npm run test:coverage
  ```

- [ ] **Code Review & Merge**

---

## 🟡 SPRINT 2: Test Infrastructure (Woche 2)

### TEST-003: Test Helpers & Utilities (2-3h)

- [ ] **Create `__tests__/helpers/` directory**

- [ ] **`__tests__/helpers/renderWithProviders.tsx`**
  ```typescript
  export const renderWithProviders = (ui, options) => {
    const Wrapper = ({ children }) => (
      <AIProvider>
        <ProjectProvider>
          {children}
        </ProjectProvider>
      </AIProvider>
    );
    return render(ui, { wrapper: Wrapper, ...options });
  };
  ```

- [ ] **`__tests__/helpers/mockApiResponse.ts`**
  - [ ] Mock Groq API response
  - [ ] Mock Gemini API response
  - [ ] Mock OpenAI API response

- [ ] **`__tests__/helpers/fixtures.ts`**
  - [ ] Sample ProjectData
  - [ ] Sample ChatMessages
  - [ ] Sample Files

- [ ] **Code Review & Merge**

---

### TEST-004: CI Integration (2-3h)

- [ ] **Create `.github/workflows/test.yml`**
  - [ ] Job: Unit Tests
  - [ ] Job: Integration Tests
  - [ ] Upload coverage to CodeCov
  - [ ] Fail on <60% coverage

- [ ] **Setup CodeCov**
  - [ ] Account erstellen
  - [ ] Add `CODECOV_TOKEN` zu GitHub Secrets
  - [ ] Badge in README.md

- [ ] **Configure GitHub Branch Protection**
  - [ ] Require tests to pass before merge
  - [ ] Require min 60% coverage

- [ ] **Test CI Pipeline**
  - [ ] Create test PR
  - [ ] Verify: Tests run automatically
  - [ ] Verify: Coverage report uploaded

- [ ] **Code Review & Merge**

---

## 🟢 SPRINT 3: Core Unit Tests (Woche 3-4)

### TEST-005: Orchestrator Tests (6-8h)

- [ ] **Complete `lib/__tests__/orchestrator.test.ts`**
  - [ ] Test: Timeout after 30s
  - [ ] Test: Parse valid file JSON
  - [ ] Test: Handle malformed JSON
  - [ ] Test: All providers (groq, gemini, openai, anthropic, hf)
  - [ ] Test: Error messages enhanced correctly
  - [ ] Test: Rate limit detection
  - [ ] Test: Quality mode selection

- [ ] **Target: 80% coverage for `orchestrator.ts`**

---

### TEST-006: FileWriter Tests (3-4h)

- [ ] **Complete `lib/__tests__/fileWriter.test.ts`**
  - [ ] Test: Normalize paths
  - [ ] Test: Reject invalid paths (multiple edge cases)
  - [ ] Test: Merge vs overwrite logic
  - [ ] Test: Empty content handling

- [ ] **Target: 85% coverage for `fileWriter.ts`**

---

### TEST-007: ChatUtils Tests (2-3h)

- [ ] **Complete `utils/__tests__/chatUtils.test.ts`**
  - [ ] Test: All validateFilePath edge cases
  - [ ] Test: normalizePath (backslashes, ./, //)
  - [ ] Test: extractJsonArray
  - [ ] Test: safeJsonParse

- [ ] **Target: 90% coverage for `chatUtils.ts`**

---

### TEST-008: AIContext Tests (4-5h)

- [ ] **Complete `contexts/__tests__/AIContext.test.tsx`**
  - [ ] Test: Load config from AsyncStorage
  - [ ] Test: Persist config to AsyncStorage
  - [ ] Test: Add/Remove/Rotate API keys
  - [ ] Test: Switch providers
  - [ ] Test: Quality mode toggle
  - [ ] Test: Migration from old config

- [ ] **Target: 75% coverage for `AIContext.tsx`**

---

### TEST-009: ProjectContext Tests (5-6h)

- [ ] **Create `contexts/__tests__/ProjectContext.test.tsx`**
  - [ ] Test: Initialize project
  - [ ] Test: Update project files
  - [ ] Test: Add chat message
  - [ ] Test: Create/Delete/Rename file
  - [ ] Test: Export/Import ZIP
  - [ ] Test: Race condition prevention (mutex)

- [ ] **Target: 70% coverage for `ProjectContext.tsx`**

---

### TEST-010: Weitere Core Tests (6-8h)

- [ ] **`contexts/__tests__/GitHubContext.test.tsx`**
  - [ ] Test: Set active repo
  - [ ] Test: Recent repos management
  - [ ] Test: Clear recent repos

- [ ] **`contexts/__tests__/projectStorage.test.ts`**
  - [ ] Test: Save/Load project
  - [ ] Test: ZIP export
  - [ ] Test: ZIP import with validation
  - [ ] Test: Max file size enforcement

- [ ] **`utils/__tests__/syntaxValidator.test.ts`**
  - [ ] Test: Validate TypeScript syntax
  - [ ] Test: Validate JSON
  - [ ] Test: Code quality checks

---

### ✅ Checkpoint: 60% Coverage

- [ ] **Run Coverage Report**
  ```bash
  npm run test:coverage
  ```

- [ ] **Verify: ≥60% overall coverage**

- [ ] **Verify: ≥80% for lib/ coverage**

- [ ] **Verify: ≥70% for contexts/ coverage**

---

## 🔵 SPRINT 4: Integration Tests (Woche 5)

### TEST-011: AI + Orchestrator Integration (4-5h)

- [ ] **Create `__tests__/integration/ai-orchestrator.test.ts`**
  - [ ] Test: API keys from context used in orchestrator
  - [ ] Test: Key rotation on error updates context
  - [ ] Test: Fallback providers work end-to-end
  - [ ] Test: Quality mode affects model selection

---

### TEST-012: File Operations Integration (5-6h)

- [ ] **Create `__tests__/integration/file-operations.test.ts`**
  - [ ] Test: Create → Validate → Save → Load cycle
  - [ ] Test: ZIP export → Import → Verify files
  - [ ] Test: File validation prevents bad files
  - [ ] Test: Protected files cannot be modified

---

### TEST-013: GitHub Integration (4-5h)

- [ ] **Create `__tests__/integration/github-workflow.test.ts`**
  - [ ] Test: Save token → Trigger build → Poll status
  - [ ] Test: Error handling when token invalid
  - [ ] Mock: GitHub API responses
  - [ ] Mock: Supabase Functions

---

### TEST-014: Security Hardening (Rest) (12-16h)

- [ ] **SEC-005: Memory Leaks** (2-3h)
  - [ ] Fix TerminalContext event listeners
  - [ ] Add log size limits
  - [ ] Test: Memory leak detection

- [ ] **SEC-006: Rate Limiting** (2-3h)
  - [ ] Install `limiter` package
  - [ ] Implement rate limiters per provider
  - [ ] Test: Rate limit enforcement

- [ ] **SEC-007: XSS Prevention** (2-3h)
  - [ ] Install `isomorphic-dompurify`
  - [ ] Sanitize chat content
  - [ ] Test: XSS payloads blocked

- [ ] **SEC-008: Supabase RLS** (4-6h)
  - [ ] Implement Supabase Auth
  - [ ] Write RLS policies
  - [ ] Migration script
  - [ ] Test: RLS enforcement

- [ ] **SEC-009: Supabase Function Validation** (2-3h)
  - [ ] Add Zod to Supabase Functions
  - [ ] Validate all inputs
  - [ ] Test: Invalid inputs rejected

---

## 🟣 SPRINT 5: E2E Tests (Woche 6)

### TEST-015: Detox Setup (2-3h)

- [ ] **Install Detox**
  ```bash
  npm install --save-dev detox @types/detox
  ```

- [ ] **Create `.detoxrc.js`**
  - [ ] Configure iOS simulator
  - [ ] Configure Android emulator
  - [ ] Build commands

- [ ] **Add npm scripts**
  ```json
  {
    "test:e2e:ios": "detox test -c ios.sim.debug",
    "test:e2e:android": "detox test -c android.emu.debug"
  }
  ```

- [ ] **Smoke Test**
  - [ ] Create `e2e/smoke.test.ts`
  - [ ] Test: App launches
  - [ ] Run: `npm run test:e2e:ios`

---

### TEST-016: E2E Chat Flow (6-8h)

- [ ] **Create `e2e/chat-flow.test.ts`**
  - [ ] Test: Send message → Receive AI response
  - [ ] Test: AI creates file → File appears in Code tab
  - [ ] Test: Error handling (no API key)
  - [ ] Test: Multiple messages in conversation

---

### TEST-017: E2E File Operations (4-5h)

- [ ] **Create `e2e/file-operations.test.ts`**
  - [ ] Test: Create file via UI
  - [ ] Test: Edit file content
  - [ ] Test: Delete file
  - [ ] Test: Export ZIP → Import → Verify

---

### TEST-018: E2E Build Trigger (3-4h)

- [ ] **Create `e2e/build-trigger.test.ts`**
  - [ ] Test: Configure GitHub token
  - [ ] Test: Trigger build
  - [ ] Test: View build status
  - [ ] Mock: GitHub Actions API

---

## 🎯 SPRINT 6: Final Polish (Woche 7)

### TEST-019: Coverage auf 80% erhöhen (8-12h)

- [ ] **Identify untested code**
  ```bash
  npm run test:coverage -- --verbose
  ```

- [ ] **Write missing tests**
  - [ ] Components (50→70%)
  - [ ] Screens (minimal, critical paths only)
  - [ ] Hooks (if any)

- [ ] **Target: 80% overall coverage**

---

### TEST-020: Security Re-Audit (4-6h)

- [ ] **Run Security Tools**
  ```bash
  npm audit
  npm audit fix
  ```

- [ ] **Snyk Scan**
  - [ ] Setup Snyk account
  - [ ] Run `snyk test`
  - [ ] Fix vulnerabilities

- [ ] **Manual Code Review**
  - [ ] Check: No API keys in logs
  - [ ] Check: All inputs validated
  - [ ] Check: No race conditions
  - [ ] Check: Tokens encrypted

- [ ] **Verify: 0 Critical/High Security Issues**

---

### TEST-021: Documentation (4-6h)

- [ ] **Write Test Documentation**
  - [ ] `docs/TESTING.md`: How to run tests
  - [ ] `docs/TEST_PATTERNS.md`: Common patterns
  - [ ] `docs/MOCKING.md`: How to mock APIs

- [ ] **Update README.md**
  - [ ] Add test coverage badge
  - [ ] Add test instructions
  - [ ] Add security audit status

- [ ] **Code Comments**
  - [ ] Add JSDoc to complex test helpers
  - [ ] Explain tricky test scenarios

---

### TEST-022: Final Verification (2-3h)

- [ ] **Run full test suite**
  ```bash
  npm test
  npm run test:integration
  npm run test:e2e:ios
  npm run test:e2e:android
  ```

- [ ] **Verify CI Pipeline**
  - [ ] Create final test PR
  - [ ] Verify: All tests pass
  - [ ] Verify: Coverage ≥80%
  - [ ] Verify: Security scan passes

- [ ] **Production-Ready Checklist**
  - [ ] ✅ 80% test coverage
  - [ ] ✅ 0 critical security issues
  - [ ] ✅ Tests run in CI
  - [ ] ✅ Documentation complete
  - [ ] ✅ Code reviewed

---

## 📊 Progress Tracking

### Week 1
- [ ] Sprint 1 complete (Security Critical)
- [ ] Coverage: 20%
- [ ] Critical issues: 0

### Week 2
- [ ] Sprint 2 complete (Test Infrastructure)
- [ ] Coverage: 20%
- [ ] CI working

### Week 3-4
- [ ] Sprint 3 complete (Core Unit Tests)
- [ ] Coverage: 60%

### Week 5
- [ ] Sprint 4 complete (Integration)
- [ ] Coverage: 70%
- [ ] All security issues fixed

### Week 6
- [ ] Sprint 5 complete (E2E)
- [ ] Coverage: 75%
- [ ] E2E tests passing

### Week 7
- [ ] Sprint 6 complete (Polish)
- [ ] Coverage: 80%
- [ ] Production-Ready ✅

---

## 🏆 Definition of Done

### For Each Task
- [ ] Code written & tested
- [ ] Tests written (if applicable)
- [ ] Code reviewed (1+ approver)
- [ ] No linter errors
- [ ] Documentation updated
- [ ] Merged to main

### For Each Sprint
- [ ] All tasks complete
- [ ] Sprint goal achieved
- [ ] Demo to team
- [ ] Retrospective done

### For Overall Project
- [ ] ≥80% test coverage
- [ ] 0 critical security issues
- [ ] All E2E tests passing
- [ ] CI pipeline green
- [ ] Documentation complete
- [ ] Production-Ready status

---

**Last Updated:** 5. Dezember 2025  
**Total Tasks:** 150+  
**Total Effort:** 88-122 Stunden  
**Target:** Production-Ready in 7 Wochen
