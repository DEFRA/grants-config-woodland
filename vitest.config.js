import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    fileParallelism: false,
    // The Docker-based integration suites boot containers and run via their own
    // configs (npm run test:gas / test:agreements); keep them out of the
    // default unit-test run.
    exclude: [...configDefaults.exclude, 'test/gas/**', 'test/agreements/**'],
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
