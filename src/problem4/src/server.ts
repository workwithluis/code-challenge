import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { correlationIdMiddleware } from './middleware/correlationId';
import resourceRoutes from './routes/resourceRoutes';
import { initializeDatabase } from './database/db';
import { log, morganStream } from './utils/logger';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(correlationIdMiddleware); // Add correlation ID to all requests
app.use(morgan('combined', { stream: morganStream })); // HTTP logging with Winston
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use(`${API_PREFIX}/resources`, resourceRoutes);

// Error handling middleware (should be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    await initializeDatabase();
    log.info('Database initialized successfully');
    
    app.listen(PORT, () => {
      log.info(`Server is running on port ${PORT}`, {
        port: PORT,
        apiPrefix: API_PREFIX,
        environment: process.env.NODE_ENV
      });
      log.info(`API endpoint: http://localhost:${PORT}${API_PREFIX}`);
      log.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    log.error('Failed to start server', error as Error);
    process.exit(1);
  }
};

startServer();

export default app;
