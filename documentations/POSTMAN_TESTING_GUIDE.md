# Postman Testing Guide for Dashboard API

## 🚀 Quick Start

### 1. Import the Collection
1. Open Postman
2. Click "Import" button
3. Import the `Dashboard_API_Testing.postman_collection.json` file

### 2. Set Up Environment Variables
1. Create a new environment in Postman
2. Add these variables:
   - `baseUrl`: `http://localhost:4000`
   - `jwtToken`: (leave empty for now)
   - `tenantId`: (leave empty for now)

## 📋 Testing Steps

### Step 1: Start the Server
```bash
cd auth-service
npm start
```
Server should start on `http://localhost:4000`

### Step 2: Health Check
1. Run the "Health Check" request
2. Expected response: `{"status":"OK","service":"auth-service"}`

### Step 3: Get JWT Token
1. Run the "Login to get JWT Token" request
2. Update the request body with valid credentials:
   ```json
   {
     "email": "your-admin-email@example.com",
     "password": "your-password"
   }
   ```
3. Copy the `accessToken` from the response
4. Set the `jwtToken` environment variable to this token

### Step 4: Test Dashboard Metrics
1. Run "Get Dashboard Overview Metrics"
2. Expected response structure:
   ```json
   {
     "success": true,
     "data": {
       "totalTenants": 25,
       "totalUsers": 150,
       "activeUsers": 120,
       "newClients": 5,
       "recentTenants": [...],
       "userGrowth": [...],
       "tenantGrowth": [...]
     }
   }
   ```

### Step 5: Test Tenant Endpoints
1. Run "Get All Tenants" to see available tenants
2. Copy a tenant ID from the response
3. Set the `tenantId` environment variable
4. Test "Get Tenant Details" and "Get Tenant Analytics"

### Step 6: Test Enhanced Features
1. Test "Get Tenants with Statistics" with different query parameters:
   - `page=1&limit=5`
   - `search=university`
   - `page=2&limit=10&search=college`

## 🔍 Expected Responses

### Dashboard Metrics Response
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
    ]
  }
}
```

### Tenant Analytics Response
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
    ]
  }
}
```

## ⚠️ Common Issues & Solutions

### 1. "Unauthorized" Error
- **Cause**: Missing or invalid JWT token
- **Solution**: 
  - Make sure you've logged in successfully
  - Check that the `jwtToken` variable is set correctly
  - Ensure the token hasn't expired

### 2. "Forbidden" Error
- **Cause**: User doesn't have SUPER_ADMIN role
- **Solution**: 
  - Use an account with SUPER_ADMIN privileges
  - Check user roles in the database

### 3. "Connection Refused" Error
- **Cause**: Server not running
- **Solution**: 
  - Start the server with `npm start`
  - Check if port 4000 is available
  - Verify the `baseUrl` variable is correct

### 4. "Not Found" Error
- **Cause**: Invalid tenant ID
- **Solution**: 
  - Get a valid tenant ID from "Get All Tenants" endpoint
  - Update the `tenantId` environment variable

## 🧪 Testing Scenarios

### Scenario 1: Empty Database
- Expected: All counts should be 0
- Recent tenants should be empty array

### Scenario 2: Single Tenant
- Create one tenant and user
- Verify metrics show correct counts
- Check recent tenants list

### Scenario 3: Multiple Tenants
- Create multiple tenants with different creation dates
- Test pagination in "Get Tenants with Statistics"
- Verify "newClients" count (last 30 days)

### Scenario 4: Search Functionality
- Test search with partial tenant names
- Test search with domains
- Test search with email addresses

## 📊 Data Validation

### Metrics Validation
- `totalTenants` should match count in database
- `totalUsers` should match user count across all tenants
- `activeUsers` should only include verified users
- `newClients` should only include tenants created in last 30 days

### Response Time
- All endpoints should respond within 2 seconds
- Dashboard metrics should be cached if possible

### Error Handling
- Test with invalid tenant IDs
- Test with expired tokens
- Test with insufficient permissions

## 🔧 Troubleshooting

### Check Server Logs
```bash
# Look for any errors in the console
npm start
```

### Check Database Connection
```bash
# Verify database is accessible
npx prisma db push
```

### Check Environment Variables
```bash
# Verify .env file has correct database URL
cat .env
```

## 📝 Notes

- All endpoints require SUPER_ADMIN authentication
- JWT tokens expire after a certain time (check your auth configuration)
- Database queries are optimized for performance
- Error responses follow consistent format
- All timestamps are in ISO format

## 🎯 Success Criteria

✅ Health check returns 200 OK
✅ Login returns valid JWT token
✅ Dashboard metrics return real data
✅ Tenant endpoints work with pagination
✅ Search functionality works
✅ Error handling works correctly
✅ Response times are acceptable 