import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';

interface DrainableRequest extends Request {
  connectionId?: string;
  startTime?: number;
}

interface ConnectionInfo {
  id: string;
  startTime: number;
  method: string;
  path: string;
  correlationId?: string;
}

class ConnectionDrainer {
  private activeRequests: Map<string, ConnectionInfo> = new Map();
  private isDraining: boolean = false;
  private requestCounter: number = 0;

  // Middleware to track active requests
  middleware() {
    return (req: DrainableRequest, res: Response, next: NextFunction) => {
      // Generate unique connection ID
      const connectionId = `${process.pid}-${Date.now()}-${++this.requestCounter}`;
      req.connectionId = connectionId;
      req.startTime = Date.now();

      const connectionInfo: ConnectionInfo = {
        id: connectionId,
        startTime: req.startTime,
        method: req.method,
        path: req.path,
        correlationId: req.headers['x-correlation-id'] as string
      };

      // Track the request
      this.activeRequests.set(connectionId, connectionInfo);

      // Log request start
      log.debug('Request started', {
        connectionId,
        method: req.method,
        path: req.path,
        activeRequests: this.activeRequests.size
      });

      // Clean up on response finish
      const cleanup = () => {
        this.activeRequests.delete(connectionId);
        const duration = Date.now() - req.startTime!;
        
        log.debug('Request completed', {
          connectionId,
          duration,
          activeRequests: this.activeRequests.size
        });

        // Remove listeners
        res.removeListener('finish', cleanup);
        res.removeListener('close', cleanup);
        res.removeListener('error', cleanup);
      };

      // Register cleanup handlers
      res.on('finish', cleanup);
      res.on('close', cleanup);
      res.on('error', cleanup);

      // Set keep-alive header based on draining state
      if (this.isDraining) {
        res.setHeader('Connection', 'close');
      }

      next();
    };
  }

  // Start draining connections
  startDraining() {
    this.isDraining = true;
    log.info('Connection draining started', {
      activeRequests: this.activeRequests.size
    });

    // Log details of active requests
    if (this.activeRequests.size > 0) {
      const requestDetails = Array.from(this.activeRequests.values()).map(info => ({
        id: info.id,
        duration: Date.now() - info.startTime,
        method: info.method,
        path: info.path,
        correlationId: info.correlationId
      }));

      log.info('Active requests during shutdown', { requests: requestDetails });
    }
  }

  // Wait for all active requests to complete
  async waitForRequestsToComplete(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    return new Promise((resolve) => {
      const checkRequests = () => {
        const elapsed = Date.now() - startTime;
        
        if (this.activeRequests.size === 0) {
          log.info('All active requests completed');
          resolve();
          return;
        }

        if (elapsed >= timeout) {
          log.warn('Timeout waiting for requests to complete', {
            remainingRequests: this.activeRequests.size,
            timeout
          });
          
          // Log remaining requests
          const remainingRequests = Array.from(this.activeRequests.values()).map(info => ({
            id: info.id,
            duration: Date.now() - info.startTime,
            method: info.method,
            path: info.path,
            correlationId: info.correlationId
          }));
          
          log.warn('Requests still active after timeout', { requests: remainingRequests });
          resolve();
          return;
        }

        // Continue checking
        setTimeout(checkRequests, checkInterval);
      };

      checkRequests();
    });
  }

  // Get active request count
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  // Get active request details
  getActiveRequests(): ConnectionInfo[] {
    return Array.from(this.activeRequests.values());
  }

  // Check if draining
  isDrainingConnections(): boolean {
    return this.isDraining;
  }
}

// Create singleton instance
export const connectionDrainer = new ConnectionDrainer();

// Export middleware
export const connectionDrainingMiddleware = connectionDrainer.middleware();
