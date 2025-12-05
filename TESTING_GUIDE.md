# Testing Guide
**k1w1-a0style - Wie man Tests schreibt und ausführt**

---

## 🚀 Quick Start

### Installation

```bash
# Dependencies installieren
npm install

# Test-Dependencies sind bereits in package.json
# Sie werden automatisch mit npm install installiert
```

### Ersten Test ausführen

```bash
# Alle Tests ausführen
npm test

# Tests im Watch-Mode (für Development)
npm run test:watch

# Tests mit Coverage-Report
npm run test:coverage

# Verbose Output (für Debugging)
npm run test:verbose
```

---

## 📁 Datei-Struktur

```
k1w1-a0style/
├── __tests__/              # Top-Level Tests (Smoke, Integration)
│   └── smoke.test.ts       # ✅ Basis-Funktionalität
├── lib/
│   ├── __tests__/          # Unit Tests für lib/
│   │   ├── SecureKeyManager.test.ts   # ✅ 16 Tests
│   │   └── validators.test.ts         # ✅ 40+ Tests
│   ├── SecureKeyManager.ts
│   └── validators.ts
├── __mocks__/              # Jest Mocks
│   ├── @react-native-async-storage/
│   │   └── async-storage.js
│   ├── expo-secure-store.js
│   └── expo-file-system.js
├── jest.config.js          # ✅ Jest Konfiguration
├── jest.setup.js           # ✅ Test Setup
└── package.json            # ✅ Test Scripts
```

---

## 📝 Test schreiben

### Unit Test Template

```typescript
/**
 * MyModule Tests
 * 
 * @jest-environment node
 */

import { myFunction } from '../MyModule';

describe('MyModule', () => {
  // Setup vor jedem Test
  beforeEach(() => {
    // Reset state, clear mocks, etc.
  });

  // Cleanup nach jedem Test
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('myFunction', () => {
    it('sollte korrekt funktionieren', () => {
      const result = myFunction('input');
      expect(result).toBe('expected output');
    });

    it('sollte Fehler bei ungültigem Input werfen', () => {
      expect(() => myFunction('')).toThrow('Fehler-Nachricht');
    });
  });
});
```

### Async Test Template

```typescript
describe('Async Operations', () => {
  it('sollte Promise korrekt handhaben', async () => {
    const result = await asyncFunction();
    expect(result).toBe('expected');
  });

  it('sollte Promise-Rejection fangen', async () => {
    await expect(failingFunction()).rejects.toThrow('Error message');
  });
});
```

### Mock Template

```typescript
describe('Mit Mocks', () => {
  it('sollte externe API mocken', async () => {
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'mocked' })
    });

    const result = await fetchData();
    
    expect(fetch).toHaveBeenCalledWith('https://api.example.com');
    expect(result).toEqual({ data: 'mocked' });
  });
});
```

---

## 🎯 Best Practices

### 1. Test-Naming

```typescript
// ✅ GUT: Beschreibend und klar
it('sollte User speichern wenn alle Felder valide sind', () => {});

// ❌ SCHLECHT: Zu vage
it('sollte funktionieren', () => {});
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('sollte User-Alter berechnen', () => {
  // Arrange: Setup
  const birthDate = new Date('1990-01-01');
  
  // Act: Ausführen
  const age = calculateAge(birthDate);
  
  // Assert: Verifizieren
  expect(age).toBeGreaterThan(30);
});
```

### 3. Test-Isolation

```typescript
// ✅ GUT: Jeder Test ist unabhängig
describe('UserService', () => {
  let service: UserService;
  
  beforeEach(() => {
    service = new UserService(); // Fresh instance
  });
  
  afterEach(() => {
    service.cleanup(); // Cleanup
  });
});
```

### 4. Testing Security

```typescript
// ✅ WICHTIG: Security-kritische Funktionen IMMER testen
describe('Security: API Key Management', () => {
  it('sollte Keys NIEMALS in globalThis speichern', () => {
    SecureKeyManager.setKeys('groq', ['secret-key']);
    
    // Verifiziere: Nicht in globalThis
    expect((global as any).GROQ_API_KEY).toBeUndefined();
  });
});
```

---

## 📊 Coverage

### Coverage-Report generieren

```bash
# Coverage-Report erstellen
npm run test:coverage

# Report öffnen (im Browser)
open coverage/lcov-report/index.html
```

