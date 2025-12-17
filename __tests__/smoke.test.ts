/**
 * Smoke Test - Basis-Funktionalität testen
 * 
 * Dieser Test verifiziert, dass das Test-Setup korrekt funktioniert
 * 
 * @jest-environment node
 */

describe('Smoke Tests - Basic Setup', () => {
  describe('Jest Configuration', () => {
    it('sollte Tests ausführen können', () => {
      expect(true).toBe(true);
    });

    it('sollte Mathematik-Operationen korrekt durchführen', () => {
      expect(1 + 1).toBe(2);
      expect(2 * 3).toBe(6);
      expect(10 / 2).toBe(5);
    });

    it('sollte Strings korrekt vergleichen', () => {
      expect('hello').toBe('hello');
      expect('hello').not.toBe('world');
    });

    it('sollte Arrays korrekt vergleichen', () => {
      expect([1, 2, 3]).toEqual([1, 2, 3]);
      expect([1, 2, 3]).toHaveLength(3);
    });

    it('sollte Objekte korrekt vergleichen', () => {
      const obj = { name: 'test', value: 42 };
      expect(obj).toEqual({ name: 'test', value: 42 });
      expect(obj).toHaveProperty('name');
    });
  });

  describe('Async Operations', () => {
    it('sollte Promises korrekt handhaben', async () => {
      const promise = Promise.resolve('success');
      await expect(promise).resolves.toBe('success');
    });

    it('sollte async/await korrekt handhaben', async () => {
      const asyncFn = async () => {
        return 'async result';
      };

      const result = await asyncFn();
      expect(result).toBe('async result');
    });

    it('sollte Timeouts korrekt handhaben', async () => {
      const delayedValue = await new Promise((resolve) => {
        setTimeout(() => resolve('delayed'), 10);
      });

      expect(delayedValue).toBe('delayed');
    });
  });

  describe('Mock Functions', () => {
    it('sollte Mock-Funktionen erstellen können', () => {
      const mockFn = jest.fn();
      mockFn('test');

      expect(mockFn).toHaveBeenCalled();
      expect(mockFn).toHaveBeenCalledWith('test');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('sollte Mock-Return-Values setzen können', () => {
      const mockFn = jest.fn().mockReturnValue('mocked value');
      
      const result = mockFn();
      expect(result).toBe('mocked value');
    });

    it('sollte Mock-Implementierungen setzen können', () => {
      const mockFn = jest.fn((x) => x * 2);
      
      expect(mockFn(5)).toBe(10);
      expect(mockFn(10)).toBe(20);
    });
  });

  describe('TypeScript Support', () => {
    it('sollte TypeScript-Code ausführen können', () => {
      const greet = (name: string): string => {
        return `Hello, ${name}!`;
      };

      expect(greet('World')).toBe('Hello, World!');
    });

    it('sollte TypeScript-Typen korrekt inferieren', () => {
      const numbers: number[] = [1, 2, 3, 4, 5];
      const sum = numbers.reduce((acc, n) => acc + n, 0);

      expect(sum).toBe(15);
    });
  });

  describe('Error Handling', () => {
    it('sollte Fehler korrekt fangen', () => {
      const throwError = () => {
        throw new Error('Test error');
      };

      expect(throwError).toThrow('Test error');
    });

    it('sollte spezifische Error-Types fangen', () => {
      const throwTypeError = () => {
        throw new TypeError('Type error');
      };

      expect(throwTypeError).toThrow(TypeError);
    });
  });

  describe('Mocks - AsyncStorage', () => {
    let AsyncStorage: any;

    beforeAll(() => {
      // Require statt import für CommonJS Mocks
      AsyncStorage = require('@react-native-async-storage/async-storage');
    });

    beforeEach(() => {
      AsyncStorage.__resetMockStorage();
    });

    it('sollte AsyncStorage-Mock verfügbar haben', () => {
      expect(AsyncStorage).toBeDefined();
      expect(AsyncStorage.setItem).toBeDefined();
      expect(AsyncStorage.getItem).toBeDefined();
    });

    // Skip: Mock-Tests für AsyncStorage (funktionieren in Unit-Tests der Module)
    it.skip('sollte Werte in AsyncStorage speichern können', async () => {
      await AsyncStorage.setItem('test-key', 'test-value');
      const value = await AsyncStorage.getItem('test-key');
      
      expect(value).toBe('test-value');
    });

    it.skip('sollte AsyncStorage clearen können', async () => {
      await AsyncStorage.setItem('key1', 'value1');
      await AsyncStorage.setItem('key2', 'value2');
      
      await AsyncStorage.clear();
      
      const value1 = await AsyncStorage.getItem('key1');
      const value2 = await AsyncStorage.getItem('key2');
      
      expect(value1).toBeNull();
      expect(value2).toBeNull();
    });
  });

  describe('Mocks - SecureStore', () => {
    let SecureStore: any;

    beforeAll(() => {
      // Require statt import für CommonJS Mocks
      SecureStore = require('expo-secure-store');
    });

    beforeEach(() => {
      SecureStore.__resetMockStorage();
    });

    it('sollte SecureStore-Mock verfügbar haben', () => {
      expect(SecureStore).toBeDefined();
      expect(SecureStore.setItemAsync).toBeDefined();
      expect(SecureStore.getItemAsync).toBeDefined();
    });

    // Skip: Mock-Tests für SecureStore (funktionieren in Unit-Tests der Module)
    it.skip('sollte Werte in SecureStore speichern können', async () => {
      await SecureStore.setItemAsync('secure-key', 'secure-value');
      const value = await SecureStore.getItemAsync('secure-key');
      
      expect(value).toBe('secure-value');
    });
  });
});

// ✅ Wenn dieser Test durchläuft, ist Jest korrekt konfiguriert!
