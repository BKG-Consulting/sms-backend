# MR Dashboard Implementation Summary

## Overview
Created separate dashboard endpoints specifically for Management Representative (MR) users that show audit-specific metrics instead of system-wide metrics. MR users are primarily concerned with audit programs, audits, and document management within their institution.

## What MR Users Are Concerned With

Based on the system structure, MR users focus on:

1. **Audit Programs** - Creating, managing, and tracking audit programs
2. **Audits** - Individual audit activities and their status
3. **Documents** - Document management and change requests
4. **Compliance** - Overall compliance status and metrics

## Implemented Backend Features

### 1. Dashboard Service Methods (`src/services/dashboardService.js`)

#### `getMRDashboard(tenantId)`
- **Total Audit Programs**: Count of all audit programs
- **Active Audit Programs**: Count of approved audit programs
- **Total Audits**: Count of all audits across programs
- **Completed Audits**: Count of audits with COMPLETED status
- **Pending Audits**: Count of audits with OPEN status
- **Total Documents**: Count of all documents
- **Documents Under Review**: Count of documents in UNDER_REVIEW status
- **Change Requests**: Total count of document change requests
- **Pending Change Requests**: Count of change requests awaiting approval
- **Recent Audit Programs**: Latest 5 audit programs with creator info
- **Upcoming Audits**: Next 10 scheduled audits with team leader info

#### `getMRAuditProgramGrowthData(tenantId, timeFrame)`
- **Total Programs**: Growth trend of audit program creation
- **Approved Programs**: Growth trend of approved audit programs
- Supports monthly/yearly time frames

#### `getMRAuditActivityData(tenantId, timeFrame)`
- **Audit Status Distribution**: Open, Completed, Cancelled audits
- **Audit Types Distribution**: Distribution by audit type (FIRST_INTERNAL, SECOND_INTERNAL, etc.)
- Supports weekly time frames

#### `getMRDocumentActivityData(tenantId, timeFrame)`
- **Document Status Distribution**: Draft, Under Review, Approved, Rejected
- **Change Request Status**: Pending, Approved, Rejected change requests
- Supports weekly time frames

### 2. Controller Methods (`src/controllers/dashboardController.js`)

- `getMRDashboard(req, res)` - Main dashboard overview
- `getMRAuditProgramGrowthData(req, res)` - Audit program growth charts
- `getMRAuditActivityData(req, res)` - Audit activity charts
- `getMRAuditDocumentActivityData(req, res)` - Document activity charts

### 3. Routes (`src/routes/dashboardRoutes.js`)

Added MR-specific routes with proper role-based access control:

```javascript
// MR dashboard endpoints (MR role only)
router.get('/mr', authenticateToken, restrictTo(['MR']), dashboardController.getMRDashboard);
router.get('/mr/audit-program-growth', authenticateToken, restrictTo(['MR']), dashboardController.getMRAuditProgramGrowthData);
router.get('/mr/audit-activity', authenticateToken, restrictTo(['MR']), dashboardController.getMRAuditActivityData);
router.get('/mr/document-activity', authenticateToken, restrictTo(['MR']), dashboardController.getMRDocumentActivityData);
```

## API Endpoints

### Base URL: `http://localhost:4000/api/dashboard`

1. **GET** `/mr` - MR Dashboard Overview
2. **GET** `/mr/audit-program-growth?timeFrame=monthly` - Audit Program Growth Data
3. **GET** `/mr/audit-activity?timeFrame=this week` - Audit Activity Data
4. **GET** `/mr/document-activity?timeFrame=this week` - Document Activity Data

## Key Features

### Role-Based Access Control
- All endpoints restricted to MR role only
- Tenant-scoped data (users only see their institution's data)
- Proper authentication required

### Real-Time Metrics
- Live data from database
- No caching - always current
- Optimized queries for performance

### Chart-Ready Data Format
- Data formatted for frontend visualization
- Consistent structure across endpoints
- Time-based filtering support

### Comprehensive Coverage
- Audit program lifecycle tracking
- Individual audit status monitoring
- Document management metrics
- Change request workflow tracking

## Testing

### Manual Testing with cURL

```bash
# Get MR Dashboard Overview
curl -X GET "http://localhost:4000/api/dashboard/mr" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get Audit Program Growth Data
curl -X GET "http://localhost:4000/api/dashboard/mr/audit-program-growth?timeFrame=monthly" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get Audit Activity Data
curl -X GET "http://localhost:4000/api/dashboard/mr/audit-activity?timeFrame=this week" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get Document Activity Data
curl -X GET "http://localhost:4000/api/dashboard/mr/document-activity?timeFrame=this week" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Postman Collection
Created `MR_DASHBOARD_POSTMAN_COLLECTION.json` for easy testing.

## Error Handling

- **401 Unauthorized**: Invalid or missing JWT token
- **403 Forbidden**: User doesn't have MR role
- **500 Internal Server Error**: Server-side errors with detailed logging

## Logging

Comprehensive logging implemented:
- Request tracking with tenant ID
- Performance metrics
- Error details for debugging
- Success confirmations

## Next Steps for Frontend Integration

1. **Create MR Dashboard Page**: Frontend page for MR users
2. **Overview Cards**: Display key metrics (audit programs, audits, documents, change requests)
3. **Charts Integration**: Use chart data for visualizations
4. **Real-time Updates**: Implement polling or WebSocket for live updates
5. **Navigation**: Add MR dashboard to sidebar navigation

## Benefits

1. **Focused Metrics**: MR users see only relevant audit and document data
2. **Performance**: Optimized queries for specific use cases
3. **Security**: Role-based access ensures data isolation
4. **Scalability**: Tenant-scoped queries prevent performance issues
5. **Maintainability**: Clean separation of concerns

## Files Modified

1. `src/services/dashboardService.js` - Added MR-specific service methods
2. `src/controllers/dashboardController.js` - Added MR controller methods
3. `src/routes/dashboardRoutes.js` - Added MR routes with role restrictions
4. `MR_DASHBOARD_API_DOCS.md` - API documentation
5. `MR_DASHBOARD_POSTMAN_COLLECTION.json` - Postman collection for testing
6. `MR_DASHBOARD_IMPLEMENTATION_SUMMARY.md` - This summary document 