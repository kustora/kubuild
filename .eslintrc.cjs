module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // Enforce architectural boundary for core: pure TS, zero React/DOM dependencies
      files: ['packages/core/**/*.ts'],
      rules: {
        'import/no-restricted-paths': [
          'error',
          {
            zones: [
              {
                target: './packages/core',
                from: './packages/renderer',
                message: '@kubuild/core must not depend on @kubuild/renderer',
              },
              {
                target: './packages/core',
                from: './packages/editor',
                message: '@kubuild/core must not depend on @kubuild/editor',
              },
              {
                target: './packages/core',
                from: './packages/react',
                message: '@kubuild/core must not depend on @kubuild/react',
              },
              {
                target: './packages/core',
                from: './apps',
                message: '@kubuild/core must not depend on apps',
              },
            ],
          },
        ],
        'no-restricted-imports': [
          'error',
          {
            paths: [
              { name: 'react', message: '@kubuild/core must remain framework-agnostic. No React allowed.' },
              { name: 'react-dom', message: '@kubuild/core must remain framework-agnostic. No ReactDOM allowed.' },
            ],
          },
        ],
      },
    },
  ],
};
