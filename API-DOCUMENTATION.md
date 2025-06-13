# User Service API Documentation

## Overview
Enhanced User Service with comprehensive security, monitoring, and performance optimizations.

## Base URL
- Development: `http://localhost:3002`
- Production: `https://api.yourapp.com`

## Authentication
All endpoints except health checks require JWT authentication via `Authorization: Bearer <token>` header.

## Rate Limiting
- **General Operations**: 100 requests per 15 minutes
- **Create Operations**: 20 requests per 15 minutes  
- **Update Operations**: 50 requests per 15 minutes
- **Delete Operations**: 10 requests per 15 minutes
- **Admin Operations**: 200 requests per 15 minutes

## Common Headers
- `Content-Type: application/json`
- `Authorization: Bearer <jwt_token>`
- `X-Correlation-ID: <uuid>` (optional, auto-generated if not provided)

## Health Endpoints

### GET /health
Basic health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-05-30T10:45:00.000Z",
  "uptime": 3600,
  "environment": "development",
  "version": "1.0.0",
  "correlationId": "uuid"
}
```

### GET /health/detailed
Detailed health check with system metrics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-05-30T10:45:00.000Z",
  "uptime": 3600,
  "environment": "development",
  "version": "1.0.0",
  "metrics": {
    "performance": {
      "totalRequests": 1250,
      "averageResponseTime": 156,
      "errorRate": 0.8
    },
    "memory": {
      "rss": "45 MB",
      "heapTotal": "25 MB",
      "heapUsed": "18 MB",
      "external": "2 MB"
    }
  },
  "correlationId": "uuid"
}
```

## User Endpoints

### POST /api/users
Create a new user profile.

**Request Body:**
```json
{
  "authUserId": "auth-service-user-id",
  "username": "johndoe",
  "email": "john@example.com",
  "bio": "Software developer",
  "image": "https://example.com/avatar.jpg"
}
```

**Validation Rules:**
- `authUserId`: Required, string
- `username`: Required, 3-30 characters, alphanumeric + underscore
- `email`: Required, valid email format
- `bio`: Optional, max 500 characters
- `image`: Optional, valid URL

**Response (201):**
```json
{
  "status": "success",
  "message": "User created successfully",
  "data": {
    "user": {
      "id": 1,
      "authUserId": "auth-service-user-id",
      "username": "johndoe",
      "email": "john@example.com",
      "bio": "Software developer",
      "image": "https://example.com/avatar.jpg",
      "isActive": true,
      "createdAt": "2025-05-30T10:45:00.000Z",
      "updatedAt": "2025-05-30T10:45:00.000Z"
    }
  },
  "correlationId": "uuid",
  "timestamp": "2025-05-30T10:45:00.000Z"
}
```

### GET /api/users
Get all users with pagination and search.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)
- `sortBy`: Sort field (default: createdAt)
- `sortOrder`: Sort direction (asc/desc, default: desc)
- `search`: Search in username and email

**Example:** `/api/users?page=1&limit=20&search=john&sortBy=username&sortOrder=asc`

**Response (200):**
```json
{
  "status": "success",
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": 1,
        "authUserId": "auth-service-user-id",
        "username": "johndoe",
        "email": "john@example.com",
        "bio": "Software developer",
        "image": "https://example.com/avatar.jpg",
        "isActive": true,
        "createdAt": "2025-05-30T10:45:00.000Z",
        "updatedAt": "2025-05-30T10:45:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalCount": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "correlationId": "uuid",
  "timestamp": "2025-05-30T10:45:00.000Z"
}
```

### GET /api/users/:id
Get user by auth user ID.

**Parameters:**
- `id`: Auth service user ID

**Response (200):**
```json
{
  "status": "success",
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "id": 1,
      "authUserId": "auth-service-user-id",
      "username": "johndoe",
      "email": "john@example.com",
      "bio": "Software developer",
      "image": "https://example.com/avatar.jpg",
      "isActive": true,
      "createdAt": "2025-05-30T10:45:00.000Z",
      "updatedAt": "2025-05-30T10:45:00.000Z"
    }
  },
  "correlationId": "uuid",
  "timestamp": "2025-05-30T10:45:00.000Z"
}
```

### PUT /api/users/:id
Update user profile.

**Parameters:**
- `id`: Auth service user ID

