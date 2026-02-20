// lib/buildHistoryStorage.ts
// Build-Historie speichern und laden mit AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BuildHistoryEntry } from '../shared/types/build';
import { STORAGE_KEYS } from './storageKeys';
import { logger } from './logger';

const MAX_HISTORY_ENTRIES = 50; // Maximal 50 Einträge speichern

// Verhindert Log-Spam wenn die Historie während eines aktiven Pollings geleert wurde
const missingBuildWarned = new Set<string>();

/**
 * Lädt die Build-Historie aus dem Storage
 */
export const loadBuildHistory = async (): Promise<BuildHistoryEntry[]> => {
  try {
    const historyString = await AsyncStorage.getItem(STORAGE_KEYS.BUILD_HISTORY);
    if (!historyString) {
      return [];
    }
    
    const history = JSON.parse(historyString);
    if (!Array.isArray(history)) {
      logger.warn('[buildHistoryStorage] Ungültiges Format, leere Historie zurückgeben');
      return [];
    }
    
    logger.info(`📖 Build-Historie geladen: ${history.length} Einträge`);
    return history;
  } catch (error) {
    logger.error('❌ Fehler beim Laden der Build-Historie:', error);
    return [];
  }
};

/**
 * Speichert die Build-Historie ins Storage
 */
export const saveBuildHistory = async (history: BuildHistoryEntry[]): Promise<void> => {
  try {
    // Auf maximale Anzahl begrenzen (neueste zuerst)
    const trimmedHistory = history.slice(0, MAX_HISTORY_ENTRIES);
    const historyString = JSON.stringify(trimmedHistory);
    await AsyncStorage.setItem(STORAGE_KEYS.BUILD_HISTORY, historyString);
    logger.info(`💾 Build-Historie gespeichert: ${trimmedHistory.length} Einträge`);
  } catch (error) {
    logger.error('❌ Fehler beim Speichern der Build-Historie:', error);
    throw new Error('Build-Historie konnte nicht gespeichert werden');
  }
};

/**
 * Fügt einen neuen Build-Eintrag zur Historie hinzu
 */
export const addBuildToHistory = async (entry: BuildHistoryEntry): Promise<void> => {
  try {
    const history = await loadBuildHistory();
    
    // Prüfen ob bereits ein Eintrag mit dieser jobId existiert
    const existingIndex = history.findIndex(e => e.jobId === entry.jobId);
    
    if (existingIndex >= 0) {
      // Existierenden Eintrag aktualisieren
      history[existingIndex] = entry;
      logger.info(`📝 Build-Eintrag aktualisiert: Job #${entry.jobId}`);
    } else {
      // Neuen Eintrag am Anfang hinzufügen
      history.unshift(entry);
      logger.info(`➕ Neuer Build-Eintrag: Job #${entry.jobId}`);
    }
    
    await saveBuildHistory(history);
  } catch (error) {
    logger.error('❌ Fehler beim Hinzufügen zur Build-Historie:', error);
    throw error;
  }
};

/**
 * Aktualisiert einen bestehenden Build-Eintrag
 */
export const updateBuildInHistory = async (
  jobId: string,
  updates: Partial<BuildHistoryEntry>
): Promise<void> => {
  try {
    const history = await loadBuildHistory();
    const index = history.findIndex(e => e.jobId === jobId);
    
    if (index >= 0) {
      history[index] = { ...history[index], ...updates };
      await saveBuildHistory(history);
      logger.info(`📝 Build #${jobId} aktualisiert`);
    } else {
      // Häufiger Fall: User hat "Build-Historie löschen" gedrückt, während Polling noch läuft.
      // Dann kommen Update-Events rein, obwohl der Eintrag weg ist. Das ist kein Fehler.
      if (!missingBuildWarned.has(jobId)) {
        logger.warn(`[buildHistoryStorage] Build #${jobId} nicht in Historie gefunden (ignoriert)`);
        missingBuildWarned.add(jobId);
      }
      return;
    }
  } catch (error) {
    logger.error('❌ Fehler beim Aktualisieren der Build-Historie:', error);
    throw error;
  }
};

/**
 * Löscht einen Build-Eintrag aus der Historie
 */
export const deleteBuildFromHistory = async (jobId: string): Promise<void> => {
  try {
    const history = await loadBuildHistory();
    const filtered = history.filter(e => e.jobId !== jobId);
    
    if (filtered.length < history.length) {
      await saveBuildHistory(filtered);
      logger.info(`🗑️ Build #${jobId} aus Historie gelöscht`);
    }
  } catch (error) {
    logger.error('❌ Fehler beim Löschen aus Build-Historie:', error);
    throw error;
  }
};

/**
 * Löscht die gesamte Build-Historie
 */
export const clearBuildHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.BUILD_HISTORY);
    logger.info('🗑️ Build-Historie gelöscht');
  } catch (error) {
    logger.error('❌ Fehler beim Löschen der Build-Historie:', error);
    throw error;
  }
};

/**
 * Gibt die Anzahl der Builds pro Status zurück
 */
export const getBuildStats = async (): Promise<{
  total: number;
  success: number;
  failed: number;
  building: number;
}> => {
  const history = await loadBuildHistory();
  return {
    total: history.length,
    success: history.filter(e => e.status === 'success').length,
    failed: history.filter(e => e.status === 'failed' || e.status === 'error').length,
    building: history.filter(e => e.status === 'building' || e.status === 'queued').length,
  };
};