### Coverage-Thresholds

Konfiguriert in `jest.config.js`:

```javascript
coverageThresholds: {
  global: {
    statements: 60,  // 60% aller Statements
    branches: 50,    // 50% aller Branches
    functions: 60,   // 60% aller Funktionen
    lines: 60,       // 60% aller Zeilen
  },
  './lib/': {
    statements: 70,  // Höhere Thresholds für lib/
  },
}
```

### Coverage erhöhen

1. **Ungetestete Dateien finden:**
   ```bash
   npm run test:coverage
   # Schaue in coverage/lcov-report/index.html
   ```

2. **Tests für ungetestete Module schreiben:**
   ```bash
   # Erstelle Test-Datei
   touch lib/__tests__/MyModule.test.ts
   ```

3. **Coverage verifizieren:**
   ```bash
   npm run test:coverage
   ```

---

## 🔧 Troubleshooting

### Problem: "Cannot find module"

```bash
# Lösung: Cache clearen
npm run test:clear
npm install
npm test
```

### Problem: "Tests timeout"

```typescript
// Lösung: Timeout erhöhen
it('long running test', async () => {
  // Test code
}, 60000); // 60 Sekunden timeout
```

### Problem: "Mock funktioniert nicht"

```typescript
// Lösung: Mock vor Import definieren
jest.mock('@react-native-async-storage/async-storage');
import AsyncStorage from '@react-native-async-storage/async-storage';

// ODER: Mock in jest.setup.js verschieben
```

### Problem: "Async Test schlägt fehl"

```typescript
// ✅ GUT: await verwenden
it('async test', async () => {
  await asyncFunction();
  expect(result).toBe('expected');
});

// ❌ SCHLECHT: await vergessen
it('async test', () => {
  asyncFunction(); // Kein await!
  expect(result).toBe('expected'); // Fails!
});
```

---

## 🎓 Weiterführende Ressourcen

### Dokumentation
- [Jest Docs](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

### Unsere Docs
- [COMPREHENSIVE_TEST_SECURITY_PLAN.md](./COMPREHENSIVE_TEST_SECURITY_PLAN.md) - Vollständiger Test-Plan
- [SECURITY_QUICK_REFERENCE.md](./SECURITY_QUICK_REFERENCE.md) - Security Testing Patterns
- [TEST_SECURITY_CHECKLIST.md](./TEST_SECURITY_CHECKLIST.md) - Task Checklist

---

## 📈 Test-Metriken

### Aktueller Status

| Kategorie | Tests | Coverage |
|-----------|-------|----------|
| **Smoke Tests** | 10+ | 100% |
| **SecureKeyManager** | 16 | ~95% |
| **Validators** | 40+ | ~90% |
| **GESAMT** | **66+** | **~20%** |

### Ziel (Woche 7)

| Kategorie | Target |
|-----------|--------|
| **Unit Tests** | 90+ |
| **Integration Tests** | 20+ |
| **E2E Tests** | 5+ |
| **Coverage** | 80% |

---

## ✅ Checkliste für neue Tests

Bevor du einen Pull Request erstellst:

- [ ] Alle Tests laufen durch (`npm test`)
- [ ] Coverage ist ≥60% (`npm run test:coverage`)
- [ ] Neue Features haben Tests
- [ ] Security-kritische Funktionen haben Tests
- [ ] Tests sind dokumentiert (Kommentare)
- [ ] Keine `console.log()` in Tests (außer für Debugging)
- [ ] Mocks werden korrekt aufgeräumt (afterEach)
- [ ] Tests sind unabhängig voneinander

---

## 🚨 CI/CD Integration

Tests laufen automatisch bei:
- ✅ Jedem Push zu `main`
- ✅ Jedem Pull Request
- ✅ Vor jedem Merge

Falls Tests fehlschlagen:
1. Logs in GitHub Actions checken
2. Lokal reproduzieren: `npm test`
3. Fehler fixen
4. Re-push

---

**Fragen?** Siehe [COMPREHENSIVE_TEST_SECURITY_PLAN.md](./COMPREHENSIVE_TEST_SECURITY_PLAN.md)

**Last Updated:** 5. Dezember 2025  
**Version:** 1.0  
**Status:** ✅ Ready to Test!
