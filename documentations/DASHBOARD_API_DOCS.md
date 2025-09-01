# Admin Dashboard API Documentation

This document outlines the new API endpoints created for the admin dashboard to fetch real metrics and data instead of placeholder data.

## Authentication

All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Dashboard Metrics Endpoints

### 1. Get Dashboard Overview Metrics

**Endpoint:** `GET /api/dashboard/metrics`

**Access:** SUPER_ADMIN only

**Description:** Fetches all the key metrics for the admin dashboard including total tenants, users, active users, and new clients.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTenants": 25,
    "totalUsers": 150,
    "activeUsers": 120,
    "newClients": 5,
    "recentTenants": [
      {
        "id": "uuid",
        "name": "University of Nairobi",
        "domain": "uon.ac.ke",
        "email": "admin@uon.ac.ke",
        "type": "UNIVERSITY",
        "status": "ACTIVE",
        "createdAt": "2024-01-15T10:30:00Z",
        "_count": {
          "users": 45
        }
      }
    ],
    "userGrowth": [...],
    "tenantGrowth": [...]
  }
}
```

### 2. Get Tenant Details

**Endpoint:** `GET /api/dashboard/tenants/:tenantId`

**Access:** SUPER_ADMIN only

**Description:** Fetches detailed information about a specific tenant including user count, department count, and recent users.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "University of Nairobi",
    "domain": "uon.ac.ke",
    "email": "admin@uon.ac.ke",
    "type": "UNIVERSITY",
    "status": "ACTIVE",
    "_count": {
      "users": 45,
      "departments": 12,
      "campuses": 3
    },
    "users": [
      {
        "id": "uuid",
        "email": "user@uon.ac.ke",
        "firstName": "John",
        "lastName": "Doe",
        "verified": true,
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

## Enhanced Tenant Endpoints

### 3. Get Tenants with Statistics

**Endpoint:** `GET /api/tenants/with-stats`

**Access:** SUPER_ADMIN only

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search term for name, domain, or email

**Description:** Fetches paginated list of tenants with their statistics (user count, department count, campus count).

**Response:**
```json
{
  "success": true,
  "data": {
    "tenants": [
      {
        "id": "uuid",
        "name": "University of Nairobi",
        "domain": "uon.ac.ke",
        "email": "admin@uon.ac.ke",
        "type": "UNIVERSITY",
        "status": "ACTIVE",
        "createdAt": "2024-01-15T10:30:00Z",
        "_count": {
          "users": 45,
          "departments": 12,
          "campuses": 3
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### 4. Get Tenant Analytics

**Endpoint:** `GET /api/tenants/:tenantId/analytics`

**Access:** SUPER_ADMIN only

**Description:** Fetches detailed analytics for a specific tenant including user growth, recent users, and various counts.

**Response:**
```json
{
  "success": true,
  "data": {
    "userCount": 45,
    "activeUserCount": 40,
    "departmentCount": 12,
    "campusCount": 3,
    "recentUsers": [
      {
        "id": "uuid",
        "email": "user@uon.ac.ke",
        "firstName": "John",
        "lastName": "Doe",
        "verified": true,
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "userGrowth": [
      {
        "createdAt": "2024-01-15T00:00:00Z",
        "_count": {
          "id": 5
        }
      }
    ]
  }
}
```

## Frontend Integration

### Dashboard Cards Data Mapping

Use the `/api/dashboard/metrics` endpoint to populate your dashboard cards:

1. **Total Clients Card**: `data.totalTenants`
2. **Total Users Card**: `data.totalUsers`
3. **Active Users Card**: `data.activeUsers`
4. **New Clients Card**: `data.newClients`

### Example Frontend Usage

```javascript
// Fetch dashboard metrics
const fetchDashboardMetrics = async () => {
  try {
    const response = await fetch('/api/dashboard/metrics', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Update dashboard cards
      setTotalClients(result.data.totalTenants);
      setTotalUsers(result.data.totalUsers);
      setActiveUsers(result.data.activeUsers);
      setNewClients(result.data.newClients);
      
      // Update recent tenants list
      setRecentTenants(result.data.recentTenants);
    }
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
  }
};
```

### Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

## Data Definitions

### Metrics Explained

1. **Total Tenants**: Count of all tenants in the system
2. **Total Users**: Count of all users across all tenants
3. **Active Users**: Count of users with `verified: true` status
4. **New Clients**: Count of tenants created in the last 30 days

### Tenant Types

- `UNIVERSITY`
- `COLLEGE`
- `SCHOOL`
- `INSTITUTE`
- `OTHER`

### Tenant Status

- `ACTIVE`
- `INACTIVE`
- `PENDING`

## Security Notes

- All endpoints require SUPER_ADMIN role
- JWT tokens are validated on every request
- Rate limiting is applied to prevent abuse
- All database queries are parameterized to prevent SQL injection 