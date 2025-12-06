# Immediate Next Steps - Production-Ready Roadmap
**k1w1-a0style - Start Here!**

---

## 🎯 Mission

**Ziel:** Von aktueller Foundation zu Production-Ready  
**Timeline:** 7 Wochen (oder 1 Woche für Beta-Ready)  
**Team:** 1-2 Full-Stack Entwickler  

---

## 🚦 Decision Point: Welcher Weg?

### Option A: Quick Wins (Beta-Ready)
**Timeline:** 1 Woche  
**Effort:** 25-36 Stunden  
**Result:** ✅ Beta-Ready (kritische Security-Issues behoben)

### Option B: Full Plan (Production-Ready)
**Timeline:** 7 Wochen  
**Effort:** 88-122 Stunden  
**Result:** ✅ Production-Ready (80% Coverage, 0 Security Issues)

**Empfehlung:** Start mit Option A (Quick Wins), dann weitermachen mit Full Plan

---

## 📅 WEEK 1: Quick Wins (Option A)

### Monday (8h)

#### Morning: SEC-001 - API Keys (4h)

1. **Create `lib/SecureKeyManager.ts`** (2h)
```typescript
class SecureKeyManager {
  private static keys = new Map<AllAIProviders, string[]>();
  
  static setKeys(provider: AllAIProviders, keys: string[]) {
    this.keys.set(provider, keys);
  }
  
  static getCurrentKey(provider: AllAIProviders): string | null {
    const keys = this.keys.get(provider);
    return keys?.[0] ?? null;
  }
  
  static rotateKey(provider: AllAIProviders): boolean {
    const keys = this.keys.get(provider);
    if (!keys || keys.length < 2) return false;
    
    const rotated = [...keys.slice(1), keys[0]];
    this.keys.set(provider, rotated);
    return true;
  }
}
```

2. **Refactor `contexts/AIContext.tsx`** (1h)
   - Remove `updateRuntimeGlobals` (lines 306-342)
   - Replace with `SecureKeyManager.setKeys()`
   - Update all API key getters

3. **Refactor `lib/orchestrator.ts`** (1h)
   - Update `resolveApiKey()` to use SecureKeyManager
   - Remove all globalThis references
   - Remove API keys from console.logs

**Deliverable:** ✅ No more API keys in global scope

---

#### Afternoon: SEC-002 Part 1 - Input Validation Setup (4h)

1. **Install Zod** (5min)
```bash
npm install zod
```

2. **Create `lib/validators.ts`** (2h)
```typescript
import { z } from 'zod';

export const FilePathSchema = z.string()
  .min(1, 'Path cannot be empty')
  .max(255, 'Path too long')
  .regex(/^[a-zA-Z0-9_\-\/\.]+$/, 'Invalid characters in path')
  .refine(path => !path.includes('..'), 'Path traversal not allowed')
  .refine(path => !path.startsWith('/'), 'Absolute paths not allowed');

export const FileContentSchema = z.string()
  .max(10 * 1024 * 1024, 'File too large (max 10MB)');

export const GitHubRepoSchema = z.string()
  .regex(/^[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+$/, 'Invalid repo format');

export const ChatInputSchema = z.string()
  .min(1, 'Message cannot be empty')
  .max(10000, 'Message too long');
```

3. **Refactor `lib/fileWriter.ts`** (1.5h)
   - Add validation to `applyFilesToProject()`
   - Validate all incoming file paths and content
   - Add try-catch for validation errors

4. **Quick Test** (30min)
   - Manual test: Try creating file with `../` → should fail
   - Manual test: Try 20MB file → should fail

**Deliverable:** ✅ File operations validated

---

### Tuesday (8h)

#### Morning: SEC-002 Part 2 - Complete Validation (4h)

1. **Refactor `contexts/ProjectContext.tsx`** (2h)
   - Validate in `createFile()`
   - Validate in `renameFile()`
   - Add error handling with user-friendly messages

2. **Refactor `contexts/projectStorage.ts`** (2h)
   - Add validation to `readDirectoryRecursive()`
   - Enforce max file size (10MB per file)
   - Enforce max total files (1000)
   - Validate each imported file path

**Deliverable:** ✅ All file operations validated

---

