// lib/__tests__/buildHistoryStorage.test.ts
// Tests für Build-Historie Storage

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadBuildHistory,
  saveBuildHistory,
  addBuildToHistory,
  updateBuildInHistory,
  deleteBuildFromHistory,
  clearBuildHistory,
  getBuildStats,
} from '../buildHistoryStorage';
import { BuildHistoryEntry } from '../../contexts/types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const BUILD_HISTORY_KEY = 'k1w1_build_history';

const createMockEntry = (overrides: Partial<BuildHistoryEntry> = {}): BuildHistoryEntry => ({
  id: 'test-id-1',
  jobId: 123,
  repoName: 'user/test-repo',
  status: 'success',
  startedAt: '2025-12-09T10:00:00.000Z',
  completedAt: '2025-12-09T10:05:00.000Z',
  durationMs: 300000,
  buildProfile: 'preview',
  ...overrides,
});

describe('buildHistoryStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadBuildHistory', () => {
    it('should return empty array when no history exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await loadBuildHistory();

      expect(result).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(BUILD_HISTORY_KEY);
    });

    it('should return parsed history from storage', async () => {
      const mockHistory = [createMockEntry()];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockHistory));

      const result = await loadBuildHistory();

      expect(result).toEqual(mockHistory);
    });

    it('should return empty array for invalid JSON', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');

      const result = await loadBuildHistory();

      expect(result).toEqual([]);
    });

    it('should return empty array for non-array data', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ not: 'array' }));

      const result = await loadBuildHistory();

      expect(result).toEqual([]);
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await loadBuildHistory();

      expect(result).toEqual([]);
    });
  });

  describe('saveBuildHistory', () => {
    it('should save history to AsyncStorage', async () => {
      const history = [createMockEntry()];
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await saveBuildHistory(history);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        BUILD_HISTORY_KEY,
        JSON.stringify(history)
      );
    });

    it('should trim history to max 50 entries', async () => {
      const history = Array.from({ length: 60 }, (_, i) => 
        createMockEntry({ id: `id-${i}`, jobId: i })
      );
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await saveBuildHistory(history);

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData).toHaveLength(50);
    });

    it('should throw on AsyncStorage error', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(saveBuildHistory([createMockEntry()])).rejects.toThrow(
        'Build-Historie konnte nicht gespeichert werden'
      );
    });
  });

  describe('addBuildToHistory', () => {
    it('should add new entry to beginning of history', async () => {
      const existingEntry = createMockEntry({ id: 'existing', jobId: 100 });
      const newEntry = createMockEntry({ id: 'new', jobId: 200 });
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([existingEntry]));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await addBuildToHistory(newEntry);

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData[0].jobId).toBe(200);
      expect(savedData[1].jobId).toBe(100);
    });

    it('should update existing entry with same jobId', async () => {
      const existingEntry = createMockEntry({ status: 'building' });
      const updatedEntry = createMockEntry({ status: 'success' });
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([existingEntry]));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await addBuildToHistory(updatedEntry);

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData).toHaveLength(1);
      expect(savedData[0].status).toBe('success');
    });
  });

  describe('updateBuildInHistory', () => {
    it('should update existing entry', async () => {
      const existingEntry = createMockEntry({ status: 'building' });
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([existingEntry]));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await updateBuildInHistory(123, { status: 'success', durationMs: 500000 });

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData[0].status).toBe('success');
      expect(savedData[0].durationMs).toBe(500000);
    });

    it('should not update if entry not found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([createMockEntry()]));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await updateBuildInHistory(999, { status: 'success' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('nicht in Historie gefunden')
      );
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('deleteBuildFromHistory', () => {
    it('should remove entry with matching jobId', async () => {
      const entries = [
        createMockEntry({ id: 'a', jobId: 100 }),
        createMockEntry({ id: 'b', jobId: 200 }),
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(entries));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await deleteBuildFromHistory(100);

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData).toHaveLength(1);
      expect(savedData[0].jobId).toBe(200);
    });

    it('should not modify history if entry not found', async () => {
      const entries = [createMockEntry()];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(entries));

      await deleteBuildFromHistory(999);

      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('clearBuildHistory', () => {
    it('should remove history from AsyncStorage', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      await clearBuildHistory();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(BUILD_HISTORY_KEY);
    });

    it('should throw on AsyncStorage error', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(clearBuildHistory()).rejects.toThrow();
    });
  });

  describe('getBuildStats', () => {
    it('should return correct stats for mixed history', async () => {
      const entries = [
        createMockEntry({ jobId: 1, status: 'success' }),
        createMockEntry({ jobId: 2, status: 'success' }),
        createMockEntry({ jobId: 3, status: 'failed' }),
        createMockEntry({ jobId: 4, status: 'error' }),
        createMockEntry({ jobId: 5, status: 'building' }),
        createMockEntry({ jobId: 6, status: 'queued' }),
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(entries));

      const stats = await getBuildStats();

      expect(stats).toEqual({
        total: 6,
        success: 2,
        failed: 2,  // failed + error
        building: 2, // building + queued
      });
    });

    it('should return zeros for empty history', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const stats = await getBuildStats();

      expect(stats).toEqual({
        total: 0,
        success: 0,
        failed: 0,
        building: 0,
      });
    });
  });
});
