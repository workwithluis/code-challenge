# Express CRUD API with TypeScript

A production-ready RESTful CRUD API built with Express.js, TypeScript, and SQLite. This project provides a clean, scalable architecture for managing resources with full CRUD operations, comprehensive error handling, zero-downtime deployment support, and enterprise-grade logging.

## 🚀 Key Features

### Core Functionality
- ✅ **Full CRUD Operations**: Create, Read, Update, Delete resources
- ✅ **TypeScript**: Type-safe development with interfaces and strict typing
- ✅ **SQLite Database**: Lightweight, file-based database with automatic schema creation
- ✅ **Input Validation**: Request validation using express-validator
- ✅ **Filtering & Pagination**: List resources with filters, search, and pagination

### Production-Ready Features
- 🔒 **Enhanced Security**: Helmet.js for security headers, CORS support
- 📝 **Winston Logging**: Structured logging with daily rotation and correlation IDs
- 🔄 **Zero-Downtime Deployment**: Graceful shutdown with connection draining
- 🏥 **Health Checks**: Kubernetes-ready liveness and readiness probes
- 📊 **Metrics Endpoint**: Real-time application metrics
- 🐳 **Docker Support**: Multi-stage Dockerfile with proper signal handling
- ☸️ **Kubernetes Ready**: Complete K8s deployment configurations
- 🔧 **CI/CD Pipeline**: GitHub Actions workflow with canary deployments

### Error Handling & Monitoring
- 🎯 **Enhanced Error Responses**: Structured error format with codes, timestamps, and request IDs
- 🔍 **Request Correlation**: Track requests across the entire application lifecycle
- 📈 **Request Tracking**: Monitor active connections and request duration
- 🚨 **Comprehensive Error Codes**: Categorized errors for better client integration

## 📁 Project Structure

```
src/problem4/
├── src/
│   ├── controllers/          # Request handlers
│   ├── database/            # Database configuration and initialization
│   ├── middleware/          # Express middleware
│   │   ├── errorHandler.ts  # Enhanced error handling
│   │   ├── correlationId.ts # Request correlation tracking
│   │   └── connectionDraining.ts # Zero-downtime support
│   ├── models/              # TypeScript interfaces and types
│   ├── routes/              # API route definitions
│   ├── services/            # Business logic layer
│   ├── utils/               # Utility functions and classes
│   │   ├── AppError.ts      # Custom error class
│   │   └── logger.ts        # Winston logger configuration
│   ├── validators/          # Request validation schemas
│   ├── server.ts            # Standard server
│   ├── server-graceful.ts   # Graceful shutdown server
│   └── server-zero-downtime.ts # Advanced zero-downtime server
├── scripts/
│   └── test-graceful-shutdown.sh # Testing script for zero-downtime
├── .github/
│   └── workflows/
│       └── deploy.yml       # CI/CD pipeline
├── k8s-deployment.yaml      # Kubernetes configurations
├── Dockerfile               # Docker configuration
├── jest.config.js           # Jest testing configuration
├── .env.example             # Environment variables template
├── package.json             # Dependencies and scripts
└── tsconfig.json            # TypeScript configuration
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Docker (optional, for containerization)
- Kubernetes cluster (optional, for K8s deployment)

### Installation

1. Clone and navigate to the project:
```bash
cd src/problem4
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your `.env` file:
```env
# Server Configuration
PORT=3000
NODE_ENV=development
API_PREFIX=/api/v1

# Database
DB_PATH=./database.sqlite

# Logging
LOG_LEVEL=info

# Zero-Downtime Configuration
SHUTDOWN_TIMEOUT=30000
READINESS_PROBE_DELAY=5000
ENABLE_CLUSTERING=false
WORKER_COUNT=4
```

## 🏃 Running the Application

### Development Mode
```bash
# Standard development server with hot-reload
npm run dev

# With graceful shutdown
npm run dev:graceful

# With zero-downtime features
npm run dev:zero-downtime
```