#### Afternoon: SEC-003 - Token Encryption (4h)

1. **Create `lib/SecureTokenManager.ts`** (2h)
```typescript
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

class SecureTokenManager {
  private static SALT = 'k1w1-secure-v1';
  
  static async saveToken(key: string, token: string, expiresAt?: Date) {
    const encKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Constants.deviceId + this.SALT
    );
    
    // Simplified encryption (use crypto-js for production)
    const encrypted = Buffer.from(token).toString('base64');
    
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
    
    // Simplified decryption
    return Buffer.from(data.token, 'base64').toString('utf8');
  }
  
  static async deleteToken(key: string) {
    await SecureStore.deleteItemAsync(key);
  }
}
```

2. **Refactor `contexts/githubService.ts`** (1.5h)
   - Replace `saveGitHubToken` with `SecureTokenManager.saveToken`
   - Replace `getGitHubToken` with `SecureTokenManager.getToken`
   - Same for Expo tokens

3. **Add Migration** (30min)
   - One-time migration for existing users
   - Move old tokens to new encrypted format

**Deliverable:** ✅ Tokens encrypted at rest

---

### Wednesday (7h)

#### Morning: SEC-004 - Race Conditions (3h)

1. **Refactor `contexts/ProjectContext.tsx`** (2h)
```typescript
import { Mutex } from 'async-mutex';

// Inside ProjectProvider
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
      
      // Immediate save (no debounce for critical ops)
      saveProjectToStorage(finalProject).catch(console.error);
      
      return finalProject;
    });
  } finally {
    release();
  }
}, []);
```

2. **Test Race Conditions** (1h)
   - Manual test: Rapid file updates
   - Verify: No state inconsistencies

**Deliverable:** ✅ No race conditions in ProjectContext

---

#### Afternoon: TEST-001 - Jest Setup (4h)

1. **Install Dependencies** (15min)
```bash
npm install --save-dev \
  @testing-library/react-native@^12.4.0 \
  @testing-library/jest-native@^5.4.3 \
  jest@^29.7.0 \
  ts-jest@^29.1.1 \
  @types/jest@^29.5.11 \
  jest-expo@^50.0.1 \
  react-test-renderer@18.3.1
```

2. **Create Jest Config** (30min)
   - `jest.config.js` with coverage thresholds
   - `jest.setup.js` with mocks

3. **Create Mocks** (1h)
   - `__mocks__/@react-native-async-storage/async-storage.ts`
   - `__mocks__/expo-secure-store.ts`
   - `__mocks__/expo-file-system.ts`

4. **First Smoke Test** (15min)
```typescript
// __tests__/smoke.test.ts
describe('Smoke Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
});
```

5. **First Real Test** (2h)
```typescript
// lib/__tests__/SecureKeyManager.test.ts
import { SecureKeyManager } from '../SecureKeyManager';

describe('SecureKeyManager', () => {
  it('should never expose keys in globalThis', () => {
    SecureKeyManager.setKeys('groq', ['test-key']);
    
    // Verify not in global
    expect((global as any).GROQ_API_KEY).toBeUndefined();
    expect((global as any).__K1W1_AI_CONFIG).toBeUndefined();
  });
  
  it('should get current key', () => {
    SecureKeyManager.setKeys('groq', ['key-1', 'key-2']);
    
    const key = SecureKeyManager.getCurrentKey('groq');
    expect(key).toBe('key-1');
  });
  
  it('should rotate keys', () => {
    SecureKeyManager.setKeys('groq', ['key-1', 'key-2', 'key-3']);
    
    SecureKeyManager.rotateKey('groq');
    
    const key = SecureKeyManager.getCurrentKey('groq');
    expect(key).toBe('key-2');
  });
});
```

**Deliverable:** ✅ Jest runs, first test passes

---

### Thursday (8h)

#### All Day: TEST-002 - Core Tests (8h)

