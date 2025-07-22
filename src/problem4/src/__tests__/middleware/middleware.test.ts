import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middleware/errorHandler';
import { notFoundHandler } from '../../middleware/notFoundHandler';
import { correlationIdMiddleware } from '../../middleware/correlationId';
import { AppError } from '../../utils/AppError';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  asyncLocalStorage: {
    run: jest.fn((_, callback) => callback()),
    getStore: jest.fn(() => ({ correlationId: 'test-correlation-id' })),
  },
}));

describe('Middleware Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1',
      headers: {},
      correlationId: 'test-correlation-id',
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    
    mockNext = jest.fn();
  });

  describe('correlationIdMiddleware', () => {
    it('should generate a new correlation ID if none provided', () => {
      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.correlationId).toBeDefined();
      expect(mockRequest.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Correlation-Id',
        mockRequest.correlationId
      );
    });

    it('should use existing correlation ID from x-correlation-id header', () => {
      const existingId = 'existing-correlation-id';
      mockRequest.headers = { 'x-correlation-id': existingId };

      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.correlationId).toBe(existingId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Correlation-Id',
        existingId
      );
    });

    it('should use existing correlation ID from x-request-id header', () => {
      const existingId = 'existing-request-id';
      mockRequest.headers = { 'x-request-id': existingId };

      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.correlationId).toBe(existingId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Correlation-Id',
        existingId
      );
    });

    it('should prefer x-correlation-id over x-request-id', () => {
      const correlationId = 'correlation-id';
      const requestId = 'request-id';
      mockRequest.headers = {
        'x-correlation-id': correlationId,
        'x-request-id': requestId,
      };

      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.correlationId).toBe(correlationId);
    });

    it('should set startTime on request', () => {
      const beforeTime = Date.now();
      
      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const afterTime = Date.now();
      expect(mockRequest.startTime).toBeDefined();
      expect(mockRequest.startTime).toBeGreaterThanOrEqual(beforeTime);
      expect(mockRequest.startTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('errorHandler', () => {

    it('should handle AppError with custom status code', () => {
      const error = new AppError('Custom error message', 400);

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Custom error message',
          timestamp: expect.any(String),
          request_id: 'test-correlation-id',
          path: '/test',
          method: 'GET'
        }
      });
    });

    it('should handle validation errors', () => {
      const error = new Error('Validation error');
      error.name = 'ValidationError';

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation Error',
          timestamp: expect.any(String),
          request_id: 'test-correlation-id',
          path: '/test',
          method: 'GET'
        }
      });
    });

    it('should handle duplicate key errors', () => {
      const error: any = new Error('Duplicate key error');
      error.code = 11000;

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DUPLICATE_RESOURCE',
          message: 'Duplicate field value entered',
          timestamp: expect.any(String),
          request_id: 'test-correlation-id',
          path: '/test',
          method: 'GET'
        }
      });
    });

    it('should handle JSON parsing errors', () => {
      const error = new SyntaxError('Unexpected token in JSON at position 2');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON format',
          timestamp: expect.any(String),
          request_id: 'test-correlation-id',
          path: '/test',
          method: 'GET'
        }
      });
    });

    it('should handle generic errors with 500 status', () => {
      const error = new Error('Something went wrong');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong',
          timestamp: expect.any(String),
          request_id: 'test-correlation-id',
          path: '/test',
          method: 'GET'
        }
      });
    });

    it('should include debug information in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Internal error details');
      error.stack = 'Error stack trace';

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal error details',
          timestamp: expect.any(String),
          request_id: 'test-correlation-id',
          path: '/test',
          method: 'GET'
        },
        debug: {
          stack: 'Error stack trace',
          details: error
        }
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 with error message', () => {
      mockRequest.originalUrl = '/api/v1/unknown-route';

      notFoundHandler(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Route /api/v1/unknown-route not found',
          statusCode: 404
        })
      );
    });

    it('should handle routes without originalUrl', () => {
      mockRequest.originalUrl = undefined;

      notFoundHandler(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Route undefined not found',
          statusCode: 404
        })
      );
    });
  });
});
