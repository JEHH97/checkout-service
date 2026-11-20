module.exports = {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      collectCoverageFrom: ['src/domain/**/*.ts'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.spec.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
    },
  ],
  maxWorkers: 1,
  coverageThreshold: { global: { branches: 70, functions: 70, lines: 70, statements: 70 } },
};
