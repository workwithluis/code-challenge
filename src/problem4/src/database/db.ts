import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { log } from '../utils/logger';

// Enable verbose mode for debugging
const sqlite = sqlite3.verbose();

// Database path from environment or default
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');

// Create database connection
export const db = new sqlite.Database(DB_PATH, (err: Error | null) => {
  if (err) {
    log.error('Error opening database', err);
  } else {
    log.info('Connected to SQLite database', { path: DB_PATH });
  }
});

// Promisify database methods for async/await support with proper typing
export const dbRun = promisify(db.run.bind(db)) as (sql: string, ...params: any[]) => Promise<any>;
export const dbGet = promisify(db.get.bind(db)) as (sql: string, ...params: any[]) => Promise<any>;
export const dbAll = promisify(db.all.bind(db)) as (sql: string, ...params: any[]) => Promise<any[]>;

// Initialize database schema
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Create resources table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for better query performance
    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
    `);
    
    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
    `);

    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_resources_created_at ON resources(created_at);
    `);

    // Create trigger to update updated_at timestamp
    await dbRun(`
      CREATE TRIGGER IF NOT EXISTS update_resources_timestamp 
      AFTER UPDATE ON resources
      BEGIN
        UPDATE resources SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    log.info('Database schema initialized successfully');
  } catch (error) {
    log.error('Error initializing database', error as Error);
    throw error;
  }
};

// Close database connection
export const closeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.close((err: Error | null) => {
      if (err) {
        reject(err);
      } else {
        log.info('Database connection closed');
        resolve();
      }
    });
  });
};

// Export database instance
export default db;
