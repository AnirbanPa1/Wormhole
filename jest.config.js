module.exports = {
  preset: '@react-native/jest-preset',
  testTimeout: 15000,
  transform: {
    '^.+\\.(js|mjs|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|lucide-react-native|react-native-svg)/)',
  ],
};
