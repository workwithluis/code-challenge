import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
import cluster from 'cluster';
import os from 'os';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { correlationIdMiddleware } from './middleware/correlationId';
import { connectionDrainer, connectionDrainingMiddleware } from './middleware/connectionDraining';
import resourceRoutes from './routes/resourceRoutes';
import { initializeDatabase, closeDatabase } from './database/db';
import { log, morganStream } from './utils/logger';

// Load environment variables
dotenv.config();

// Configuration
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '30000', 10);
const READINESS_PROBE_DELAY = parseInt(process.env.READINESS_PROBE_DELAY || '5000', 10);
const ENABLE_CLUSTERING = process.env.ENABLE_CLUSTERING === 'true';
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT || String(os.cpus().length), 10);

// Cluster management for multi-core utilization
if (ENABLE_CLUSTERING && cluster.isPrimary) {
  log.info(`Primary process ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < WORKER_COUNT; i++) {
    cluster.fork();
  }
  
  // Handle worker exits
  cluster.on('exit', (worker, code, signal) => {
    log.warn(`Worker ${worker.process.pid} died`, { code, signal });
    
    // Restart worker if not shutting down
    if (!signal || signal === 'SIGTERM') {
      log.info('Starting a new worker');
      cluster.fork();
    }
  });
  
  // Graceful shutdown for primary process
  const shutdown = () => {
    log.info('Primary process shutting down, terminating workers...');
    
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill('SIGTERM');
    }
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
} else {
  // Worker process or single process mode
  const app = express();
  let server: http.Server;
  let isShuttingDown = false;
  let isReady = false;

  // Middleware setup
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }));

  // Connection draining middleware - must be early in the chain
  app.use(connectionDrainingMiddleware);

  // Graceful shutdown middleware
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

  app.use(correlationIdMiddleware);
  app.use(morgan('combined', { stream: morganStream }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoints
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      pid: process.pid,
      isShuttingDown,
      activeRequests: connectionDrainer.getActiveRequestCount()
    });
  });

  // Kubernetes liveness probe
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

  // Kubernetes readiness probe
  app.get('/health/ready', (_req, res) => {
    if (!isReady || isShuttingDown) {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        isReady,
        isShuttingDown,
        activeRequests: connectionDrainer.getActiveRequestCount()
      });
      return;
    }
    
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      activeRequests: connectionDrainer.getActiveRequestCount()
    });
  });

  // Metrics endpoint for monitoring
  app.get('/metrics', (_req, res) => {
    res.json({
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      requests: {
        active: connectionDrainer.getActiveRequestCount(),
        details: connectionDrainer.getActiveRequests()
      },
      server: {
        isReady,
        isShuttingDown
      }
    });
  });

  // API Routes
  app.use(`${API_PREFIX}/resources`, resourceRoutes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Graceful shutdown handler
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      log.warn('Shutdown already in progress, ignoring signal', { signal });
      return;
    }

    log.info(`Worker ${process.pid} received ${signal}, starting graceful shutdown...`, {
      signal,
      activeRequests: connectionDrainer.getActiveRequestCount()
    });
    
    isShuttingDown = true;
    isReady = false;
    
    // Start connection draining
    connectionDrainer.startDraining();
    
    // Stop accepting new connections
    server.close(async () => {
      log.info('HTTP server closed');
      
      try {
        // Wait for active requests to complete
        await connectionDrainer.waitForRequestsToComplete(SHUTDOWN_TIMEOUT);
        
        // Close database connections
        await closeDatabase();
        log.info('Database connections closed');
        
        // Additional cleanup
        log.info('Worker graceful shutdown completed', { pid: process.pid });
        process.exit(0);
      } catch (error) {
        log.error('Error during graceful shutdown', error as Error);
        process.exit(1);
      }
    });
    
    // Force shutdown after timeout
    setTimeout(() => {
      log.error('Forced shutdown after timeout', {
        remainingRequests: connectionDrainer.getActiveRequestCount()
      });
      process.exit(1);
    }, SHUTDOWN_TIMEOUT + 5000); // Extra 5 seconds buffer
  };

  // Start server
  const startServer = async () => {
    try {
      await initializeDatabase();
      log.info('Database initialized');
      
      server = http.createServer(app);
      
      // Enable keep-alive with timeout
      server.keepAliveTimeout = 65000; // 65 seconds (higher than typical LB timeout)
      server.headersTimeout = 66000; // Slightly higher than keepAliveTimeout
      
      server.listen(PORT, () => {
        log.info(`Worker ${process.pid} listening on port ${PORT}`, {
          port: PORT,
          apiPrefix: API_PREFIX,
          environment: process.env.NODE_ENV,
          clustering: ENABLE_CLUSTERING
        });
        
        // Delay readiness for load balancer registration
        setTimeout(() => {
          isReady = true;
          log.info(`Worker ${process.pid} is ready to receive traffic`);
        }, READINESS_PROBE_DELAY);
      });
      
      // Register shutdown handlers
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      
      // Handle errors
      process.on('uncaughtException', (error) => {
        log.error('Uncaught exception', error);
        gracefulShutdown('uncaughtException');
      });
      
      process.on('unhandledRejection', (reason, promise) => {
        log.error('Unhandled rejection', { reason, promise });
      });
      
    } catch (error) {
      log.error('Failed to start server', error as Error);
      process.exit(1);
    }
  };

  startServer();
}
