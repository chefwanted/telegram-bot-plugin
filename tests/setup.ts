/**
 * Jest Test Setup
 */

import { jest } from '@jest/globals';

// Set test timeout
jest.setTimeout(10000);

// Mock console for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
  error: console.error,
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global teardown
afterAll(() => {
  // Any cleanup needed
});
