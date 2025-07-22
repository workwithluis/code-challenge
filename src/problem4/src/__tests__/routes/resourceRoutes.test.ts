import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase } from '../../database/db';
import { correlationIdMiddleware } from '../../middleware/correlationId';
import { errorHandler } from '../../middleware/errorHandler';
import { notFoundHandler } from '../../middleware/notFoundHandler';
import resourceRoutes from '../../routes/resourceRoutes';

// Create test app
const app = express();
app.use(express.json());
app.use(correlationIdMiddleware);
app.use('/api/v1/resources', resourceRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

describe('Resource Routes', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  describe('POST /api/v1/resources', () => {
    it('should create a new resource with valid data', async () => {
      const newResource = {
        name: 'Test Resource',
        description: 'Test Description',
        type: 'test',
      };

      const response = await request(app)
        .post('/api/v1/resources')
        .send(newResource)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: newResource.name,
        description: newResource.description,
        type: newResource.type,
        status: 'active',
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.created_at).toBeDefined();
      expect(response.body.data.updated_at).toBeDefined();
      expect(response.headers['x-correlation-id']).toBeDefined();
    });

    it('should return 422 for missing required fields', async () => {
      const invalidResource = {
        description: 'Missing name and type',
      };

      const response = await request(app)
        .post('/api/v1/resources')
        .send(invalidResource)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.message).toBe('Validation failed');
    });

    it('should use custom correlation ID if provided', async () => {
      const customCorrelationId = 'custom-test-id-123';
      const newResource = {
        name: 'Test with Correlation ID',
        type: 'test',
      };

      const response = await request(app)
        .post('/api/v1/resources')
        .set('X-Correlation-Id', customCorrelationId)
        .send(newResource)
        .expect(201);

      expect(response.headers['x-correlation-id']).toBe(customCorrelationId);
    });
  });

  describe('GET /api/v1/resources/:id', () => {
    let resourceId: string;

    beforeEach(async () => {
      // Create a resource for testing
      const response = await request(app)
        .post('/api/v1/resources')
        .send({
          name: 'Resource to Get',
          type: 'test',
          description: 'Test resource for GET',
        });
      resourceId = response.body.data.id;
    });

    it('should get a resource by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/resources/${resourceId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(resourceId);
      expect(response.body.data.name).toBe('Resource to Get');
    });

    it('should return 404 for non-existent resource', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .get(`/api/v1/resources/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(response.body.error.message).toBe('Resource not found');
    });

    it('should return 404 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/v1/resources/invalid-uuid')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(response.body.error.message).toBe('Resource not found');
    });
  });

  describe('GET /api/v1/resources', () => {
    beforeEach(async () => {
      // Create multiple resources for testing
      const resources = [
        { name: 'Resource 1', type: 'type1', status: 'active' },
        { name: 'Resource 2', type: 'type2', status: 'active' },
        { name: 'Resource 3', type: 'type1', status: 'inactive' },
        { name: 'Resource 4', type: 'type2', status: 'active' },
        { name: 'Resource 5', type: 'type1', status: 'active' },
      ];

      for (const resource of resources) {
        await request(app).post('/api/v1/resources').send(resource);
      }
    });

    it('should get all resources with default pagination', async () => {
      const response = await request(app)
        .get('/api/v1/resources')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeLessThanOrEqual(10); // Default limit
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.offset).toBe(0);
      expect(response.body.pagination.total).toBeGreaterThan(0);
    });

    it('should filter resources by type', async () => {
      const response = await request(app)
        .get('/api/v1/resources?type=type1')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((resource: any) => {
        expect(resource.type).toBe('type1');
      });
    });

    it('should filter resources by status', async () => {
      const response = await request(app)
        .get('/api/v1/resources?status=active')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((resource: any) => {
        expect(resource.status).toBe('active');
      });
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/v1/resources?offset=2&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.offset).toBe(2);
      expect(response.body.pagination.limit).toBe(2);
    });

    it('should search resources by name', async () => {
      const response = await request(app)
        .get('/api/v1/resources?search=Resource 1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].name).toContain('Resource 1');
    });
  });

  describe('PUT /api/v1/resources/:id', () => {
    let resourceId: string;

    beforeEach(async () => {
      // Create a resource for testing
      const response = await request(app)
        .post('/api/v1/resources')
        .send({
          name: 'Resource to Update',
          type: 'test',
          description: 'Original description',
        });
      resourceId = response.body.data.id;
    });

    it('should update a resource', async () => {
      const updateData = {
        name: 'Updated Resource Name',
        description: 'Updated description',
        status: 'inactive',
      };

      const response = await request(app)
        .put(`/api/v1/resources/${resourceId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.status).toBe(updateData.status);
      expect(response.body.data.type).toBe('test'); // Type should remain unchanged
    });

    it('should return 404 for non-existent resource', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .put(`/api/v1/resources/${fakeId}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(response.body.error.message).toBe('Resource not found');
    });

    it('should return 422 for invalid status', async () => {
      const response = await request(app)
        .put(`/api/v1/resources/${resourceId}`)
        .send({ status: 'invalid-status' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.message).toBe('Validation failed');
    });
  });

  describe('DELETE /api/v1/resources/:id', () => {
    let resourceId: string;

    beforeEach(async () => {
      // Create a resource for testing
      const response = await request(app)
        .post('/api/v1/resources')
        .send({
          name: 'Resource to Delete',
          type: 'test',
        });
      resourceId = response.body.data.id;
    });

    it('should delete a resource', async () => {
      const response = await request(app)
        .delete(`/api/v1/resources/${resourceId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Resource deleted successfully');

      // Verify resource is deleted
      await request(app)
        .get(`/api/v1/resources/${resourceId}`)
        .expect(404);
    });

    it('should return 404 for non-existent resource', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .delete(`/api/v1/resources/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(response.body.error.message).toBe('Resource not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v2/unknown-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Route /api/v2/unknown-route not found');
    });

    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/v1/resources')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
