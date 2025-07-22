import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbGet, dbAll } from '../database/db';
import {
  Resource,
  CreateResourceDto,
  UpdateResourceDto,
  ResourceFilter,
  PaginatedResponse
} from '../models/Resource';
import { AppError } from '../utils/AppError';

export class ResourceService {
  /**
   * Create a new resource
   */
  async create(data: CreateResourceDto): Promise<Resource> {
    const id = uuidv4();
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    
    const query = `
      INSERT INTO resources (id, name, description, type, status, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    try {
      await dbRun(
        query,
        id,
        data.name,
        data.description || null,
        data.type,
        data.status || 'active',
        metadata
      );
      
      const resource = await this.findById(id);
      if (!resource) {
        throw new AppError('Failed to create resource', 500, 'RESOURCE_CREATION_FAILED');
      }
      
      return resource;
    } catch (error: any) {
      throw new AppError(`Failed to create resource: ${error.message}`, 500, 'RESOURCE_CREATION_ERROR');
    }
  }

  /**
   * Find resource by ID
   */
  async findById(id: string): Promise<Resource | null> {
    const query = `SELECT * FROM resources WHERE id = ?`;
    
    try {
      const row = await dbGet(query, id) as any;
      
      if (!row) {
        return null;
      }
      
      return this.mapRowToResource(row);
    } catch (error: any) {
      throw new AppError(`Failed to find resource: ${error.message}`, 500, 'RESOURCE_FETCH_ERROR');
    }
  }

  /**
   * List resources with filters and pagination
   */
  async list(filter: ResourceFilter): Promise<PaginatedResponse<Resource>> {
    const limit = filter.limit || 10;
    const offset = filter.offset || 0;
    const sortBy = filter.sortBy || 'created_at';
    const sortOrder = filter.sortOrder || 'desc';
    
    let whereConditions: string[] = [];
    let params: any[] = [];
    
    // Build WHERE conditions
    if (filter.type) {
      whereConditions.push('type = ?');
      params.push(filter.type);
    }
    
    if (filter.status) {
      whereConditions.push('status = ?');
      params.push(filter.status);
    }
    
    if (filter.search) {
      whereConditions.push('(name LIKE ? OR description LIKE ?)');
      params.push(`%${filter.search}%`, `%${filter.search}%`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    try {
      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM resources ${whereClause}`;
      const countResult = await dbGet(countQuery, ...params) as any;
      const total = countResult.total;
      
      // Get paginated results
      const query = `
        SELECT * FROM resources 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `;
      
      const rows = await dbAll(query, ...params, limit, offset) as any[];
      const resources = rows.map(row => this.mapRowToResource(row));
      
      return {
        data: resources,
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      };
    } catch (error: any) {
      throw new AppError(`Failed to list resources: ${error.message}`, 500, 'RESOURCE_LIST_ERROR');
    }
  }

  /**
   * Update a resource
   */
  async update(id: string, data: UpdateResourceDto): Promise<Resource> {
    const resource = await this.findById(id);
    
    if (!resource) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    
    if (data.type !== undefined) {
      updates.push('type = ?');
      params.push(data.type);
    }
    
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(data.metadata));
    }
    
    if (updates.length === 0) {
      return resource;
    }
    
    params.push(id);
    
    const query = `
      UPDATE resources 
      SET ${updates.join(', ')}
      WHERE id = ?
    `;
    
    try {
      await dbRun(query, ...params);
      
      const updatedResource = await this.findById(id);
      if (!updatedResource) {
        throw new AppError('Failed to update resource', 500, 'RESOURCE_UPDATE_FAILED');
      }
      
      return updatedResource;
    } catch (error: any) {
      throw new AppError(`Failed to update resource: ${error.message}`, 500, 'RESOURCE_UPDATE_ERROR');
    }
  }

  /**
   * Delete a resource
   */
  async delete(id: string): Promise<void> {
    const resource = await this.findById(id);
    
    if (!resource) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
    
    const query = `DELETE FROM resources WHERE id = ?`;
    
    try {
      await dbRun(query, id);
    } catch (error: any) {
      throw new AppError(`Failed to delete resource: ${error.message}`, 500, 'RESOURCE_DELETE_ERROR');
    }
  }

  /**
   * Map database row to Resource object
   */
  private mapRowToResource(row: any): Resource {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      status: row.status,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }
}

// Export singleton instance
export const resourceService = new ResourceService();
