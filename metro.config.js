const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✅ Performance Optimizations
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_classnames: false, // Reduces bundle size
    keep_fnames: false,
    mangle: {
      keep_classnames: false,
      keep_fnames: false,
    },
    output: {
      ascii_only: true,
      quote_style: 3,
      wrap_iife: true,
    },
    sourceMap: {
      includeSources: false,
    },
    toplevel: false,
    compress: {
      drop_console: !__DEV__, // Remove console.logs in production
      reduce_funcs: true,
      reduce_vars: true,
      pure_funcs: ['console.log', 'console.info', 'console.debug'],
    },
  },
  // Enable inline requires for better performance
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true, // ✅ Improves startup time
    },
  }),
};

// ✅ Cache configuration for faster rebuilds
config.cacheStores = [
  {
    name: 'metro-cache',
    maxSize: 500 * 1024 * 1024, // 500 MB
  },
];

module.exports = config;
