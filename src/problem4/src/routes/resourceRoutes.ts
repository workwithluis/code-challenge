import { Router } from 'express';
import { resourceController } from '../controllers/resourceController';
import {
  createResourceValidator,
  updateResourceValidator,
  getResourceValidator,
  deleteResourceValidator,
  listResourcesValidator
} from '../validators/resourceValidators';

const router = Router();

// Create a new resource
router.post(
  '/',
  createResourceValidator,
  resourceController.create.bind(resourceController)
);

// List resources with filters
router.get(
  '/',
  listResourcesValidator,
  resourceController.list.bind(resourceController)
);

// Get resource by ID
router.get(
  '/:id',
  getResourceValidator,
  resourceController.getById.bind(resourceController)
);

// Update resource
router.put(
  '/:id',
  updateResourceValidator,
  resourceController.update.bind(resourceController)
);

// Delete resource
router.delete(
  '/:id',
  deleteResourceValidator,
  resourceController.delete.bind(resourceController)
);

export default router;