1. **`lib/__tests__/fileWriter.test.ts`** (2h)
```typescript
describe('FileWriter', () => {
  it('should reject path traversal', () => {
    const incoming = [{ path: '../../etc/passwd', content: 'hack' }];
    const result = applyFilesToProject([], incoming);
    expect(result.skipped).toContain('../../etc/passwd');
  });
  
  it('should create new files', () => {
    const incoming = [{ path: 'New.tsx', content: 'code' }];
    const result = applyFilesToProject([], incoming);
    expect(result.created).toContain('New.tsx');
  });
  
  it('should skip protected files', () => {
    const incoming = [{ path: 'package.json', content: 'malicious' }];
    const result = applyFilesToProject([], incoming);
    expect(result.skipped).toContain('package.json');
  });
});
```

2. **`utils/__tests__/chatUtils.test.ts`** (2h)
```typescript
describe('validateFilePath', () => {
  it('should accept valid paths', () => {
    const result = validateFilePath('components/Button.tsx');
    expect(result.valid).toBe(true);
  });
  
  it('should reject path traversal', () => {
    const result = validateFilePath('../../../etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('traversal');
  });
});
```

3. **`lib/__tests__/validators.test.ts`** (2h)
```typescript
import { FilePathSchema, FileContentSchema } from '../validators';

describe('Validators', () => {
  it('should validate file paths', () => {
    expect(() => FilePathSchema.parse('valid/path.tsx')).not.toThrow();
    expect(() => FilePathSchema.parse('../hack')).toThrow();
    expect(() => FilePathSchema.parse('/etc/passwd')).toThrow();
  });
  
  it('should enforce file size limit', () => {
    const smallFile = 'a'.repeat(1000);
    const largeFile = 'a'.repeat(11 * 1024 * 1024); // 11MB
    
    expect(() => FileContentSchema.parse(smallFile)).not.toThrow();
    expect(() => FileContentSchema.parse(largeFile)).toThrow();
  });
});
```

4. **Run Coverage** (1h)
```bash
npm run test:coverage
```

5. **Fix Failing Tests** (1h)

**Deliverable:** ✅ 10 tests passing, ~20% coverage

---

### Friday (5h)

#### Morning: Code Review & Cleanup (3h)

1. **Self Code Review** (1h)
   - Review all changes from Week 1
   - Check for any remaining console.logs with sensitive data
   - Verify error handling

2. **Documentation** (1h)
   - Update inline comments
   - Document breaking changes
   - Update CHANGELOG (if exists)

3. **Integration Testing** (1h)
   - Manual test: Full user flow
   - Create file → Edit → Save → Load
   - Verify: No crashes, good UX

**Deliverable:** ✅ Code clean and documented

---

#### Afternoon: Deploy & Celebrate (2h)

1. **Commit & Push** (30min)
```bash
git add .
git commit -m "Security: Fix critical issues (SEC-001 to SEC-004)

- Remove API keys from global scope
- Add input validation for all file operations
- Encrypt tokens at rest
- Fix race conditions with mutex
- Add Jest setup + 10 core tests

Coverage: 20%
Security: 3 critical issues fixed"

git push origin main
```

2. **Create PR** (30min)
   - Title: "🔐 Security Critical Fixes + Test Foundation"
   - Description: Link to COMPREHENSIVE_TEST_SECURITY_PLAN.md
   - Request review

3. **Update Status** (30min)
   - Update README.md with new status
   - Close related GitHub issues
   - Notify team

4. **Celebrate!** (30min) 🎉
   - App is now **Beta-Ready**
   - Critical security issues fixed
   - Test foundation established

**Deliverable:** ✅ Beta-Ready App!

---

## 📊 Week 1 Results

### Before Week 1
- ⚠️ Status: NOT production-ready
- 🔴 Security Issues: 11 (3 Critical)
- ❌ Test Coverage: 0%
- ❌ Tests: 0

### After Week 1
- ✅ Status: **Beta-Ready**
- 🟢 Security Issues: 8 (0 Critical)
- ✅ Test Coverage: ~20%
- ✅ Tests: 10+

### Impact
- **Security:** 3 critical vulnerabilities fixed
- **Foundation:** Test infrastructure ready
- **Risk:** Reduced by ~60%
- **Confidence:** Can now release Beta

---

## 🚀 WEEKS 2-7: Full Production-Ready (Option B)

### Week 2: Test Infrastructure
- Test helpers & utilities
- CI/CD integration (GitHub Actions)
- Mock setup complete
- **Target:** CI pipeline working

