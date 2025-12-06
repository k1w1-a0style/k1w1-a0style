/**
 * Mock für expo-crypto
 * 
 * Simuliert Crypto für Tests
 */

const Crypto = {
  digestStringAsync: jest.fn((algorithm, data) => 
    Promise.resolve('mocked-hash-' + data.substring(0, 10))
  ),
  
  CryptoDigestAlgorithm: {
    SHA1: 'SHA1',
    SHA256: 'SHA256',
    SHA384: 'SHA384',
    SHA512: 'SHA512',
    MD2: 'MD2',
    MD4: 'MD4',
    MD5: 'MD5',
  },
  
  getRandomBytesAsync: jest.fn((length) => 
    Promise.resolve(new Uint8Array(length))
  ),
};

module.exports = Crypto;
module.exports.default = Crypto;
module.exports.digestStringAsync = Crypto.digestStringAsync;
module.exports.CryptoDigestAlgorithm = Crypto.CryptoDigestAlgorithm;
module.exports.getRandomBytesAsync = Crypto.getRandomBytesAsync;
