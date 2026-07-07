import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    fileParallelism: false,
    // The GAS integration suite boots Docker and runs via its own config
    // (npm run test:gas); keep it out of the default unit-test run.
    exclude: [...configDefaults.exclude, 'test/gas/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [...configDefaults.exclude, 'coverage']
    },
    setupFiles: ['.vite/setup-files.js']
  }
})
