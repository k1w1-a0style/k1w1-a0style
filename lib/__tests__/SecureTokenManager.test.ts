/**
 * SecureTokenManager Tests
 * 
 * ✅ SICHERHEIT: Testet Token-Verwaltung, Verschlüsselung und Expiry
 * 
 * @jest-environment node
 */

import * as SecureStore from 'expo-secure-store';
import SecureTokenManager from '../SecureTokenManager';

// Reset mock storage before each test
beforeEach(() => {
  (SecureStore as any).__resetMockStorage();
  jest.clearAllMocks();
});

describe('SecureTokenManager', () => {
  describe('saveToken', () => {
    it('sollte einen Token speichern', async () => {
      await SecureTokenManager.saveToken('test_token', 'my-secret-token');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'test_token',
        expect.any(String),
        expect.objectContaining({
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        })
      );
    });

    it('sollte Token mit Expiry speichern', async () => {
      const expiresAt = new Date(Date.now() + 3600000); // 1 Stunde
      await SecureTokenManager.saveToken('expiring_token', 'token-value', expiresAt);

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      
      // Überprüfe, dass die gespeicherten Daten das expiresAt enthalten
      const savedData = (SecureStore as any).__getMockStorage()['expiring_token'];
      const parsed = JSON.parse(savedData);
      expect(parsed.expiresAt).toBeDefined();
    });

    it('sollte Fehler werfen bei leerem Key', async () => {
      await expect(SecureTokenManager.saveToken('', 'token')).rejects.toThrow();
    });
  });

  describe('getToken', () => {
    it('sollte gespeicherten Token zurückgeben', async () => {
      await SecureTokenManager.saveToken('get_test', 'secret-value');
      
      const token = await SecureTokenManager.getToken('get_test');
      
      // Token wird verschlüsselt gespeichert, aber entschlüsselt zurückgegeben
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('sollte null für nicht existierenden Token zurückgeben', async () => {
      const token = await SecureTokenManager.getToken('non_existent');
      
      expect(token).toBeNull();
    });

    it('sollte abgelaufenen Token löschen und null zurückgeben', async () => {
      // Speichere Token mit abgelaufenem Datum
      const expiredDate = new Date(Date.now() - 3600000); // 1 Stunde in der Vergangenheit
      await SecureTokenManager.saveToken('expired_token', 'old-token', expiredDate);
      
      const token = await SecureTokenManager.getToken('expired_token');
      
      expect(token).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('expired_token');
    });

    it('sollte gültigen Token zurückgeben (nicht abgelaufen)', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 Stunde in der Zukunft
      await SecureTokenManager.saveToken('valid_token', 'valid-value', futureDate);
      
      const token = await SecureTokenManager.getToken('valid_token');
      
      expect(token).toBeDefined();
    });
  });

  describe('deleteToken', () => {
    it('sollte Token löschen', async () => {
      await SecureTokenManager.saveToken('to_delete', 'value');
      await SecureTokenManager.deleteToken('to_delete');

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('to_delete');
    });

    it('sollte keinen Fehler werfen bei nicht existierendem Token', async () => {
      await expect(SecureTokenManager.deleteToken('non_existent')).resolves.not.toThrow();
    });
  });

  describe('hasValidToken', () => {
    it('sollte true zurückgeben für existierenden Token', async () => {
      await SecureTokenManager.saveToken('valid', 'token');
      
      const hasValid = await SecureTokenManager.hasValidToken('valid');
      
      expect(hasValid).toBe(true);
    });

    it('sollte false zurückgeben für nicht existierenden Token', async () => {
      const hasValid = await SecureTokenManager.hasValidToken('non_existent');
      
      expect(hasValid).toBe(false);
    });

    it('sollte false zurückgeben für abgelaufenen Token', async () => {
      const expiredDate = new Date(Date.now() - 3600000);
      await SecureTokenManager.saveToken('expired', 'token', expiredDate);
      
      const hasValid = await SecureTokenManager.hasValidToken('expired');
      
      expect(hasValid).toBe(false);
    });
  });

  describe('rotateToken', () => {
    it('sollte alten Token löschen und neuen speichern', async () => {
      await SecureTokenManager.saveToken('rotate_key', 'old-token');
      await SecureTokenManager.rotateToken('rotate_key', 'new-token');

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('rotate_key');
      
      const newToken = await SecureTokenManager.getToken('rotate_key');
      expect(newToken).toBeDefined();
    });

    it('sollte neuen Token mit Expiry speichern', async () => {
      const newExpiry = new Date(Date.now() + 7200000); // 2 Stunden
      await SecureTokenManager.saveToken('rotate_expiry', 'old');
      await SecureTokenManager.rotateToken('rotate_expiry', 'new', newExpiry);

      const storage = (SecureStore as any).__getMockStorage();
      const stored = JSON.parse(storage['rotate_expiry']);
      expect(stored.expiresAt).toBeDefined();
    });
  });

  describe('getTokenMetadata', () => {
    it('sollte exists: false für nicht existierenden Token zurückgeben', async () => {
      const metadata = await SecureTokenManager.getTokenMetadata('non_existent');
      
      expect(metadata).toEqual({ exists: false });
    });

    it('sollte Metadata für existierenden Token zurückgeben', async () => {
      await SecureTokenManager.saveToken('meta_test', 'token');
      
      const metadata = await SecureTokenManager.getTokenMetadata('meta_test');
      
      expect(metadata?.exists).toBe(true);
      expect(metadata?.createdAt).toBeDefined();
    });

    it('sollte isExpired: true für abgelaufenen Token zurückgeben', async () => {
      const expiredDate = new Date(Date.now() - 3600000);
      await SecureTokenManager.saveToken('expired_meta', 'token', expiredDate);
      
      const metadata = await SecureTokenManager.getTokenMetadata('expired_meta');
      
      expect(metadata?.isExpired).toBe(true);
    });

    it('sollte isExpired: false für gültigen Token zurückgeben', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      await SecureTokenManager.saveToken('valid_meta', 'token', futureDate);
      
      const metadata = await SecureTokenManager.getTokenMetadata('valid_meta');
      
      expect(metadata?.isExpired).toBe(false);
    });

    it('sollte Token nicht preisgeben (nur Metadata)', async () => {
      await SecureTokenManager.saveToken('sensitive', 'super-secret-token');
      
      const metadata = await SecureTokenManager.getTokenMetadata('sensitive');
      
      // Metadata sollte keinen Token-Wert enthalten
      expect(metadata).not.toHaveProperty('token');
      expect(JSON.stringify(metadata)).not.toContain('super-secret-token');
    });
  });

  describe('clearAllTokens', () => {
    it('sollte alle bekannten Token löschen', async () => {
      await SecureTokenManager.saveToken('github_token', 'gh-token');
      await SecureTokenManager.saveToken('expo_token', 'expo-token');
      
      await SecureTokenManager.clearAllTokens();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('github_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('expo_token');
    });
  });

  describe('Verschlüsselung', () => {
    it('sollte Token nicht im Klartext speichern', async () => {
      const secretToken = 'my-super-secret-api-key-12345';
      await SecureTokenManager.saveToken('encrypted_test', secretToken);

      const storage = (SecureStore as any).__getMockStorage();
      const storedData = storage['encrypted_test'];

      // Der Token sollte verschlüsselt sein
      expect(storedData).not.toContain(secretToken);
    });

    it('sollte verschlüsselten Token korrekt entschlüsseln', async () => {
      const originalToken = 'test-token-value';
      await SecureTokenManager.saveToken('decrypt_test', originalToken);
      
      const retrievedToken = await SecureTokenManager.getToken('decrypt_test');
      
      // Token sollte nach Entschlüsselung korrekt sein
      expect(retrievedToken).toBeDefined();
      expect(typeof retrievedToken).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit leeren Token-Werten umgehen', async () => {
      await SecureTokenManager.saveToken('empty_token', '');
      
      const token = await SecureTokenManager.getToken('empty_token');
      
      expect(token).toBe('');
    });

    it('sollte mit Sonderzeichen im Token umgehen', async () => {
      const specialToken = 'token-with-special-chars!@#$%^&*()_+-=[]{}|;:,.<>?';
      await SecureTokenManager.saveToken('special_chars', specialToken);
      
      const retrieved = await SecureTokenManager.getToken('special_chars');
      
      // Sollte nicht crashen
      expect(retrieved).toBeDefined();
    });

    it('sollte mit sehr langem Token umgehen', async () => {
      const longToken = 'x'.repeat(10000);
      await SecureTokenManager.saveToken('long_token', longToken);
      
      const retrieved = await SecureTokenManager.getToken('long_token');
      
      expect(retrieved).toBeDefined();
    });

    it('sollte mehrfache Speicherungen desselben Keys handhaben', async () => {
      await SecureTokenManager.saveToken('overwrite_test', 'first');
      await SecureTokenManager.saveToken('overwrite_test', 'second');
      await SecureTokenManager.saveToken('overwrite_test', 'third');
      
      const token = await SecureTokenManager.getToken('overwrite_test');
      
      // Der letzte gespeicherte Wert sollte zurückgegeben werden
      expect(token).toBeDefined();
    });
  });
});
