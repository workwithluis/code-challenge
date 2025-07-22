import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { correlationIdMiddleware } from './middleware/correlationId';
import resourceRoutes from './routes/resourceRoutes';
import { initializeDatabase, closeDatabase } from './database/db';
import { log, morganStream } from './utils/logger';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Graceful shutdown configuration
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '30000', 10); // 30 seconds default
const READINESS_PROBE_DELAY = parseInt(process.env.READINESS_PROBE_DELAY || '10000', 10); // 10 seconds default

// Server state management
let server: http.Server;
let isShuttingDown = false;
let isReady = false;
const activeConnections = new Set<any>();

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Graceful shutdown middleware - reject new requests during shutdown
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Server is shutting down',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  next();
});

app.use(correlationIdMiddleware); // Add correlation ID to all requests
app.use(morgan('combined', { stream: morganStream })); // HTTP logging with Winston
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check endpoints for Kubernetes/load balancers
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    isShuttingDown
  });
});

// Liveness probe - checks if the application is running
app.get('/health/live', (_req, res) => {
  if (isShuttingDown) {
    res.status(503).json({
      status: 'shutting_down',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
});

// Readiness probe - checks if the application is ready to receive traffic
app.get('/health/ready', (_req, res) => {
  if (!isReady || isShuttingDown) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      isReady,
      isShuttingDown
    });
    return;
  }
  
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    activeConnections: activeConnections.size
  });
});

// API Routes
app.use(`${API_PREFIX}/resources`, resourceRoutes);

// Error handling middleware (should be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Track active connections for graceful shutdown
const trackConnections = (server: http.Server) => {
  server.on('connection', (connection) => {
    activeConnections.add(connection);
    
    connection.on('close', () => {
      activeConnections.delete(connection);
    });
  });
};

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  log.info(`Received ${signal} signal, starting graceful shutdown...`, {
    signal,
    activeConnections: activeConnections.size
  });
  
  isShuttingDown = true;
  isReady = false;
  
  // Stop accepting new connections
  server.close(async () => {
    log.info('HTTP server closed, no longer accepting new connections');
    
    try {
      // Close database connections
      await closeDatabase();
      log.info('Database connections closed');
      
      // Perform any other cleanup
      log.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      log.error('Error during graceful shutdown', error as Error);
      process.exit(1);
    }
  });
  
  // Force close connections that are still active after timeout
  setTimeout(() => {
    log.warn('Shutdown timeout reached, forcing active connections to close', {
      remainingConnections: activeConnections.size
    });
    
    // Force close all active connections
    activeConnections.forEach((connection) => {
      connection.destroy();
    });
    
    // Force exit if server hasn't closed
    setTimeout(() => {
      log.error('Forced shutdown after timeout');
      process.exit(1);
    }, 1000);
  }, SHUTDOWN_TIMEOUT);
  
  // Send Connection: close header to active connections
  activeConnections.forEach((connection) => {
    connection.end();
  });
};

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();
    log.info('Database initialized successfully');
    
    // Create HTTP server
    server = http.createServer(app);
    
    // Track connections for graceful shutdown
    trackConnections(server);
    
    // Start listening
    server.listen(PORT, () => {
      log.info(`Server is running on port ${PORT}`, {
        port: PORT,
        apiPrefix: API_PREFIX,
        environment: process.env.NODE_ENV,
        shutdownTimeout: SHUTDOWN_TIMEOUT,
        readinessDelay: READINESS_PROBE_DELAY
      });
      log.info(`API endpoint: http://localhost:${PORT}${API_PREFIX}`);
      log.info(`Health check: http://localhost:${PORT}/health`);
      log.info(`Liveness probe: http://localhost:${PORT}/health/live`);
      log.info(`Readiness probe: http://localhost:${PORT}/health/ready`);
      
      // Mark server as ready after a delay (for load balancer registration)
      setTimeout(() => {
        isReady = true;
        log.info('Server is ready to receive traffic');
      }, READINESS_PROBE_DELAY);
    });
    
    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      log.error('Uncaught exception', error);
      gracefulShutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      log.error('Unhandled rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });
    
  } catch (error) {
    log.error('Failed to start server', error as Error);
    process.exit(1);
  }
};

// Start the server
startServer();

export { app, server };
