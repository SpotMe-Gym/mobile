// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*', '.expo/*', 'node_modules/*', 'coverage/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Project rules (.cursor/rules, .agent/rules) enforced mechanically.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Image', 'FlatList', 'Animated', 'TouchableOpacity'],
              message:
                'Use expo-image, @shopify/flash-list, react-native-reanimated and Pressable (or components/ui) instead.',
            },
            { name: 'moment', message: 'Use Intl / utils/date instead.' },
          ],
        },
      ],
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['warn', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Noisy with i18next/zustand default instances.
      'import/no-named-as-default-member': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'jest.setup.js', 'jest.global-setup.js', 'scripts/**'],
    rules: { 'no-console': 'off' },
  },
]);
