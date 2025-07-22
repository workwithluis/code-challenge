import { body, param, query, ValidationChain } from 'express-validator';

export const createResourceValidator: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 characters'),
  
  body('type')
    .trim()
    .notEmpty().withMessage('Type is required')
    .isLength({ min: 1, max: 100 }).withMessage('Type must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'archived']).withMessage('Status must be active, inactive, or archived'),
  
  body('metadata')
    .optional()
    .isObject().withMessage('Metadata must be a valid object')
];

export const updateResourceValidator: ValidationChain[] = [
  param('id')
    .notEmpty().withMessage('Resource ID is required')
    .isUUID().withMessage('Invalid resource ID format'),
  
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 characters'),
  
  body('type')
    .optional()
    .trim()
    .notEmpty().withMessage('Type cannot be empty')
    .isLength({ min: 1, max: 100 }).withMessage('Type must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'archived']).withMessage('Status must be active, inactive, or archived'),
  
  body('metadata')
    .optional()
    .isObject().withMessage('Metadata must be a valid object')
];

export const getResourceValidator: ValidationChain[] = [
  param('id')
    .notEmpty().withMessage('Resource ID is required')
    .isUUID().withMessage('Invalid resource ID format')
];

export const deleteResourceValidator: ValidationChain[] = [
  param('id')
    .notEmpty().withMessage('Resource ID is required')
    .isUUID().withMessage('Invalid resource ID format')
];

export const listResourcesValidator: ValidationChain[] = [
  query('type')
    .optional()
    .trim()
    .notEmpty().withMessage('Type cannot be empty'),
  
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'archived']).withMessage('Status must be active, inactive, or archived'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Search term must not exceed 100 characters'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  query('offset')
    .optional()
    .isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
    .toInt(),
  
  query('sortBy')
    .optional()
    .isIn(['created_at', 'updated_at', 'name']).withMessage('Sort by must be created_at, updated_at, or name'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
];
