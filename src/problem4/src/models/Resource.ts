export interface Resource {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: 'active' | 'inactive' | 'archived';
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateResourceDto {
  name: string;
  description?: string;
  type: string;
  status?: 'active' | 'inactive' | 'archived';
  metadata?: Record<string, any>;
}

export interface UpdateResourceDto {
  name?: string;
  description?: string;
  type?: string;
  status?: 'active' | 'inactive' | 'archived';
  metadata?: Record<string, any>;
}

export interface ResourceFilter {
  type?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
