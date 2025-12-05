/**
 * Mock für expo-file-system
 * 
 * Simuliert FileSystem für Tests
 */

let mockFileSystem = {};

const FileSystem = {
  // Encoding Types
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },

  // Mock filesystem paths
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
  bundleDirectory: 'file:///mock/bundle/',

  // Read file
  readAsStringAsync: jest.fn((fileUri, options) => {
    return new Promise((resolve, reject) => {
      const content = mockFileSystem[fileUri];
      if (content === undefined) {
        reject(new Error(`File not found: ${fileUri}`));
        return;
      }
      resolve(content);
    });
  }),

  // Write file
  writeAsStringAsync: jest.fn((fileUri, contents, options) => {
    return new Promise((resolve) => {
      mockFileSystem[fileUri] = contents;
      resolve();
    });
  }),

  // Delete file/directory
  deleteAsync: jest.fn((fileUri, options) => {
    return new Promise((resolve) => {
      // Delete file or all files with this prefix (directory)
      Object.keys(mockFileSystem).forEach((key) => {
        if (key.startsWith(fileUri)) {
          delete mockFileSystem[key];
        }
      });
      resolve();
    });
  }),

  // Get file info
  getInfoAsync: jest.fn((fileUri, options) => {
    return new Promise((resolve) => {
      const exists = mockFileSystem[fileUri] !== undefined;
      resolve({
        exists,
        isDirectory: false,
        uri: fileUri,
        size: exists ? mockFileSystem[fileUri].length : 0,
        modificationTime: Date.now(),
      });
    });
  }),

  // Make directory
  makeDirectoryAsync: jest.fn((fileUri, options) => {
    return new Promise((resolve) => {
      // In mock: just mark as created
      mockFileSystem[fileUri + '/'] = '__DIRECTORY__';
      resolve();
    });
  }),

  // Read directory
  readDirectoryAsync: jest.fn((fileUri) => {
    return new Promise((resolve) => {
      // Return all files/directories in this path
      const items = Object.keys(mockFileSystem)
        .filter((key) => key.startsWith(fileUri) && key !== fileUri)
        .map((key) => key.replace(fileUri, '').split('/')[0])
        .filter((item, index, self) => self.indexOf(item) === index && item !== '');
      resolve(items);
    });
  }),

  // Copy file
  copyAsync: jest.fn((options) => {
    return new Promise((resolve, reject) => {
      const { from, to } = options;
      if (mockFileSystem[from] === undefined) {
        reject(new Error(`Source file not found: ${from}`));
        return;
      }
      mockFileSystem[to] = mockFileSystem[from];
      resolve();
    });
  }),

  // Move file
  moveAsync: jest.fn((options) => {
    return new Promise((resolve, reject) => {
      const { from, to } = options;
      if (mockFileSystem[from] === undefined) {
        reject(new Error(`Source file not found: ${from}`));
        return;
      }
      mockFileSystem[to] = mockFileSystem[from];
      delete mockFileSystem[from];
      resolve();
    });
  }),

  // Helper für Tests
  __getMockFileSystem: () => mockFileSystem,
  __setMockFileSystem: (fs) => {
    mockFileSystem = fs;
  },
  __resetMockFileSystem: () => {
    mockFileSystem = {};
  },
};

module.exports = FileSystem;
module.exports.default = FileSystem;
module.exports.EncodingType = FileSystem.EncodingType;
module.exports.documentDirectory = FileSystem.documentDirectory;
module.exports.cacheDirectory = FileSystem.cacheDirectory;
module.exports.readAsStringAsync = FileSystem.readAsStringAsync;
module.exports.writeAsStringAsync = FileSystem.writeAsStringAsync;
module.exports.deleteAsync = FileSystem.deleteAsync;
module.exports.getInfoAsync = FileSystem.getInfoAsync;
module.exports.makeDirectoryAsync = FileSystem.makeDirectoryAsync;
module.exports.readDirectoryAsync = FileSystem.readDirectoryAsync;
