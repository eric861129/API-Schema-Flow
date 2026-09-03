import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

const nodeGlobals = {
  Buffer: 'readonly',
  console: 'readonly',
  process: 'readonly',
  TextDecoder: 'readonly',
  TextEncoder: 'readonly',
  URL: 'readonly',
}

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.turbo/**', 'docs/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: nodeGlobals,
    },
  },
)
