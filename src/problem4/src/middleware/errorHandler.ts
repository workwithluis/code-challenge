import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { log } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error with correlation ID
  log.error('Request error occurred', err, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    correlationId: req.correlationId
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404, 'RESOURCE_NOT_FOUND');
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 409, 'DUPLICATE_RESOURCE');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = 'Validation Error';
    error = new AppError(message, 422, 'VALIDATION_ERROR');
  }

  // Express validator errors
  if (err.message === 'Validation failed') {
    error = new AppError('Validation failed', 422, 'VALIDATION_FAILED');
  }

  // JSON parsing errors
  if (err.name === 'SyntaxError' && err.message.includes('JSON')) {
    error = new AppError('Invalid JSON format', 400, 'INVALID_JSON');
  }

  const statusCode = (error as AppError).statusCode || 500;
  const errorCode = (error as AppError).errorCode || 'INTERNAL_SERVER_ERROR';

  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: error.message || 'Internal Server Error',
      timestamp: new Date().toISOString(),
      request_id: req.correlationId,
      path: req.path,
      method: req.method
    },
    ...(process.env.NODE_ENV === 'development' && { 
      debug: {
        stack: err.stack,
        details: err
      }
    })
  };

  res.status(statusCode).json(errorResponse);
};
