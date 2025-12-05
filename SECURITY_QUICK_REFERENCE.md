# Security Quick Reference Guide
**k1w1-a0style - Developer Cheat Sheet**

---

## 🚨 Security Rules (MUST FOLLOW)

### Rule #1: Never expose API keys
```typescript
// ❌ WRONG
console.log('API Key:', apiKey);
(global as any).API_KEY = key;
throw new Error(`Failed with key ${key}`);

// ✅ RIGHT
console.log('API Key: [REDACTED]');
// Keep keys in closure or class private fields
console.error('API call failed (key rotation applied)');
```

### Rule #2: Always validate input
```typescript
// ❌ WRONG
const createFile = (path: string) => {
  fs.write(path, content); // Path traversal!
};

// ✅ RIGHT
import { FilePathSchema } from './validators';

const createFile = (path: string) => {
  const validated = FilePathSchema.parse(path); // Throws if invalid
  fs.write(validated, content);
};
```

### Rule #3: Sanitize all user content
```typescript
// ❌ WRONG
<Text>{userInput}</Text> // XSS risk if HTML rendering

// ✅ RIGHT
import DOMPurify from 'isomorphic-dompurify';
<Text>{DOMPurify.sanitize(userInput)}</Text>
```

### Rule #4: Use SecureStore for sensitive data
```typescript
// ❌ WRONG
await AsyncStorage.setItem('token', githubToken);

// ✅ RIGHT
await SecureStore.setItemAsync('token', githubToken, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
});
```

### Rule #5: Check for race conditions
```typescript
// ❌ WRONG
const updateState = () => {
  const newValue = state.value + 1;
  setState(newValue); // Race condition!
};

// ✅ RIGHT
import { Mutex } from 'async-mutex';
const mutex = new Mutex();

const updateState = async () => {
  const release = await mutex.acquire();
  try {
    setState(prev => prev + 1);
  } finally {
    release();
  }
};
```

---

## 🔒 Secure Coding Patterns

### File Operations

```typescript
import { z } from 'zod';

// Define strict schemas
const FilePathSchema = z.string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_\-\/\.]+$/)
  .refine(path => !path.includes('..'), 'No path traversal')
  .refine(path => !path.startsWith('/'), 'No absolute paths');

const FileContentSchema = z.string()
  .max(10 * 1024 * 1024); // 10MB max

// Use in functions
export const createFile = async (path: string, content: string) => {
  // Validate first
  const validPath = FilePathSchema.parse(path);
  const validContent = FileContentSchema.parse(content);
  
  // Check protected files
  if (PROTECTED_FILES.has(validPath)) {
    throw new Error('Cannot modify protected file');
  }
  
  // Proceed with operation
  await fs.write(validPath, validContent);
};
```

### API Key Management

```typescript
// lib/SecureKeyManager.ts
class SecureKeyManager {
  private static keys = new Map<string, string[]>();
  
  // Private - never expose directly
  static setKeys(provider: string, keys: string[]) {
    this.keys.set(provider, keys);
  }
  
  // Public - safe getter
  static getCurrentKey(provider: string): string | null {
    const keys = this.keys.get(provider);
    return keys?.[0] ?? null;
  }
  
  // Rotation without exposing keys
  static rotateKey(provider: string): boolean {
    const keys = this.keys.get(provider);
    if (!keys || keys.length < 2) return false;
    
    const rotated = [...keys.slice(1), keys[0]];
    this.keys.set(provider, rotated);
    return true;
  }
}
```

### Token Storage with Encryption

```typescript
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

class SecureTokenManager {
  private static SALT = 'your-app-salt'; // Store securely
  
  static async saveToken(key: string, token: string, expiresAt?: Date) {
    // Generate device-specific encryption key
    const encKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Constants.deviceId + this.SALT
    );
    
    // Encrypt token (implement with crypto-js or native)
    const encrypted = await this.encrypt(token, encKey);
    
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
    
    const encKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Constants.deviceId + this.SALT
    );
    
    return await this.decrypt(data.token, encKey);
  }
  
  static async deleteToken(key: string) {
    await SecureStore.deleteItemAsync(key);
  }
  
  private static async encrypt(text: string, key: string): Promise<string> {
    // Implement with crypto-js or expo-crypto
    // This is pseudocode
    return CryptoJS.AES.encrypt(text, key).toString();
  }
  
  private static async decrypt(encrypted: string, key: string): Promise<string> {
    // Implement with crypto-js or expo-crypto
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}
```

### Rate Limiting

```typescript
import { RateLimiter } from 'limiter';

// Create limiters per provider
const rateLimiters = {
  groq: new RateLimiter({ 
    tokensPerInterval: 10, 
    interval: 'minute' 
  }),
  gemini: new RateLimiter({ 
    tokensPerInterval: 5, 
    interval: 'minute' 
  }),
};

export async function callAPI(provider: string) {
  const limiter = rateLimiters[provider];
  
  // Check rate limit
  const allowed = await limiter.removeTokens(1);
  if (!allowed) {
    throw new Error('Rate limit exceeded. Please wait 1 minute.');
  }
  
  // Proceed with API call
  return await fetch(apiUrl);
}
```

### Preventing Race Conditions

