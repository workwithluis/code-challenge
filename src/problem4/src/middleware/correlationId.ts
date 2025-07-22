import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncLocalStorage, log } from '../utils/logger';

// Extend Express Request type to include correlationId and startTime
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Get correlation ID from header or generate a new one
  const correlationId = req.headers['x-correlation-id'] as string || 
                       req.headers['x-request-id'] as string || 
                       uuidv4();
  
  // Store correlation ID in request object
  req.correlationId = correlationId;
  
  // Set correlation ID in response header
  res.setHeader('X-Correlation-Id', correlationId);
  
  // Run the rest of the request within AsyncLocalStorage context
  asyncLocalStorage.run({ correlationId }, () => {
    log.info(`Incoming request: ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Log response when finished
    const originalSend = res.send;
    res.send = function(data: any) {
      log.info(`Request completed: ${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: req.startTime ? Date.now() - req.startTime : 0
      });
      return originalSend.call(this, data);
    };
    
    // Store request start time for duration calculation
    req.startTime = Date.now();
    
    next();
  });
};
