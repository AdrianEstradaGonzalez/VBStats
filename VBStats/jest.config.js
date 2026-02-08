module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      // Don't type-check tests for speed
      diagnostics: false,
    }],
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vector-icons|@react-native-async-storage|react-native-iap|react-native-svg|react-native-fs)/)',
  ],
  setupFiles: ['<rootDir>/tests/helpers/setup.ts'],
};
