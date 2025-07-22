import { ResourceService } from '../../services/resourceService';
import { initializeDatabase } from '../../database/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../utils/AppError';

describe('ResourceService', () => {
  let resourceService: ResourceService;

  beforeAll(async () => {
    await initializeDatabase();
    resourceService = new ResourceService();
  });

  describe('create', () => {
    it('should create a new resource with all fields', async () => {
      const resourceData = {
        name: 'Test Resource',
        description: 'Test Description',
        type: 'test-type',
        status: 'active' as const,
      };

      const resource = await resourceService.create(resourceData);

      expect(resource).toMatchObject({
        name: resourceData.name,
        description: resourceData.description,
        type: resourceData.type,
        status: resourceData.status,
      });
      expect(resource.id).toBeDefined();
      expect(resource.created_at).toBeDefined();
      expect(resource.updated_at).toBeDefined();
    });

    it('should create a resource with default status', async () => {
      const resourceData = {
        name: 'Test Resource No Status',
        type: 'test-type',
      };

      const resource = await resourceService.create(resourceData);

      expect(resource.status).toBe('active');
    });

    it('should create a resource without description', async () => {
      const resourceData = {
        name: 'Test Resource No Description',
        type: 'test-type',
      };

      const resource = await resourceService.create(resourceData);

      expect(resource.description).toBeNull();
    });
  });

  describe('findById', () => {
    it('should retrieve an existing resource', async () => {
      // First create a resource
      const created = await resourceService.create({
        name: 'Resource to Retrieve',
        type: 'test',
      });

      // Then retrieve it
      const retrieved = await resourceService.findById(created.id);

      expect(retrieved).toMatchObject({
        id: created.id,
        name: created.name,
        type: created.type,
      });
    });

    it('should return null for non-existent resource', async () => {
      const fakeId = uuidv4();
      const resource = await resourceService.findById(fakeId);

      expect(resource).toBeNull();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create test resources
      const resources = [
        { name: 'Resource A', type: 'typeA', status: 'active' as const },
        { name: 'Resource B', type: 'typeB', status: 'active' as const },
        { name: 'Resource C', type: 'typeA', status: 'inactive' as const },
        { name: 'Resource D', type: 'typeB', status: 'active' as const },
        { name: 'Resource E', type: 'typeA', status: 'active' as const },
      ];

      for (const resource of resources) {
        await resourceService.create(resource);
      }
    });

    it('should retrieve all resources with default pagination', async () => {
      const result = await resourceService.list({});

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(10);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should filter resources by type', async () => {
      const result = await resourceService.list({ type: 'typeA' });

      result.data.forEach(resource => {
        expect(resource.type).toBe('typeA');
      });
    });

    it('should filter resources by status', async () => {
      const result = await resourceService.list({ status: 'inactive' });

      result.data.forEach(resource => {
        expect(resource.status).toBe('inactive');
      });
    });

    it('should handle pagination correctly', async () => {
      const page1 = await resourceService.list({ limit: 2, offset: 0 });
      const page2 = await resourceService.list({ limit: 2, offset: 2 });

      expect(page1.data.length).toBeLessThanOrEqual(2);
      expect(page2.data.length).toBeLessThanOrEqual(2);
      
      // Ensure different resources on different pages
      const page1Ids = page1.data.map(r => r.id);
      const page2Ids = page2.data.map(r => r.id);
      const commonIds = page1Ids.filter(id => page2Ids.includes(id));
      expect(commonIds.length).toBe(0);
    });

    it('should search resources by name', async () => {
      const result = await resourceService.list({ search: 'Resource A' });

      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach(resource => {
        expect(resource.name).toContain('Resource A');
      });
    });

    it('should combine multiple filters', async () => {
      const result = await resourceService.list({
        type: 'typeA',
        status: 'active',
        limit: 5,
      });

      result.data.forEach(resource => {
        expect(resource.type).toBe('typeA');
        expect(resource.status).toBe('active');
      });
      expect(result.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('update', () => {
    let resourceId: string;

    beforeEach(async () => {
      const resource = await resourceService.create({
        name: 'Original Name',
        description: 'Original Description',
        type: 'original-type',
        status: 'active',
      });
      resourceId = resource.id;
    });

    it('should update resource fields', async () => {
      const updateData = {
        name: 'Updated Name',
        description: 'Updated Description',
        status: 'inactive' as const,
      };

      const updated = await resourceService.update(resourceId, updateData);

      expect(updated).toMatchObject({
        id: resourceId,
        name: updateData.name,
        description: updateData.description,
        status: updateData.status,
        type: 'original-type', // Type should not change
      });
      expect(updated?.updated_at).not.toBe(updated?.created_at);
    });

    it('should update only provided fields', async () => {
      const updated = await resourceService.update(resourceId, {
        name: 'Only Name Updated',
      });

      expect(updated).toMatchObject({
        id: resourceId,
        name: 'Only Name Updated',
        description: 'Original Description',
        type: 'original-type',
        status: 'active',
      });
    });

    it('should throw error for non-existent resource', async () => {
      const fakeId = uuidv4();
      
      await expect(
        resourceService.update(fakeId, { name: 'New Name' })
      ).rejects.toThrow(AppError);
    });

    it('should handle empty update data', async () => {
      const updated = await resourceService.update(resourceId, {});

      expect(updated).toMatchObject({
        id: resourceId,
        name: 'Original Name',
        description: 'Original Description',
        type: 'original-type',
        status: 'active',
      });
    });
  });

  describe('delete', () => {
    it('should delete an existing resource', async () => {
      // Create a resource
      const resource = await resourceService.create({
        name: 'Resource to Delete',
        type: 'test',
      });

      // Delete it
      await resourceService.delete(resource.id);

      // Verify it's deleted
      const retrieved = await resourceService.findById(resource.id);
      expect(retrieved).toBeNull();
    });

    it('should throw error for non-existent resource', async () => {
      const fakeId = uuidv4();
      
      await expect(
        resourceService.delete(fakeId)
      ).rejects.toThrow(AppError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long names', async () => {
      const longName = 'A'.repeat(255);
      const resource = await resourceService.create({
        name: longName,
        type: 'test',
      });

      expect(resource.name).toBe(longName);
    });

    it('should handle special characters in search', async () => {
      await resourceService.create({
        name: 'Resource with % special _ characters',
        type: 'test',
      });

      const result = await resourceService.list({
        search: '% special _',
      });

      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should handle concurrent operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        resourceService.create({
          name: `Concurrent Resource ${i}`,
          type: 'test',
        })
      );

      const resources = await Promise.all(promises);
      expect(resources.length).toBe(10);
      
      // All resources should have unique IDs
      const ids = resources.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });
  });
});
