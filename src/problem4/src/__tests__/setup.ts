import { closeDatabase } from '../database/db';
import path from 'path';
import fs from 'fs';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

// Use a test database
const testDbPath = path.join(__dirname, '../../test.sqlite');

// Clean up test database before all tests
beforeAll(async () => {
  // Remove existing test database if it exists
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

// Clean up after all tests
afterAll(async () => {
  await closeDatabase();
  
  // Remove test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

// Suppress console logs during tests unless explicitly needed
if (process.env.NODE_ENV === 'test' && !process.env.SHOW_LOGS) {
  global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}
