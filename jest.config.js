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
      statements: 67,
      branches: 61,
      functions: 60,
      lines: 67,
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
      statements: 68,
      branches: 54,
      functions: 75,
      lines: 68,
    },
    './src/utils/logger.ts': {
      statements: 84,
      branches: 82,
      functions: 94,
      lines: 83,
    },
    './src/utils/masking.ts': {
      statements: 100,
      branches: 88,
      functions: 100,
      lines: 100,
    },
    './src/utils/errors.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/utils/env.ts': {
      statements: 80,
      branches: 100,
      functions: 60,
      lines: 87,
    },
    './src/__tests__/fixtures/mock-server.ts': {
      statements: 75,
      branches: 60,
      functions: 80,
      lines: 75,
    },
    './src/generate-types.ts': {
      statements: 80,
      branches: 75,
      functions: 90,
      lines: 80,
    },
  },
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './reports',
        filename: 'test-report.html',
        expand: true,
        pageTitle: '@slbdn/mcp-tester Test Report',
        hideIcon: true,
      },
    ],
  ],
  testTimeout: 30000,
};
