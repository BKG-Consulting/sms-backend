# System Admin Dashboard API Testing Guide

## Overview
This guide provides step-by-step instructions for testing the System Admin dashboard endpoints using Postman.

## Prerequisites
1. **Backend Server Running**: Ensure your auth service is running on `http://localhost:3000`
2. **Database Setup**: Make sure your database is properly configured and seeded
3. **Postman Installed**: Download and install Postman from [postman.com](https://www.postman.com/)

## Import Postman Collection
1. Open Postman
2. Click "Import" button
3. Select the `SYSTEM_ADMIN_POSTMAN_COLLECTION.json` file
4. The collection will be imported with all the necessary requests

## Testing Steps

### Step 1: Set Up Environment Variables
1. In Postman, go to the collection settings
2. Set the following variables:
   - `baseUrl`: `http://localhost:3000` (or your server URL)
   - `accessToken`: Leave empty (will be set automatically after login)

### Step 2: Authentication Testing

#### 2.1 Login as System Admin
1. Run the "Login as System Admin" request
2. **Expected Response**: 200 OK with access token
3. **Response Body**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "systemadmin@example.com",
    "firstName": "System",
    "lastName": "Admin",
    "tenantId": "tenant-id",
    "roles": [
      {
        "id": "role-id",
        "name": "SYSTEM_ADMIN"
      }
    ]
  }
}
```

#### 2.2 Verify Current User
1. Run the "Get Current User (Verify Token)" request
2. **Expected Response**: 200 OK with user details
3. **Verify**: User has SYSTEM_ADMIN role and tenantId

### Step 3: System Admin Dashboard Testing

#### 3.1 Get Dashboard Metrics (Success Case)
1. Run the "Get System Admin Dashboard Metrics" request
2. **Expected Response**: 200 OK
3. **Response Structure**:
```json
{
  "success": true,
  "data": {
    "totalUsers": 25,
    "activeUsers": 20,
    "totalDepartments": 5,
    "totalCampuses": 2,
    "recentUsers": [
      {
        "id": "user-id",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "verified": true,
        "createdAt": "2024-01-15T10:30:00Z",
        "department": {
          "name": "Computer Science"
        }
      }
    ],
    "userGrowth": [
      {
        "_count": {
          "id": 5
        },
        "createdAt": "2024-01-15T00:00:00Z"
      }
    ]
  }
}
```

#### 3.2 Test Unauthorized Access
1. Remove the Authorization header or use an invalid token
2. Run the "Get System Admin Dashboard - Unauthorized (No Token)" request
3. **Expected Response**: 401 Unauthorized

#### 3.3 Test Wrong Role Access
1. Login as a SUPER_ADMIN user
2. Try to access the system admin dashboard
3. **Expected Response**: 403 Forbidden

### Step 4: Sample Data Setup (Optional)

#### 4.1 Create Test Tenant
1. Run the "Create Test Tenant" request
2. **Expected Response**: 201 Created
3. **Purpose**: Creates a new tenant with a system admin user

#### 4.2 Login as Test System Admin
1. Run the "Login as Test System Admin" request
2. **Expected Response**: 200 OK
3. **Purpose**: Tests with fresh data

## Manual Testing with cURL

### Login as System Admin
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "systemadmin@example.com",
    "password": "password123"
  }'
```

### Get Dashboard Metrics
```bash
curl -X GET http://localhost:3000/dashboard/system-admin \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Expected Test Results

### ✅ Success Cases
1. **Valid System Admin Login**: Returns access token and user details
2. **Dashboard Metrics**: Returns tenant-specific metrics
3. **Recent Users**: Returns array of recent users with proper structure
4. **User Growth**: Returns growth data for the last 6 months

### ❌ Error Cases
1. **Invalid Credentials**: 401 Unauthorized
2. **Missing Token**: 401 Unauthorized
3. **Wrong Role**: 403 Forbidden
4. **Invalid Token**: 401 Unauthorized

## Data Validation

### Dashboard Metrics Validation
- `totalUsers`: Number of all users in the tenant
- `activeUsers`: Number of verified users in the tenant
- `totalDepartments`: Number of departments in the tenant
- `totalCampuses`: Number of campuses in the tenant
- `recentUsers`: Array of last 10 users with department info
- `userGrowth`: Array of user creation data over time

### Recent Users Validation
Each user object should contain:
- `id`: Unique user identifier
- `email`: User's email address
- `firstName`: User's first name
- `lastName`: User's last name
- `verified`: Boolean indicating verification status
- `createdAt`: User creation timestamp
- `department`: Object with department name (if assigned)

## Troubleshooting

### Common Issues

#### 1. Server Not Running
**Error**: Connection refused
**Solution**: Start the auth service with `npm start`

#### 2. Database Connection Issues
**Error**: Database connection failed
**Solution**: Check database configuration and ensure it's running

#### 3. Invalid Token
**Error**: 401 Unauthorized
**Solution**: Re-login to get a fresh token

#### 4. Wrong Role
**Error**: 403 Forbidden
**Solution**: Ensure the user has SYSTEM_ADMIN role

#### 5. No Tenant Data
**Error**: Empty metrics
**Solution**: Create test data or ensure the user has a valid tenantId

### Debug Steps
1. Check server logs for errors
2. Verify database has data
3. Confirm user roles and permissions
4. Test with different user accounts
5. Check network connectivity

## Performance Testing

### Load Testing
```bash
# Test with multiple concurrent requests
curl -X GET http://localhost:3000/dashboard/system-admin \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -w "Time: %{time_total}s\n"
```

### Expected Performance
- Response time: < 500ms
- Database queries: Optimized with proper indexing
- Memory usage: Minimal for dashboard queries

## Security Testing

### Authentication Tests
1. **No Token**: Should return 401
2. **Invalid Token**: Should return 401
3. **Expired Token**: Should return 401
4. **Valid Token**: Should return 200

### Authorization Tests
1. **SYSTEM_ADMIN Role**: Should have access
2. **SUPER_ADMIN Role**: Should be denied (403)
3. **Other Roles**: Should be denied (403)

### Data Isolation Tests
1. **Tenant A User**: Should only see Tenant A data
2. **Tenant B User**: Should only see Tenant B data
3. **Cross-tenant Access**: Should be prevented

## API Documentation

### Endpoint: GET /dashboard/system-admin
- **Purpose**: Get system admin dashboard metrics
- **Authentication**: Required (Bearer token)
- **Authorization**: SYSTEM_ADMIN role required
- **Response**: JSON with tenant-specific metrics
- **Rate Limiting**: Standard rate limits apply

### Response Codes
- `200`: Success - Dashboard data returned
- `401`: Unauthorized - Invalid or missing token
- `403`: Forbidden - Insufficient permissions
- `500`: Server Error - Internal server error

## Next Steps
After successful testing:
1. Deploy to staging environment
2. Perform integration testing
3. Test with real user data
4. Monitor performance in production
5. Set up automated testing 