// Flat config. Type-checked rules run on the TypeScript sources and tests;
// plain JavaScript (the create-scampjs stub, this file) gets the base set.
// Fixtures are a user project, not our code, and are not linted.
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'packages/framework/fixtures/**',
      'coverage/**',
    ],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/explicit-function-return-type': 'error',
    },
  },
  prettier,
);
