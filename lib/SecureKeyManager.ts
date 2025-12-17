/**
 * SecureKeyManager – sichere Verwaltung von API-Keys (Client-side)
 *
 * Ziele:
 * - Keys NICHT in globalThis
 * - Keine Key-Details in Logs
 * - Rotation ohne Downtime
 * - Weniger Log/Warning-Spam bei fehlenden Keys
 */

import type { AllAIProviders } from '../contexts/AIContext';

class SecureKeyManager {
  private static keys = new Map<AllAIProviders, string[]>();
  private static warnedEmpty = new Set<AllAIProviders>();

  static setKeys(provider: AllAIProviders, keys: string[]): void {
    const list = Array.isArray(keys) ? keys : [];
    const valid = list.map(k => (k ?? '').trim()).filter(k => k.length > 0);

    if (valid.length === 0) {
      this.keys.delete(provider);

      // nur einmal pro Provider warnen
      if (!this.warnedEmpty.has(provider)) {
        console.warn(`[SecureKeyManager] ⚠️ Keine Keys für Provider "${provider}" gesetzt`);
        this.warnedEmpty.add(provider);
      }
      return;
    }

    // sobald wieder Keys da sind: Warnflag reset
    this.warnedEmpty.delete(provider);

    this.keys.set(provider, valid);
  }

  static getCurrentKey(provider: AllAIProviders): string | null {
    const keys = this.keys.get(provider);
    return keys && keys.length > 0 ? keys[0] : null;
  }

  static rotateKey(provider: AllAIProviders): boolean {
    const keys = this.keys.get(provider);
    if (!keys || keys.length < 2) return false;

    const rotated = [...keys.slice(1), keys[0]];
    this.keys.set(provider, rotated);
    return true;
  }

  static getKeyCount(provider: AllAIProviders): number {
    return this.keys.get(provider)?.length ?? 0;
  }

  static hasKeys(provider: AllAIProviders): boolean {
    return this.getKeyCount(provider) > 0;
  }

  static clearKeys(provider: AllAIProviders): void {
    this.keys.delete(provider);
    this.warnedEmpty.delete(provider);
  }

  static clearAllKeys(): void {
    this.keys.clear();
    this.warnedEmpty.clear();
  }

  static getConfiguredProviders(): AllAIProviders[] {
    return Array.from(this.keys.keys());
  }

  static moveKeyToFront(provider: AllAIProviders, keyIndex: number): boolean {
    const keys = this.keys.get(provider);
    if (!keys || keyIndex < 0 || keyIndex >= keys.length) return false;
    if (keyIndex === 0) return true;

    const key = keys[keyIndex];
    const rest = keys.filter((_, i) => i !== keyIndex);
    this.keys.set(provider, [key, ...rest]);
    return true;
  }
}

export default SecureKeyManager;
