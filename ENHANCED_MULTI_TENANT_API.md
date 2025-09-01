# Enhanced Multi-Tenant Management API Documentation

## Overview

This document outlines the comprehensive multi-tenant management system that has been built on top of your existing infrastructure. The system provides robust tenant administration, user management, and authentication capabilities for both Super Admins and System Admins.

## System Architecture

### Current Workflow

1. **System Bootstrap**: Super Admin is seeded from `prisma/seed.js`
2. **Tenant Creation**: Super Admin creates tenants using the enhanced onboarding service
3. **Tenant Management**: System Admins manage their own tenants with comprehensive tools
4. **User Management**: Multi-role system with department-based assignments
5. **Health Monitoring**: Real-time tenant and system health tracking

### Key Components

- **Tenant Dashboard Controller**: Comprehensive analytics and management
- **Super Admin Controller**: Global system administration
- **Tenant Management Service**: Business logic for tenant operations
- **Tenant Isolation Middleware**: Security and data integrity
- **Enhanced Onboarding Service**: Streamlined tenant setup

---

## API Endpoints

### 🏢 Tenant Dashboard API

**Base URL**: `https://sms-backend-5019.onrender.com/api/tenant-dashboard`

#### Super Admin Endpoints

##### GET `/overview`
Get comprehensive overview of all tenants
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/tenant-dashboard/overview?page=1&limit=10&search=university" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

**Query Parameters:**
- `page` (optional): Page number for pagination
- `limit` (optional): Number of results per page
- `search` (optional): Search term for tenant name/domain/email
- `status` (optional): Filter by tenant status (ACTIVE, SUSPENDED, etc.)
- `type` (optional): Filter by tenant type (UNIVERSITY, COLLEGE, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "tenants": [
      {
        "id": "tenant-uuid",
        "name": "Sample University",
        "domain": "sample-university",
        "email": "admin@sample.edu",
        "type": "UNIVERSITY",
        "status": "ACTIVE",
        "stats": {
          "totalUsers": 150,
          "activeUsers": 140,
          "departments": 8,
          "userUtilization": "75.0"
        },
        "health": {
          "userActivityLevel": "active",
          "configurationComplete": true,
          "subscriptionActive": true
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    },
    "globalStats": {
      "totalTenants": 25,
      "avgMaxUsers": 200,
      "avgStorageLimit": 10
    }
  }
}
```

##### GET `/analytics/:tenantId`
Get detailed analytics for a specific tenant
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/tenant-dashboard/analytics/tenant-uuid?timeframe=30d" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

##### GET `/health/:tenantId`
Get tenant health status
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/tenant-dashboard/health/tenant-uuid" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

#### System Admin Endpoints

##### GET `/current`
Get dashboard for current tenant
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/tenant-dashboard/current" \
  -H "Authorization: Bearer YOUR_SYSTEM_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant-uuid",
      "name": "Sample University",
      "domain": "sample-university",
      "type": "UNIVERSITY",
      "maxUsers": 200,
      "branding": {
        "primaryColor": "#00A79D",
        "logoUrl": "https://example.com/logo.png"
      }
    },
    "overview": {
      "totalUsers": 150,
      "verifiedUsers": 140,
      "totalDepartments": 8,
      "userCapacityUsed": 75
    },
    "departments": [
      {
        "id": "dept-uuid",
        "name": "Computer Science",
        "userCount": 25,
        "hod": "Dr. John Smith"
      }
    ],
    "quickActions": [
      {
        "action": "createUser",
        "label": "Add New User",
        "icon": "user-plus"
      }
    ]
  }
}
```

##### GET `/my-health`
Get health status for current tenant
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/tenant-dashboard/my-health" \
  -H "Authorization: Bearer YOUR_SYSTEM_ADMIN_TOKEN"
```

#### Shared Endpoints

##### GET `/quick-stats`
Get quick statistics for dashboard widgets
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/tenant-dashboard/quick-stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

##### POST `/actions/suspend-tenant/:tenantId`
Suspend a tenant (Super Admin only)
```bash
curl -X POST "https://sms-backend-5019.onrender.com/api/tenant-dashboard/actions/suspend-tenant/tenant-uuid" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Policy violation"}'
```

---

### 👑 Super Admin API

**Base URL**: `https://sms-backend-5019.onrender.com/api/super-admin`

#### System Overview

##### GET `/overview`
Get comprehensive system overview
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/super-admin/overview?timeframe=30d" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

##### GET `/health`
Get system health status
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/super-admin/health" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

##### GET `/analytics`
Get advanced system analytics
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/super-admin/analytics?timeframe=90d&metrics=all" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

#### Tenant Management

##### POST `/tenants/bulk-actions`
Perform bulk actions on multiple tenants
```bash
curl -X POST "https://sms-backend-5019.onrender.com/api/super-admin/tenants/bulk-actions" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "suspend",
    "tenantIds": ["tenant-1", "tenant-2"],
    "reason": "Maintenance required"
  }'
```

##### POST `/users/bulk-create`
Bulk create users for a specific tenant
```bash
curl -X POST "https://sms-backend-5019.onrender.com/api/super-admin/users/bulk-create" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-uuid",
    "users": [
      {
        "email": "user1@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "roleIds": ["role-uuid"]
      },
      {
        "email": "user2@example.com",
        "firstName": "Jane",
        "lastName": "Smith"
      }
    ]
  }'
```

#### Data Export

##### GET `/export/system`
Export system data for backup or migration
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/super-admin/export/system?includeAllTenants=true&includeUsers=true" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -o system-backup.json
```

#### Maintenance Operations

##### POST `/maintenance`
Perform system maintenance operations
```bash
curl -X POST "https://sms-backend-5019.onrender.com/api/super-admin/maintenance" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "cleanup_sessions",
    "parameters": {}
  }'