```typescript
import { Mutex } from 'async-mutex';

class StateManager {
  private mutex = new Mutex();
  private state: any;
  
  async updateState(updater: (prev: any) => any) {
    // Acquire lock
    const release = await this.mutex.acquire();
    
    try {
      // Atomic update
      const updated = updater(this.state);
      this.state = updated;
      
      // Save to storage
      await this.persist(updated);
      
      return updated;
    } finally {
      // Always release
      release();
    }
  }
  
  private async persist(state: any) {
    await AsyncStorage.setItem('state', JSON.stringify(state));
  }
}
```

---

## 🛡️ Security Checklist for Code Review

### For Every PR

- [ ] **No secrets in code**
  - No API keys
  - No passwords
  - No tokens
  - Check git history too!

- [ ] **All inputs validated**
  - User input
  - API responses
  - File operations
  - URL parameters

- [ ] **Sensitive data encrypted**
  - Tokens in SecureStore
  - Additional encryption for high-value data
  - Check device-rooted scenarios

- [ ] **No race conditions**
  - Concurrent updates use mutex
  - State updates are atomic
  - Storage writes are serialized

- [ ] **Error handling secure**
  - No sensitive data in error messages
  - No stack traces to user
  - Proper logging (sanitized)

- [ ] **Dependencies updated**
  - Run `npm audit`
  - Fix vulnerabilities
  - Check Snyk/Dependabot alerts

---

## 🚫 Common Vulnerabilities to Avoid

### 1. Path Traversal
```typescript
// ❌ VULNERABLE
const readFile = (filename: string) => {
  return fs.read(`/app/data/${filename}`);
};
// User input: "../../../../etc/passwd"

// ✅ SAFE
const readFile = (filename: string) => {
  const validated = FilePathSchema.parse(filename);
  const safePath = path.normalize(`/app/data/${validated}`);
  
  // Verify still in allowed directory
  if (!safePath.startsWith('/app/data/')) {
    throw new Error('Invalid path');
  }
  
  return fs.read(safePath);
};
```

### 2. Code Injection
```typescript
// ❌ VULNERABLE
const executeCode = (code: string) => {
  eval(code); // Never use eval!
};

// ✅ SAFE
// Don't execute user code at all
// If needed, use sandboxed environments like VM2
```

### 3. XSS (Cross-Site Scripting)
```typescript
// ❌ VULNERABLE
<WebView 
  source={{ html: userContent }} // XSS!
/>

// ✅ SAFE
import DOMPurify from 'isomorphic-dompurify';

<WebView 
  source={{ html: DOMPurify.sanitize(userContent) }}
/>
```

### 4. SQL Injection
```typescript
// ❌ VULNERABLE (if using SQL)
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ SAFE
const query = supabase
  .from('users')
  .select('*')
  .eq('id', userId); // Parameterized query
```

### 5. Insecure Randomness
```typescript
// ❌ WEAK
const token = Math.random().toString(36);

// ✅ STRONG
import { v4 as uuidv4 } from 'uuid';
import * as Crypto from 'expo-crypto';

const token = uuidv4(); // or
const randomBytes = await Crypto.getRandomBytesAsync(32);
```

---

## 🔍 Security Testing

### Test for Path Traversal
```typescript
describe('Security: Path Traversal', () => {
  it('should reject path traversal attempts', () => {
    const attacks = [
      '../../etc/passwd',
      '..\\..\\windows\\system32',
      'folder/../../../hack',
    ];
    
    attacks.forEach(path => {
      expect(() => createFile(path, 'content')).toThrow();
    });
  });
});
```

### Test for XSS
```typescript
describe('Security: XSS Prevention', () => {
  it('should sanitize XSS payloads', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
    ];
    
    xssPayloads.forEach(payload => {
      const sanitized = DOMPurify.sanitize(payload);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror');
    });
  });
});
```

### Test for Race Conditions
```typescript
describe('Security: Race Conditions', () => {
  it('should handle concurrent updates safely', async () => {
    const updates = Array.from({ length: 100 }, (_, i) => 
      updateState(prev => ({ count: prev.count + 1 }))
    );
    
    await Promise.all(updates);
    
    // Should be exactly 100
    expect(getState().count).toBe(100);
  });
});
```

---

## 📚 Resources

### Must-Read Security Guides
- [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/)
- [React Native Security Best Practices](https://reactnative.dev/docs/security)
- [Expo Security](https://docs.expo.dev/guides/security/)

### Security Tools
- **Snyk:** `npm install -g snyk && snyk test`
- **npm audit:** `npm audit --audit-level=moderate`
- **ESLint Security:** `eslint-plugin-security`

### Reporting Security Issues
If you discover a security vulnerability:
1. **DO NOT** open a public GitHub issue
2. Email: security@k1w1.app (or your security contact)
3. Include: Description, Steps to Reproduce, Impact
4. Wait for response before disclosure

---

## 🎓 Security Training

### For All Developers
1. Complete OWASP Mobile Security course
2. Read this guide monthly
3. Review security in every PR
4. Report suspicious code immediately

### For Security Champion
1. Weekly security scan of codebase
2. Monthly dependency audit
3. Quarterly penetration test
4. Keep this guide updated

---

**Last Updated:** 5. Dezember 2025  
**Version:** 1.0  
**Maintained by:** Security Team
