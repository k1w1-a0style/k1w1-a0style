module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // ✅ Performance: Inline environment variables at build time
      [
        'transform-inline-environment-variables',
        {
          include: [
            'NODE_ENV',
            'EXPO_PUBLIC_SUPABASE_URL',
            'EXPO_PUBLIC_SUPABASE_ANON_KEY',
          ],
        },
      ],
      // Reanimated plugin (must be last)
      'react-native-reanimated/plugin',
    ],
    env: {
      production: {
        plugins: [
          // ✅ Remove console statements in production
          ['transform-remove-console', { exclude: ['error', 'warn'] }],
        ],
      },
    },
  };
};
