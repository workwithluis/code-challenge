import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { resourceService } from '../services/resourceService';
import { ResourceFilter } from '../models/Resource';
import { AppError } from '../utils/AppError';

export class ResourceController {
  /**
   * Create a new resource
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_FAILED');
      }

      const resource = await resourceService.create(req.body);
      
      res.status(201).json({
        success: true,
        data: resource,
        message: 'Resource created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get resource by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const resource = await resourceService.findById(id);
      
      if (!resource) {
        throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
      }
      
      res.json({
        success: true,
        data: resource
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List resources with filters
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter: ResourceFilter = {
        type: req.query.type as string,
        status: req.query.status as string,
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        sortBy: req.query.sortBy as any || 'created_at',
        sortOrder: req.query.sortOrder as any || 'desc'
      };
      
      const result = await resourceService.list(filter);
      
      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.hasMore
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a resource
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_FAILED');
      }

      const { id } = req.params;
      const resource = await resourceService.update(id, req.body);
      
      res.json({
        success: true,
        data: resource,
        message: 'Resource updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a resource
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      await resourceService.delete(id);
      
      res.json({
        success: true,
        message: 'Resource deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const resourceController = new ResourceController();
