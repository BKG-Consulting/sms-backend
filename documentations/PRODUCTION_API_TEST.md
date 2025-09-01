# Production API Testing Guide

## Test the Production System Admin Endpoint

Since the frontend is using the production API URL (`https://auth-mfby.onrender.com/api`), let's test if the system admin endpoint is working on production.

### 1. Test Production Endpoint with Postman

#### Update the Postman Collection Variables:
- Set `baseUrl` to: `https://auth-mfby.onrender.com/api`

#### Test the System Admin Dashboard:
```
GET https://auth-mfby.onrender.com/api/dashboard/system-admin
Authorization: Bearer <your-system-admin-token>
```

### 2. Test with cURL

```bash
# Login to production
curl -X POST https://auth-mfby.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "systemadmin@duald.com",
    "password": "your-password"
  }'

# Get dashboard metrics
curl -X GET https://auth-mfby.onrender.com/api/dashboard/system-admin \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Check Browser Network Tab

1. Open the system admin dashboard in your browser
2. Open Developer Tools (F12)
3. Go to Network tab
4. Refresh the page
5. Look for the request to `/dashboard/system-admin`
6. Check the response status and data

### 4. Check Browser Console

The console logs I added should show:
- "Fetching system admin dashboard data..."
- "API Response: ..."
- "Dashboard data: ..."
- "Processed overview data: ..."

### 5. Possible Issues

#### Issue 1: Production Server Not Updated
If the production server doesn't have the new endpoint:
- Deploy the updated backend to production
- The endpoint `/dashboard/system-admin` might not exist yet

#### Issue 2: Authentication Issues
- Check if the user has the correct SYSTEM_ADMIN role
- Verify the access token is valid
- Check if the user has a valid tenantId

#### Issue 3: CORS Issues
- Check if there are CORS errors in the browser console
- The production server might have different CORS settings

### 6. Debug Steps

1. **Check Network Tab**: Look for failed requests
2. **Check Console**: Look for error messages
3. **Check Response**: Verify the API response structure
4. **Check Authentication**: Ensure the user is properly authenticated
5. **Check Role**: Ensure the user has SYSTEM_ADMIN role

### 7. Expected Results

If everything is working, you should see:
- Console logs showing the API response
- Overview cards displaying the correct numbers
- Recent users component showing the user list

### 8. Fallback Solution

If the production server doesn't have the endpoint yet:
1. Deploy the updated backend code to production
2. Or temporarily change the frontend to use localhost for testing 