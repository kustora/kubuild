import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: '@kubuild/core must remain framework-agnostic. No React allowed.' },
            { name: 'react-dom', message: '@kubuild/core must remain framework-agnostic. No ReactDOM allowed.' },
            { name: '@kubuild/renderer', message: '@kubuild/core must not depend on @kubuild/renderer' },
            { name: '@kubuild/editor', message: '@kubuild/core must not depend on @kubuild/editor' },
            { name: '@kubuild/react', message: '@kubuild/core must not depend on @kubuild/react' },
          ],
        },
      ],
    },
  },
];
