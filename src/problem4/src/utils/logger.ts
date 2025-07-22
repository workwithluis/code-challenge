import { AsyncLocalStorage } from 'async_hooks';
import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Create AsyncLocalStorage instance for correlation ID
export const asyncLocalStorage = new AsyncLocalStorage<{ correlationId: string }>();

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, correlationId, ...metadata }) => {
    // Get correlation ID from AsyncLocalStorage if not provided
    const store = asyncLocalStorage.getStore();
    const finalCorrelationId = correlationId || store?.correlationId || 'no-correlation-id';
    
    let msg = `${timestamp} [${finalCorrelationId}] ${level}: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    return msg;
  })
);

// Console transport for development
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    logFormat
  )
});

// File transport for all logs
const fileTransport = new DailyRotateFile({
  filename: path.join(__dirname, '../../logs/app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat
});

// File transport for error logs
const errorFileTransport = new DailyRotateFile({
  filename: path.join(__dirname, '../../logs/error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error',
  format: logFormat
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    consoleTransport,
    fileTransport,
    errorFileTransport
  ],
  // Don't exit on handled exceptions
  exitOnError: false
});

// Create a wrapper that automatically includes correlation ID
export const log = {
  info: (message: string, metadata?: any) => {
    const store = asyncLocalStorage.getStore();
    logger.info(message, { correlationId: store?.correlationId, ...metadata });
  },
  error: (message: string, error?: Error | any, metadata?: any) => {
    const store = asyncLocalStorage.getStore();
    logger.error(message, { 
      correlationId: store?.correlationId, 
      error: error?.message || error,
      stack: error?.stack,
      ...metadata 
    });
  },
  warn: (message: string, metadata?: any) => {
    const store = asyncLocalStorage.getStore();
    logger.warn(message, { correlationId: store?.correlationId, ...metadata });
  },
  debug: (message: string, metadata?: any) => {
    const store = asyncLocalStorage.getStore();
    logger.debug(message, { correlationId: store?.correlationId, ...metadata });
  },
  http: (message: string, metadata?: any) => {
    const store = asyncLocalStorage.getStore();
    logger.http(message, { correlationId: store?.correlationId, ...metadata });
  }
};

// Stream for Morgan HTTP logger
export const morganStream = {
  write: (message: string) => {
    log.http(message.trim());
  }
};

export default logger;