### Week 3-4: Core Unit Tests
- 60% coverage target
- All critical modules tested
- **Deliverable:** 50+ tests, 60% coverage

### Week 5: Integration + Security
- Integration tests
- Remaining security issues (SEC-005 to SEC-011)
- **Deliverable:** All security issues fixed

### Week 6: E2E Tests
- Detox setup
- Critical user flows tested
- **Deliverable:** E2E tests passing

### Week 7: Polish
- 80% coverage
- Final security audit
- Documentation complete
- **Deliverable:** ✅ Production-Ready

---

## 🎯 Key Milestones

| Week | Milestone | Status | Deliverable |
|------|-----------|--------|-------------|
| **1** | **Beta-Ready** | ✅ | Critical security fixed, 20% coverage |
| 2 | Test Foundation | 📋 | CI working, helpers ready |
| 3-4 | Core Coverage | 📋 | 60% coverage, 50+ tests |
| 5 | Security Complete | 📋 | 0 security issues |
| 6 | E2E Ready | 📋 | E2E tests passing |
| **7** | **Production-Ready** | 📋 | 80% coverage, fully audited |

---

## 📋 Daily Checklist Template

### Every Morning
- [ ] Review yesterday's progress
- [ ] Read today's tasks (see above)
- [ ] Setup work environment
- [ ] Pull latest code

### During Work
- [ ] Follow security guidelines (SECURITY_QUICK_REFERENCE.md)
- [ ] Write tests for new code
- [ ] Run tests frequently (`npm test`)
- [ ] Commit often (good commit messages)

### Every Evening
- [ ] Run full test suite
- [ ] Check coverage (`npm run test:coverage`)
- [ ] Push code
- [ ] Update progress (GitHub Projects, JIRA, etc.)

---

## 🆘 Troubleshooting

### "Tests won't run"
```bash
# Clear cache
npm cache clean --force
rm -rf node_modules
npm install

# Verify Jest
npx jest --version
```

### "Coverage too low"
```bash
# Identify untested code
npm run test:coverage -- --verbose

# Focus on critical modules first
# lib/ and contexts/ before components/
```

### "Validation breaking existing functionality"
```bash
# Check validation schemas are not too strict
# Add better error messages
# Consider migration path for existing data
```

### "Need help with specific security issue"
- Check: SECURITY_QUICK_REFERENCE.md
- Full details: COMPREHENSIVE_TEST_SECURITY_PLAN.md
- Ask team for code review

---

## 📞 Support & Questions

### Documentation
- **This file:** Immediate next steps
- **Full Plan:** [COMPREHENSIVE_TEST_SECURITY_PLAN.md](./COMPREHENSIVE_TEST_SECURITY_PLAN.md)
- **Checklist:** [TEST_SECURITY_CHECKLIST.md](./TEST_SECURITY_CHECKLIST.md)
- **Security Guide:** [SECURITY_QUICK_REFERENCE.md](./SECURITY_QUICK_REFERENCE.md)

### Getting Stuck?
1. Re-read relevant section in COMPREHENSIVE_TEST_SECURITY_PLAN.md
2. Check SECURITY_QUICK_REFERENCE.md for patterns
3. Ask team for help
4. Create GitHub issue if bug found

---

## ✅ Success Criteria

### Week 1 Success (Beta-Ready)
- [ ] SEC-001: API keys not in global scope
- [ ] SEC-002: All inputs validated
- [ ] SEC-003: Tokens encrypted
- [ ] SEC-004: Race conditions fixed
- [ ] TEST-001: Jest setup complete
- [ ] TEST-002: 10+ tests passing
- [ ] Coverage: ≥20%
- [ ] Manual testing: No critical bugs

### Full Success (Production-Ready, Week 7)
- [ ] Coverage: ≥80%
- [ ] Security Issues: 0 critical, 0 high
- [ ] Tests: 90+ passing
- [ ] E2E: All flows tested
- [ ] CI: Green pipeline
- [ ] Documentation: Complete
- [ ] Code Review: Approved
- [ ] Security Audit: Passed

---

**Created:** 5. Dezember 2025  
**Version:** 1.0  
**Status:** Ready to Start  
**First Task:** Monday Morning - SEC-001 (API Keys)

**Good luck! 🚀**
