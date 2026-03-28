import { importProjectFromZipFile } from '../infra/storage/projectPersistence';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  default: {
    cacheDirectory: 'file:///cache/',
    getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
    deleteAsync: jest.fn().mockResolvedValue(undefined),
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  },
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-zip-archive', () => ({
  unzip: jest.fn().mockResolvedValue('/unzipped'),
  zip: jest.fn(),
}));

jest.mock('../infra/storage/persistenceHelpers', () => {
  const actual = jest.requireActual('../infra/storage/persistenceHelpers');
  return {
    ...actual,
    readDirectoryRecursive: jest.fn(),
  };
});

jest.mock('../lib/validators', () => {
  const actual = jest.requireActual('../lib/validators');
  return {
    ...actual,
    validateZipImport: jest.fn(),
  };
});

describe('projectPersistence ZIP import contract', () => {
  const DocumentPicker = require('expo-document-picker');
  const helpers = require('../infra/storage/persistenceHelpers');
  const validators = require('../lib/validators');
  const zipArchive = require('react-native-zip-archive');
  const FileSystem = require('expo-file-system/legacy');

  beforeEach(() => {
    jest.clearAllMocks();
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/test.zip', name: 'test.zip', size: 1024 }],
    });
  });

  it('fails as strict all-or-nothing when validator reports invalid files', async () => {
    helpers.readDirectoryRecursive.mockResolvedValue([
      { path: 'components/A.tsx', content: 'ok' },
      { path: '../../../etc/passwd', content: 'bad' },
    ]);

    validators.validateZipImport.mockReturnValue({
      valid: false,
      validFiles: [{ path: 'components/A.tsx', content: 'ok' }],
      invalidFiles: [{ path: '../../../etc/passwd', reason: 'Pfad enthält ungültige Segmente' }],
      errors: ['ZIP enthält ungültige Dateien (strict all-or-nothing)'],
    });

    let thrownMessage = '';
    try {
      await importProjectFromZipFile();
    } catch (error) {
      thrownMessage = error instanceof Error ? error.message : String(error);
    }

    expect(thrownMessage).toMatch(/strikter Import, keine Teilübernahme/i);
    expect(thrownMessage).not.toMatch(/übersprungen/i);
  });

  it('rejects oversized ZIPs before unzip', async () => {
    const tooLargeBytes = 26 * 1024 * 1024;
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/large.zip', name: 'large.zip', size: tooLargeBytes }],
    });

    let thrownMessage = '';
    try {
      await importProjectFromZipFile();
    } catch (error) {
      thrownMessage = error instanceof Error ? error.message : String(error);
    }

    expect(thrownMessage).toMatch(/zu groß für den Import vor dem Entpacken/i);
    expect(zipArchive.unzip).not.toHaveBeenCalled();
    expect(helpers.readDirectoryRecursive).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
  });
});