```

Available operations:
- `cleanup_sessions`: Remove expired sessions
- `cleanup_tokens`: Remove expired refresh tokens
- `data_integrity_check`: Check for orphaned records
- `tenant_health_scan`: Scan all tenant health

##### POST `/maintenance/database-cleanup`
Comprehensive database cleanup
```bash
curl -X POST "https://sms-backend-5019.onrender.com/api/super-admin/maintenance/database-cleanup" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

#### Configuration

##### GET `/config`
Get system configuration
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/super-admin/config" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

##### PUT `/config`
Update system configuration
```bash
curl -X PUT "https://sms-backend-5019.onrender.com/api/super-admin/config" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maintenance": {
      "enabled": false
    },
    "registration": {
      "enabled": true,
      "requireApproval": false
    }
  }'
```

#### Monitoring

##### GET `/alerts`
Get system alerts and notifications
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/super-admin/alerts?timeframe=24h" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

##### GET `/logs`
Get system logs
```bash
curl -X GET "https://sms-backend-5019.onrender.com/api/super-admin/logs?level=error&limit=50" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

---

## 🔧 Enhanced Features

### Multi-Role System
- **System Roles**: Tenant-wide roles (SYSTEM_ADMIN, etc.)
- **Department Roles**: Department-specific roles (HOD, STAFF, etc.)
- **Permission Overrides**: User-specific permission grants/revokes

### Tenant Isolation
- **Middleware Protection**: Automatic tenant boundary validation
- **Data Integrity**: Cross-tenant data leak prevention
- **Safety Hooks**: Transaction-level validation

### Health Monitoring
- **Real-time Metrics**: User activity, system configuration
- **Health Scores**: Automated scoring system
- **Recommendations**: Actionable improvement suggestions

### Bulk Operations
- **User Management**: Bulk user creation with role assignment
- **Tenant Actions**: Mass suspend/activate/delete operations
- **Data Export**: Comprehensive backup and migration tools

---

## 🚀 Getting Started

### 1. Super Admin Setup
The super admin is automatically seeded. Use these credentials to access the system:
```
Email: superadmin@dualdimension.consulting
Password: [From your seed file]
```

### 2. Create Your First Tenant
```bash
curl -X POST "https://sms-backend-5019.onrender.com/api/tenants" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant": {
      "name": "Sample University",
      "domain": "sample-university",
      "email": "admin@sample.edu",
      "type": "UNIVERSITY",
      "primaryColor": "#00A79D",
      "secondaryColor": "#EF8201"
    },
    "adminUser": {
      "email": "admin@sample.edu",
      "firstName": "System",
      "lastName": "Administrator",
      "password": "SecurePassword123!"
    }
  }'
```

### 3. Access Tenant Dashboard
After creating a tenant, the system admin can access:
- Current tenant dashboard: `GET /api/tenant-dashboard/current`
- Tenant health: `GET /api/tenant-dashboard/my-health`
- User management through existing user APIs

### 4. Monitor System Health
Super admins can monitor:
- System overview: `GET /api/super-admin/overview`
- Health status: `GET /api/super-admin/health`
- Active alerts: `GET /api/super-admin/alerts`

---

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication with tenant context
- Role-based access control (RBAC)
- Permission-based fine-grained access

### Tenant Isolation
- Automatic tenant boundary validation
- Cross-tenant data leak prevention
- Transaction-level safety hooks

### Audit & Logging
- Comprehensive audit logging
- Security event tracking
- Performance monitoring

---

## 📊 Analytics & Reporting

### Tenant Analytics
- User growth and engagement metrics
- Department utilization
- Resource usage tracking
- Performance indicators

### System Analytics
- Global tenant statistics
- Growth trends and patterns
- Resource distribution
- Health monitoring

---

## 🛠️ Maintenance & Operations

### Automated Maintenance
- Session cleanup
- Token expiration handling
- Data integrity checks
- Orphaned record cleanup

### Health Monitoring
- Real-time health scoring
- Automated recommendations
- Alert generation
- Performance tracking

### Data Management
- Comprehensive data export
- Tenant backup capabilities
- Migration tools
- Bulk operations

---

## 📈 Performance Optimizations

### Database Efficiency
- Optimized queries with proper indexing
- Batch operations for bulk tasks
- Transaction management
- Connection pooling

### Caching Strategy
- Session caching
- User context caching
- Permission caching
- Query result caching

### Scalability Features
- Horizontal scaling support
- Load balancing ready
- Microservice architecture compatible
- Resource monitoring

---

This enhanced multi-tenant system provides a robust foundation for managing multiple organizations with comprehensive security, monitoring, and administrative capabilities.
