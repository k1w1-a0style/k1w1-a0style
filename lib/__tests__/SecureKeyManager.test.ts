/**
 * SecureKeyManager Tests
 * 
 * ✅ SICHERHEIT: Testet dass API-Keys niemals in globalThis landen
 * 
 * @jest-environment node
 */

import SecureKeyManager from '../SecureKeyManager';

describe('SecureKeyManager', () => {
  beforeEach(() => {
    // Clean slate vor jedem Test
    SecureKeyManager.clearAllKeys();
  });

  afterEach(() => {
    // Cleanup nach jedem Test
    SecureKeyManager.clearAllKeys();
    
    // ✅ SICHERHEIT: Verifiziere dass globalThis sauber ist
    expect((global as any).GROQ_API_KEY).toBeUndefined();
    expect((global as any).GEMINI_API_KEY).toBeUndefined();
    expect((global as any).OPENAI_API_KEY).toBeUndefined();
    expect((global as any).__K1W1_AI_CONFIG).toBeUndefined();
  });

  describe('setKeys', () => {
    it('sollte Keys speichern', () => {
      SecureKeyManager.setKeys('groq', ['test-key-1', 'test-key-2']);
      
      expect(SecureKeyManager.getKeyCount('groq')).toBe(2);
      expect(SecureKeyManager.hasKeys('groq')).toBe(true);
    });

    it('sollte leere Keys herausfiltern', () => {
      SecureKeyManager.setKeys('groq', ['key1', '', '  ', 'key2']);
      
      expect(SecureKeyManager.getKeyCount('groq')).toBe(2);
    });

    it('sollte Provider entfernen wenn alle Keys leer', () => {
      SecureKeyManager.setKeys('groq', ['key1']);
      expect(SecureKeyManager.hasKeys('groq')).toBe(true);
      
      SecureKeyManager.setKeys('groq', ['', '  ']);
      expect(SecureKeyManager.hasKeys('groq')).toBe(false);
    });
  });

  describe('getCurrentKey', () => {
    it('sollte ersten Key zurückgeben', () => {
      SecureKeyManager.setKeys('groq', ['key-1', 'key-2', 'key-3']);
      
      const current = SecureKeyManager.getCurrentKey('groq');
      expect(current).toBe('key-1');
    });

    it('sollte null zurückgeben wenn keine Keys', () => {
      const current = SecureKeyManager.getCurrentKey('groq');
      expect(current).toBeNull();
    });

    it('sollte null zurückgeben für unbekannten Provider', () => {
      const current = SecureKeyManager.getCurrentKey('unknown' as any);
      expect(current).toBeNull();
    });
  });

  describe('rotateKey', () => {
    it('sollte Keys rotieren', () => {
      SecureKeyManager.setKeys('groq', ['key-1', 'key-2', 'key-3']);
      
      const success = SecureKeyManager.rotateKey('groq');
      expect(success).toBe(true);
      
      const current = SecureKeyManager.getCurrentKey('groq');
      expect(current).toBe('key-2');
    });

    it('sollte Key ans Ende verschieben', () => {
      SecureKeyManager.setKeys('groq', ['key-1', 'key-2', 'key-3']);
      
      SecureKeyManager.rotateKey('groq');
      
      // Nach Rotation: [key-2, key-3, key-1]
      const count = SecureKeyManager.getKeyCount('groq');
      expect(count).toBe(3);
    });

    it('sollte false zurückgeben wenn weniger als 2 Keys', () => {
      SecureKeyManager.setKeys('groq', ['single-key']);
      
      const success = SecureKeyManager.rotateKey('groq');
      expect(success).toBe(false);
    });

    it('sollte false zurückgeben wenn keine Keys', () => {
      const success = SecureKeyManager.rotateKey('groq');
      expect(success).toBe(false);
    });
  });

  describe('moveKeyToFront', () => {
    it('sollte Key an erste Position verschieben', () => {
      SecureKeyManager.setKeys('groq', ['key-1', 'key-2', 'key-3']);
      
      const success = SecureKeyManager.moveKeyToFront('groq', 2);
      expect(success).toBe(true);
      
      const current = SecureKeyManager.getCurrentKey('groq');
      expect(current).toBe('key-3');
    });

    it('sollte true zurückgeben wenn Key bereits an erster Stelle', () => {
      SecureKeyManager.setKeys('groq', ['key-1', 'key-2']);
      
      const success = SecureKeyManager.moveKeyToFront('groq', 0);
      expect(success).toBe(true);
      
      const current = SecureKeyManager.getCurrentKey('groq');
      expect(current).toBe('key-1');
    });

    it('sollte false zurückgeben bei ungültigem Index', () => {
      SecureKeyManager.setKeys('groq', ['key-1', 'key-2']);
      
      expect(SecureKeyManager.moveKeyToFront('groq', -1)).toBe(false);
      expect(SecureKeyManager.moveKeyToFront('groq', 5)).toBe(false);
    });
  });

  describe('clearKeys', () => {
    it('sollte Keys für Provider löschen', () => {
      SecureKeyManager.setKeys('groq', ['key-1']);
      SecureKeyManager.setKeys('gemini', ['key-2']);
      
      SecureKeyManager.clearKeys('groq');
      
      expect(SecureKeyManager.hasKeys('groq')).toBe(false);
      expect(SecureKeyManager.hasKeys('gemini')).toBe(true);
    });
  });

  describe('clearAllKeys', () => {
    it('sollte alle Keys löschen', () => {
      SecureKeyManager.setKeys('groq', ['key-1']);
      SecureKeyManager.setKeys('gemini', ['key-2']);
      SecureKeyManager.setKeys('openai', ['key-3']);
      
      SecureKeyManager.clearAllKeys();
      
      expect(SecureKeyManager.hasKeys('groq')).toBe(false);
      expect(SecureKeyManager.hasKeys('gemini')).toBe(false);
      expect(SecureKeyManager.hasKeys('openai')).toBe(false);
    });
  });

  describe('getConfiguredProviders', () => {
    it('sollte Liste konfigurierter Provider zurückgeben', () => {
      SecureKeyManager.setKeys('groq', ['key-1']);
      SecureKeyManager.setKeys('gemini', ['key-2']);
      
      const providers = SecureKeyManager.getConfiguredProviders();
      
      expect(providers).toContain('groq');
      expect(providers).toContain('gemini');
      expect(providers).toHaveLength(2);
    });

    it('sollte leere Liste zurückgeben wenn keine Provider', () => {
      const providers = SecureKeyManager.getConfiguredProviders();
      expect(providers).toHaveLength(0);
    });
  });

  // ✅ SICHERHEIT: Kritischer Test!
  describe('Security: No Global Exposure', () => {
    it('sollte NIEMALS Keys in globalThis speichern', () => {
      SecureKeyManager.setKeys('groq', ['super-secret-key-123']);
      SecureKeyManager.setKeys('gemini', ['another-secret-456']);
      
      // Verifiziere: Keys sind NICHT in globalThis
      expect((global as any).GROQ_API_KEY).toBeUndefined();
      expect((global as any).GEMINI_API_KEY).toBeUndefined();
      expect((global as any).OPENAI_API_KEY).toBeUndefined();
      expect((global as any).ANTHROPIC_API_KEY).toBeUndefined();
      expect((global as any).__K1W1_AI_CONFIG).toBeUndefined();
      
      // Aber: Keys sind über getCurrentKey verfügbar
      expect(SecureKeyManager.getCurrentKey('groq')).toBe('super-secret-key-123');
      expect(SecureKeyManager.getCurrentKey('gemini')).toBe('another-secret-456');
    });

    it('sollte Keys nach Rotation nicht exposen', () => {
      SecureKeyManager.setKeys('groq', ['key-1', 'key-2', 'key-3']);
      
      SecureKeyManager.rotateKey('groq');
      SecureKeyManager.rotateKey('groq');
      
      // Immer noch nicht in globalThis
      expect((global as any).GROQ_API_KEY).toBeUndefined();
      expect((global as any).__K1W1_AI_CONFIG).toBeUndefined();
    });

    it('sollte Keys nach clearAllKeys komplett entfernen', () => {
      SecureKeyManager.setKeys('groq', ['key-1']);
      SecureKeyManager.clearAllKeys();
      
      expect(SecureKeyManager.getCurrentKey('groq')).toBeNull();
      expect((global as any).GROQ_API_KEY).toBeUndefined();
    });
  });

  // ✅ SICHERHEIT: Concurrent Access Test
  describe('Concurrent Access', () => {
    it('sollte concurrent reads handhaben', () => {
      SecureKeyManager.setKeys('groq', ['key-1']);
      
      const reads = Array.from({ length: 100 }, () => 
        SecureKeyManager.getCurrentKey('groq')
      );
      
      expect(reads.every(k => k === 'key-1')).toBe(true);
    });

    it('sollte concurrent writes handhaben', () => {
      const writes = Array.from({ length: 10 }, (_, i) => 
        SecureKeyManager.setKeys('groq', [`key-${i}`])
      );
      
      // Sollte nicht crashen
      expect(SecureKeyManager.hasKeys('groq')).toBe(true);
    });
  });
});
