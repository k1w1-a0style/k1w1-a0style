import { importProjectFromZipFile } from '../infra/storage/projectPersistence';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  default: {
    cacheDirectory: 'file:///cache/',
    deleteAsync: jest.fn().mockResolvedValue(undefined),
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  },
  cacheDirectory: 'file:///cache/',
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

  beforeEach(() => {
    jest.clearAllMocks();
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/test.zip', name: 'test.zip' }],
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
});
