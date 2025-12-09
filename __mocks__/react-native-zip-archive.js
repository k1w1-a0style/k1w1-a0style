/**
 * Mock für react-native-zip-archive
 */

const zip = jest.fn().mockResolvedValue('/path/to/archive.zip');
const unzip = jest.fn().mockResolvedValue('/path/to/unzipped');

module.exports = {
  zip,
  unzip,
  __resetMockZipArchive: () => {
    zip.mockClear();
    unzip.mockClear();
  }
};
