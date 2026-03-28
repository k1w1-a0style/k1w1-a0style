import { readDirectoryRecursive } from '../infra/storage/persistenceHelpers';
import { Validators } from '../lib/validators';

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  default: {
    EncodingType: { UTF8: 'utf8', Base64: 'base64' },
    readDirectoryAsync: jest.fn(),
    getInfoAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
  },
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
  readDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

describe('readDirectoryRecursive', () => {
  const FileSystem = require('expo-file-system/legacy');
  const maxFiles = Validators.constants.MAX_FILES_IN_ZIP;

  beforeEach(() => {
    jest.clearAllMocks();

    FileSystem.readDirectoryAsync.mockImplementation(async (uri: string) => {
      if (uri === 'root/') return ['a'];
      if (uri === 'root/a/') return ['b'];
      if (uri === 'root/a/b/') {
        return Array.from({ length: maxFiles + 1 }, (_, i) => `f${i}.ts`);
      }
      return [];
    });

    FileSystem.getInfoAsync.mockImplementation(async (uri: string) => {
      const isDirectory = uri.endsWith('/a') || uri.endsWith('/b');
      return {
        exists: true,
        isDirectory,
        uri,
        size: isDirectory ? undefined : 10,
      };
    });

    FileSystem.readAsStringAsync.mockResolvedValue('export const x = 1;');
  });

  it('enforces the max file limit globally across nested folders', async () => {
    await expect(readDirectoryRecursive('root/')).rejects.toThrow(
      `ZIP enthält zu viele Dateien (max ${maxFiles})`,
    );
  });
});
