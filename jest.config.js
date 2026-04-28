export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  cacheDirectory: '/tmp/mcp-tester-cache',
  maxWorkers: 1,
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
  ],
  // Per-file thresholds: individual files must stay above these floors
  // Overall thresholds: project-wide average must meet these minimums
  coverageThreshold: {
    global: {
      statements: 76,
      branches: 57,
      functions: 64,
      lines: 76,
    },
    './src/assert.ts': {
      statements: 96,
      branches: 87,
      functions: 100,
      lines: 96,
    },
    './src/matchers.ts': {
      statements: 68,
      branches: 28,
      functions: 42,
      lines: 64,
    },
    './src/client/MCPClient.ts': {
      statements: 66,
      branches: 53,
      functions: 75,
      lines: 66,
    },
    './src/utils/logger.ts': {
      statements: 81,
      branches: 45,
      functions: 54,
      lines: 81,
    },
    './src/utils/errors.ts': {
      statements: 73,
      branches: 0,
      functions: 66,
      lines: 73,
    },
    './src/utils/env.ts': {
      statements: 80,
      branches: 100,
      functions: 60,
      lines: 87,
    },
    './src/__tests__/fixtures/mock-server.ts': {
      statements: 96,
      branches: 64,
      functions: 94,
      lines: 96,
    },
  },
  testTimeout: 30000,
};
