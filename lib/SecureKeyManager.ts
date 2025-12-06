/**
 * SecureKeyManager - Sichere Verwaltung von API-Keys
 * 
 * ✅ SICHERHEIT:
 * - Keys werden NICHT in globalThis gespeichert
 * - Closure-basierter privater Scope
 * - Keine Exposition über console.logs
 * - Key-Rotation ohne Downtime
 * 
 * @author k1w1-security-team
 * @version 1.0.0
 */

import type { AllAIProviders } from '../contexts/AIContext';

/**
 * Sichere Key-Verwaltung mit privatem Closure-Scope
 */
class SecureKeyManager {
  // ✅ PRIVAT: Keys sind NICHT über globalThis erreichbar
  private static keys = new Map<AllAIProviders, string[]>();
  
  /**
   * Setzt API-Keys für einen Provider
   * 
   * @param provider - Der AI-Provider (groq, gemini, etc.)
   * @param keys - Array von API-Keys (mehrere für Rotation)
   */
  static setKeys(provider: AllAIProviders, keys: string[]): void {
    if (!keys || keys.length === 0) {
      console.warn(`[SecureKeyManager] Keine Keys für ${provider} bereitgestellt`);
      this.keys.delete(provider);
      return;
    }
    
    // Filter leere Keys
    const validKeys = keys.filter(k => k && k.trim().length > 0);
    
    if (validKeys.length === 0) {
      console.warn(`[SecureKeyManager] Alle Keys für ${provider} sind leer`);
      this.keys.delete(provider);
      return;
    }
    
    this.keys.set(provider, validKeys);
    
    // ✅ SICHERHEIT: Keine Key-Details in Logs
    console.log(
      `[SecureKeyManager] ${validKeys.length} Key(s) für ${provider} gespeichert`
    );
  }
  
  /**
   * Gibt den aktuellen (ersten) API-Key für einen Provider zurück
   * 
   * @param provider - Der AI-Provider
   * @returns Der aktuelle API-Key oder null
   */
  static getCurrentKey(provider: AllAIProviders): string | null {
    const keys = this.keys.get(provider);
    return keys && keys.length > 0 ? keys[0] : null;
  }
  
  /**
   * Rotiert die API-Keys für einen Provider
   * (Verschiebt den ersten Key ans Ende)
   * 
   * @param provider - Der AI-Provider
   * @returns true wenn Rotation erfolgreich, false wenn nicht genug Keys
   */
  static rotateKey(provider: AllAIProviders): boolean {
    const keys = this.keys.get(provider);
    
    if (!keys || keys.length < 2) {
      console.warn(
        `[SecureKeyManager] Rotation für ${provider} nicht möglich: ` +
        `Mindestens 2 Keys erforderlich`
      );
      return false;
    }
    
    // Rotiere: [key1, key2, key3] -> [key2, key3, key1]
    const rotated = [...keys.slice(1), keys[0]];
    this.keys.set(provider, rotated);
    
    console.log(`[SecureKeyManager] Key für ${provider} rotiert`);
    return true;
  }
  
  /**
   * Gibt die Anzahl verfügbarer Keys für einen Provider zurück
   * 
   * @param provider - Der AI-Provider
   * @returns Anzahl der Keys
   */
  static getKeyCount(provider: AllAIProviders): number {
    const keys = this.keys.get(provider);
    return keys ? keys.length : 0;
  }
  
  /**
   * Prüft ob ein Provider konfigurierte Keys hat
   * 
   * @param provider - Der AI-Provider
   * @returns true wenn Keys vorhanden
   */
  static hasKeys(provider: AllAIProviders): boolean {
    return this.getKeyCount(provider) > 0;
  }
  
  /**
   * Entfernt alle Keys für einen Provider
   * 
   * @param provider - Der AI-Provider
   */
  static clearKeys(provider: AllAIProviders): void {
    this.keys.delete(provider);
    console.log(`[SecureKeyManager] Keys für ${provider} entfernt`);
  }
  
  /**
   * Entfernt alle Keys für alle Provider
   * (Nur für Tests/Logout verwenden)
   */
  static clearAllKeys(): void {
    this.keys.clear();
    console.log('[SecureKeyManager] Alle Keys entfernt');
  }
  
  /**
   * Gibt eine Liste aller Provider mit konfigurierten Keys zurück
   * (Nur für Debugging)
   */
  static getConfiguredProviders(): AllAIProviders[] {
    return Array.from(this.keys.keys());
  }
  
  /**
   * Verschiebt einen spezifischen Key an die erste Position (macht ihn aktiv)
   * 
   * @param provider - Der AI-Provider
   * @param keyIndex - Index des Keys der aktiv werden soll
   * @returns true wenn erfolgreich
   */
  static moveKeyToFront(provider: AllAIProviders, keyIndex: number): boolean {
    const keys = this.keys.get(provider);
    
    if (!keys || keyIndex < 0 || keyIndex >= keys.length) {
      console.warn(
        `[SecureKeyManager] Ungültiger Index ${keyIndex} für ${provider}`
      );
      return false;
    }
    
    if (keyIndex === 0) {
      // Bereits an erster Stelle
      return true;
    }
    
    const key = keys[keyIndex];
    const filtered = keys.filter((_, i) => i !== keyIndex);
    const reordered = [key, ...filtered];
    
    this.keys.set(provider, reordered);
    console.log(`[SecureKeyManager] Key #${keyIndex} für ${provider} aktiviert`);
    
    return true;
  }
}

export default SecureKeyManager;
