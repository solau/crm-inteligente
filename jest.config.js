const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Dir do projeto para o next/jest carregar as configurações e .env
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

module.exports = createJestConfig(customJestConfig);