### Production Mode
```bash
# Build and run standard server
npm run start:prod

# Run with graceful shutdown
npm run start:graceful

# Run with zero-downtime features
npm run start:zero-downtime

# Run with clustering enabled
npm run start:cluster
```

### Testing
```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Test graceful shutdown
npm run test:graceful
```

### Docker
```bash
# Build Docker image
npm run docker:build

# Run Docker container
npm run docker:run
```

### Kubernetes
```bash
# Deploy to Kubernetes
npm run k8s:deploy

# Check deployment status
npm run k8s:rollout

# View logs
npm run k8s:logs
```

## 📡 API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Health & Monitoring
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | General health check |
| `/health/live` | GET | Kubernetes liveness probe |
| `/health/ready` | GET | Kubernetes readiness probe |
| `/metrics` | GET | Application metrics |

### Resource Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/resources` | GET | List all resources with filtering |
| `/resources` | POST | Create a new resource |
| `/resources/:id` | GET | Get a specific resource |
| `/resources/:id` | PUT | Update a resource |
| `/resources/:id` | DELETE | Delete a resource |

### Query Parameters for GET /resources
- `type` - Filter by resource type
- `status` - Filter by status (active, inactive, archived)
- `search` - Search in name and description
- `limit` - Number of results (default: 10, max: 100)
- `offset` - Skip results for pagination
- `sortBy` - Sort field (created_at, updated_at, name)
- `sortOrder` - Sort direction (asc, desc)

## 📋 API Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response (Enhanced)
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource not found",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "path": "/api/v1/resources/123",
    "method": "GET"
  }
}
```

### Pagination Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

## 🔍 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_FAILED` | 422 | Request validation failed |
| `RESOURCE_NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE_RESOURCE` | 409 | Resource already exists |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

## 🧪 Testing Examples

### Create a Resource
```bash
curl -X POST http://localhost:3000/api/v1/resources \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: test-123" \
  -d '{
    "name": "Test Resource",
    "description": "This is a test",
    "type": "document",
    "status": "active"
  }'
```

### Test Graceful Shutdown
```bash
# Terminal 1: Start the server
npm run dev:zero-downtime

# Terminal 2: Run continuous requests
npm run test:graceful:continuous

# Terminal 3: Trigger shutdown
kill -TERM $(lsof -ti:3000)
```

## 🔧 Advanced Configuration

### Zero-Downtime Deployment
The application supports zero-downtime deployments with:
- Graceful shutdown handling
- Connection draining
- Request tracking
- Health check endpoints
- Kubernetes integration

### Logging
Winston logger with:
- Structured JSON logging
- Daily log rotation
- Correlation ID tracking
- Multiple log levels
- Separate error logs

### Database
SQLite with:
- Automatic schema creation
- Indexes on frequently queried fields
- Connection pooling
- Graceful connection closing

## 📊 Monitoring & Observability

### Metrics Endpoint
Access real-time metrics at `/metrics`:
```json
{
  "process": {
    "uptime": 3600,
    "memory": { ... },
    "cpu": { ... }
  },
  "requests": {
    "active": 5,
    "details": [ ... ]
  },
  "server": {
    "isReady": true,
    "isShuttingDown": false
  }
}
```

### Correlation IDs
Every request is assigned a correlation ID for tracing:
- Auto-generated if not provided
- Passed via `X-Correlation-Id` header
- Included in all logs and error responses

## 🚀 Production Deployment

### Docker Deployment
```bash
# Build image
docker build -t express-crud-api:latest .

# Run container
docker run -p 3000:3000 \
  --env-file .env \
  express-crud-api:latest
```

### Kubernetes Deployment
The included `k8s-deployment.yaml` provides:
- Rolling updates with zero downtime
- Pod disruption budgets
- Horizontal pod autoscaling
- Health probes
- Resource limits

## 🤝 Contributing

1. Follow TypeScript best practices
2. Maintain test coverage above 80%
3. Use conventional commits
4. Update documentation for new features
5. Ensure all tests pass before submitting PR

## 📝 License

ISC

---

For detailed implementation information, see `IMPLEMENTATION_SUMMARY.md`
