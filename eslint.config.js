/**
 * ESLint flat configuration.
 *
 * Enforces the recommended rule set plus a handful of correctness- and
 * quality-focused rules, scoped correctly for Node (server) vs. browser
 * (client) globals. Formatting concerns are delegated to Prettier via
 * eslint-config-prettier so the two never conflict.
 */
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

const sharedRules = {
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'smart'],
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-implicit-coercion': ['warn', { boolean: false }],
  'no-console': 'off',
  'prefer-arrow-callback': 'warn',
  'object-shorthand': ['warn', 'properties'],
};

export default [
  { ignores: ['node_modules/**', 'coverage/**', 'docs/**'] },
  js.configs.recommended,
  {
    files: [
      'src/**/*.js',
      'api/**/*.js',
      'test/**/*.js',
      'e2e/**/*.mjs',
      'scripts/**/*.mjs',
      '*.config.js',
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: sharedRules,
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: sharedRules,
  },
  prettier,
];