**Request Body:**
```json
{
  "username": "johnsmith",
  "email": "johnsmith@example.com", 
  "bio": "Senior software developer",
  "image": "https://example.com/new-avatar.jpg"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "User updated successfully",
  "data": {
    "user": {
      "id": 1,
      "authUserId": "auth-service-user-id",
      "username": "johnsmith",
      "email": "johnsmith@example.com",
      "bio": "Senior software developer", 
      "image": "https://example.com/new-avatar.jpg",
      "isActive": true,
      "createdAt": "2025-05-30T10:45:00.000Z",
      "updatedAt": "2025-05-30T10:45:01.000Z"
    }
  },
  "correlationId": "uuid",
  "timestamp": "2025-05-30T10:45:01.000Z"
}
```

### DELETE /api/users/:id
Soft delete user (deactivate).

**Parameters:**
- `id`: Auth service user ID

**Response (200):**
```json
{
  "status": "success",
  "message": "User deleted successfully",
  "data": {
    "user": {
      "id": 1,
      "authUserId": "auth-service-user-id",
      "username": "johnsmith",
      "email": "johnsmith@example.com",
      "bio": "Senior software developer",
      "image": "https://example.com/new-avatar.jpg",
      "isActive": false,
      "createdAt": "2025-05-30T10:45:00.000Z",
      "updatedAt": "2025-05-30T10:45:02.000Z"
    }
  },
  "correlationId": "uuid",
  "timestamp": "2025-05-30T10:45:02.000Z"
}
```

## Admin Endpoints

### GET /api/users/stats
Get user statistics (admin only).

**Response (200):**
```json
{
  "status": "success",
  "message": "User statistics retrieved successfully",
  "data": {
    "stats": {
      "totalUsers": 1500,
      "activeUsers": 1350,
      "inactiveUsers": 150,
      "activationRate": "90.00"
    }
  },
  "correlationId": "uuid",
  "timestamp": "2025-05-30T10:45:00.000Z"
}
```

### GET /api/users/health
Service health check with database connectivity.

**Response (200):**
```json
{
  "status": "success",
  "message": "User service is healthy",
  "data": {
    "service": {
      "status": "healthy",
      "timestamp": "2025-05-30T10:45:00.000Z"
    },
    "metrics": {
      "totalRequests": 1250,
      "averageResponseTime": 156,
      "errorRate": 0.8
    },
    "uptime": 3600,
    "timestamp": "2025-05-30T10:45:00.000Z"
  },
  "correlationId": "uuid"
}
```

## Error Responses

### Validation Error (400)
```json
{
  "status": "fail",
  "message": "Validation failed",
  "errors": [
    {
      "field": "username",
      "message": "Username must be between 3 and 30 characters",
      "value": "ab",
      "location": "body"
    }
  ],
  "correlationId": "uuid",
  "timestamp": "2025-05-30T10:45:00.000Z"
}
```

### Not Found (404)
```json
{
  "status": "fail",
  "message": "User not found",
  "correlationId": "uuid",
  "timestamp": "2025-05-30T10:45:00.000Z"
}
```

### Rate Limit (429)
```json
{
  "status": "error",
  "message": "Too many requests, please try again later.",
  "correlationId": "uuid",
  "timestamp": "2025-05-30T10:45:00.000Z",
  "retryAfter": "15 minutes"
}
```

### Server Error (500)
```json
{
  "status": "error",
  "message": "Something went wrong!",
  "correlationId": "uuid",
  "timestamp": "2025-05-30T10:45:00.000Z"
}
```

## Security Features

### Input Validation
- XSS protection on all inputs
- SQL injection prevention via Prisma ORM
- Request size limiting (10MB default)
- Content type validation

### Rate Limiting
- IP-based rate limiting
- Operation-specific limits
- Progressive rate limiting for repeated violations
- Detailed metrics tracking

### Security Headers
- Helmet.js security headers
- CORS configuration
- Content Security Policy
- HSTS enabled in production

### Logging & Monitoring
- Structured logging with correlation IDs
- Performance monitoring
- Security event logging
- Request/response tracking

## Performance Features

### Caching Strategy
- Database query optimization
- Connection pooling
- Batch operations support

### Monitoring
- Real-time performance metrics
- Memory usage tracking
- Error rate monitoring
- Slow query detection

### Pagination
- Efficient pagination with limit/offset
- Search functionality
- Sorting capabilities
- Total count tracking
