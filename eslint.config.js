import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'convex/_generated']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Route components intentionally start authenticated HTTP loads when they mount.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['convex/**/*.ts'],
    rules: {
      // Spotify and MusicBrainz return third-party JSON. Runtime guards and Convex
      // validators form the boundary for those payloads.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
