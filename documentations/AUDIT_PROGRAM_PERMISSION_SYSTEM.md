# Audit Program Permission System

## Overview

The Audit Program Permission System is a comprehensive, domain-specific permission management solution designed to provide granular access control for audit program operations. This system replaces the generic permission matrix with a focused, module-by-module approach.

## Architecture

### 1. Permission Structure

The system uses a hierarchical permission structure:

```
auditProgram:action
├── Core Operations
│   ├── auditProgram:create
│   ├── auditProgram:read
│   ├── auditProgram:update
│   └── auditProgram:delete
├── Workflow
│   ├── auditProgram:commit
│   ├── auditProgram:approve
│   └── auditProgram:reject
├── Advanced Operations
│   ├── auditProgram:export
│   └── auditProgram:manage
├── Audit Management
│   ├── auditProgram:audit:create
│   ├── auditProgram:audit:read
│   ├── auditProgram:audit:update
│   └── auditProgram:audit:delete
├── Team Management
│   └── auditProgram:team:manage
└── Meeting Management
    ├── auditProgram:meeting:create
    ├── auditProgram:meeting:read
    ├── auditProgram:meeting:update
    └── auditProgram:meeting:delete
```

### 2. Permission Categories

#### Core Operations
- **auditProgram:create** - Create new audit programs
- **auditProgram:read** - View audit program details and list
- **auditProgram:update** - Edit audit program details
- **auditProgram:delete** - Delete audit programs (only DRAFT status)

#### Workflow
- **auditProgram:commit** - Commit audit program for review
- **auditProgram:approve** - Approve committed audit programs
- **auditProgram:reject** - Reject committed audit programs

#### Advanced Operations
- **auditProgram:export** - Export audit program data
- **auditProgram:manage** - Full management of audit programs

#### Audit Management
- **auditProgram:audit:create** - Create audits within audit programs
- **auditProgram:audit:read** - View audits within audit programs
- **auditProgram:audit:update** - Edit audits within audit programs
- **auditProgram:audit:delete** - Delete audits within audit programs

#### Team Management
- **auditProgram:team:manage** - Manage audit team members

#### Meeting Management
- **auditProgram:meeting:create** - Create planning meetings
- **auditProgram:meeting:read** - View planning meetings
- **auditProgram:meeting:update** - Edit planning meetings
- **auditProgram:meeting:delete** - Delete planning meetings

## Implementation

### Backend Components

#### 1. Permission Constants (`constants/auditProgramPermissions.js`)
```javascript
const AUDIT_PROGRAM_PERMISSIONS = {
  'auditProgram:create': {
    id: 'audit-program-create',
    module: 'auditProgram',
    action: 'create',
    description: 'Create new audit programs',
    category: 'Core Operations',
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  // ... more permissions
};
```

#### 2. Permission Middleware (`middleware/auditProgramPermissionMiddleware.js`)
```javascript
const requireAuditProgramCreatePermission = async (req, res, next) => {
  const hasAccess = await hasPermission(req.user, 'auditProgram:create');
  if (!hasAccess) {
    return res.status(403).json({
      error: 'Permission denied',
      message: 'You do not have permission to create audit programs'
    });
  }
  next();
};
```

#### 3. Route Protection (`routes/auditProgramRoutes.js`)
```javascript
router.post('/', 
  authenticateToken, 
  requireAuditProgramCreatePermission,
  auditProgramController.createAuditProgram
);
```

### Frontend Components

#### 1. Permission Matrix Component (`AuditProgramPermissionMatrix.tsx`)
- Dedicated component for audit program permissions
- Category-based organization
- Real-time permission toggling
- Search and filter capabilities

#### 2. Permission Page (`admin/audit-program-permissions/page.tsx`)
- Standalone page for permission management
- Comprehensive documentation
- User-friendly interface

## Default Role Permissions

### SYSTEM_ADMIN
- All permissions (full access)

### MR (Management Representative)
- All permissions except `auditProgram:meeting:delete`

### PRINCIPAL
- All permissions except `auditProgram:manage` and `auditProgram:meeting:delete`

### HOD (Head of Department)
- Core operations (create, read, update)
- Workflow (commit)
- Advanced operations (export)
- Audit management (create, read, update)
- Team management
- Meeting management (create, read, update)

### AUDITOR
- Read permissions only (auditProgram:read, auditProgram:audit:read, auditProgram:meeting:read)

### STAFF
- Read permissions only (auditProgram:read, auditProgram:audit:read, auditProgram:meeting:read)

### ADMIN
- Limited read and export permissions

## Usage Guide

### For SYSTEM_ADMINs

1. **Access the Permission Matrix**
   - Navigate to `/admin/audit-program-permissions`
   - Or go to `/manage-institution` → Permissions tab

2. **Manage Permissions**
   - Check/uncheck boxes to grant/revoke permissions
   - Changes are saved automatically
   - Use search to find specific roles
   - Filter by permission categories

3. **Monitor Changes**
   - View summary statistics
   - Track permission assignments
   - Monitor role-specific permission counts

### For Developers

1. **Adding New Permissions**
   ```javascript
   // Add to constants/auditProgramPermissions.js
   'auditProgram:new:action': {
     id: 'audit-program-new-action',
     module: 'auditProgram',
     action: 'new:action',
     description: 'Description of new permission',
     category: 'Category Name',
     roles: ['SYSTEM_ADMIN', 'MR']
   }
   ```

2. **Creating Middleware**
   ```javascript
   // Add to middleware/auditProgramPermissionMiddleware.js
   const requireAuditProgramNewActionPermission = async (req, res, next) => {
     const hasAccess = await hasPermission(req.user, 'auditProgram:new:action');
     if (!hasAccess) {
       return res.status(403).json({
         error: 'Permission denied',
         message: 'You do not have permission to perform this action'
       });
     }
     next();
   };
   ```

3. **Protecting Routes**
   ```javascript
   // Add to routes/auditProgramRoutes.js
   router.post('/new-action', 
     authenticateToken, 
     requireAuditProgramNewActionPermission,
     auditProgramController.newAction
   );
   ```

## Database Schema

### Permission Model
```sql
model Permission {
  id          String   @id @default(uuid())
  module      String
  action      String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([module, action])
}
```

### RolePermission Model
```sql
model RolePermission {
  id           String     @id @default(uuid())
  roleId       String
  permissionId String
  allowed      Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  
  @@unique([roleId, permissionId])
}
```

## Security Features

### 1. Granular Access Control
- Each operation requires specific permission
- No blanket access to audit program domain
- Role-based permission assignment

### 2. Audit Logging
- All permission changes are logged
- User actions are tracked
- Compliance with audit requirements

### 3. Tenant Isolation
- Permissions are scoped to tenant
- Cross-tenant access prevention
- Secure data boundaries

### 4. Optimistic Updates
- Immediate UI feedback
- Automatic rollback on errors
- Consistent state management

## Testing

### 1. Permission Testing
```bash
# Run the seeding script
node scripts/seed_audit_program_permissions.js

# Test specific permissions
curl -X POST /api/audit-programs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "objectives": "Test"}'
```

### 2. Frontend Testing
- Navigate to permission matrix
- Toggle permissions
- Verify API calls
- Check optimistic updates

## Migration Guide

### From Generic Permission Matrix

1. **Backup Current Permissions**
   ```sql
   -- Export current role permissions
   SELECT * FROM "RolePermission" WHERE "permissionId" IN (
     SELECT id FROM "Permission" WHERE module = 'auditProgram'
   );
   ```

2. **Run Seeding Script**
   ```bash
   node scripts/seed_audit_program_permissions.js
   ```

3. **Update Frontend**
   - Replace generic matrix with domain-specific component
   - Update permission checks in components
   - Test all audit program operations

4. **Verify Permissions**
   - Check that all roles have appropriate permissions
   - Test each operation with different roles
   - Verify audit logging

## Troubleshooting

### Common Issues

1. **Permission Not Found**
   - Check if permission exists in database
   - Verify permission string format
   - Run seeding script if needed

2. **Role Not Found**
   - Ensure role exists in database
   - Check role name spelling
   - Verify tenant association

3. **UI Not Updating**
   - Check optimistic update logic
   - Verify API responses
   - Clear browser cache

### Debug Commands

```bash
# Check permissions in database
psql -d your_database -c "SELECT * FROM \"Permission\" WHERE module = 'auditProgram';"

# Check role permissions
psql -d your_database -c "SELECT r.name, p.module, p.action FROM \"RolePermission\" rp JOIN \"Role\" r ON rp.\"roleId\" = r.id JOIN \"Permission\" p ON rp.\"permissionId\" = p.id WHERE p.module = 'auditProgram';"

# Reset permissions
node scripts/seed_audit_program_permissions.js
```

## Future Enhancements

### 1. Dynamic Permission Categories
- User-defined permission categories
- Custom permission descriptions
- Flexible permission organization

### 2. Permission Inheritance
- Role hierarchy support
- Inherited permissions
- Override capabilities

### 3. Advanced Filtering
- Permission-based filtering
- Role-based filtering
- Category-based filtering

### 4. Bulk Operations
- Bulk permission assignment
- Template-based permissions
- Import/export functionality

## Conclusion

The Audit Program Permission System provides a robust, scalable foundation for permission management. Its domain-specific approach ensures clarity, maintainability, and security while providing the flexibility needed for complex audit workflows.

This system serves as a template for implementing similar permission systems for other domains (documents, users, departments, etc.) following the same modular approach. 

## Overview

The Audit Program Permission System is a comprehensive, domain-specific permission management solution designed to provide granular access control for audit program operations. This system replaces the generic permission matrix with a focused, module-by-module approach.

## Architecture

### 1. Permission Structure

The system uses a hierarchical permission structure:

```
auditProgram:action
├── Core Operations
│   ├── auditProgram:create
│   ├── auditProgram:read
│   ├── auditProgram:update
│   └── auditProgram:delete
├── Workflow
│   ├── auditProgram:commit
│   ├── auditProgram:approve
│   └── auditProgram:reject
├── Advanced Operations
│   ├── auditProgram:export
│   └── auditProgram:manage
├── Audit Management
│   ├── auditProgram:audit:create
│   ├── auditProgram:audit:read
│   ├── auditProgram:audit:update
│   └── auditProgram:audit:delete
├── Team Management
│   └── auditProgram:team:manage
└── Meeting Management
    ├── auditProgram:meeting:create
    ├── auditProgram:meeting:read
    ├── auditProgram:meeting:update
    └── auditProgram:meeting:delete
```

### 2. Permission Categories

#### Core Operations
- **auditProgram:create** - Create new audit programs
- **auditProgram:read** - View audit program details and list
- **auditProgram:update** - Edit audit program details
- **auditProgram:delete** - Delete audit programs (only DRAFT status)

#### Workflow
- **auditProgram:commit** - Commit audit program for review
- **auditProgram:approve** - Approve committed audit programs
- **auditProgram:reject** - Reject committed audit programs

#### Advanced Operations
- **auditProgram:export** - Export audit program data
- **auditProgram:manage** - Full management of audit programs

#### Audit Management
- **auditProgram:audit:create** - Create audits within audit programs
- **auditProgram:audit:read** - View audits within audit programs
- **auditProgram:audit:update** - Edit audits within audit programs
- **auditProgram:audit:delete** - Delete audits within audit programs

#### Team Management
- **auditProgram:team:manage** - Manage audit team members

#### Meeting Management
- **auditProgram:meeting:create** - Create planning meetings
- **auditProgram:meeting:read** - View planning meetings
- **auditProgram:meeting:update** - Edit planning meetings
- **auditProgram:meeting:delete** - Delete planning meetings

## Implementation

### Backend Components

#### 1. Permission Constants (`constants/auditProgramPermissions.js`)
```javascript
const AUDIT_PROGRAM_PERMISSIONS = {
  'auditProgram:create': {
    id: 'audit-program-create',
    module: 'auditProgram',
    action: 'create',
    description: 'Create new audit programs',
    category: 'Core Operations',
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  // ... more permissions
};
```

#### 2. Permission Middleware (`middleware/auditProgramPermissionMiddleware.js`)
```javascript
const requireAuditProgramCreatePermission = async (req, res, next) => {
  const hasAccess = await hasPermission(req.user, 'auditProgram:create');
  if (!hasAccess) {
    return res.status(403).json({
      error: 'Permission denied',
      message: 'You do not have permission to create audit programs'
    });
  }
  next();
};
```

#### 3. Route Protection (`routes/auditProgramRoutes.js`)
```javascript
router.post('/', 
  authenticateToken, 
  requireAuditProgramCreatePermission,
  auditProgramController.createAuditProgram
);
```

### Frontend Components

#### 1. Permission Matrix Component (`AuditProgramPermissionMatrix.tsx`)
- Dedicated component for audit program permissions
- Category-based organization
- Real-time permission toggling
- Search and filter capabilities

#### 2. Permission Page (`admin/audit-program-permissions/page.tsx`)
- Standalone page for permission management
- Comprehensive documentation
- User-friendly interface

## Default Role Permissions

### SYSTEM_ADMIN
- All permissions (full access)

### MR (Management Representative)
- All permissions except `auditProgram:meeting:delete`

### PRINCIPAL
- All permissions except `auditProgram:manage` and `auditProgram:meeting:delete`

### HOD (Head of Department)
- Core operations (create, read, update)
- Workflow (commit)
- Advanced operations (export)
- Audit management (create, read, update)
- Team management
- Meeting management (create, read, update)

### AUDITOR
- Read permissions only (auditProgram:read, auditProgram:audit:read, auditProgram:meeting:read)

### STAFF
- Read permissions only (auditProgram:read, auditProgram:audit:read, auditProgram:meeting:read)

### ADMIN
- Limited read and export permissions

## Usage Guide

### For SYSTEM_ADMINs

1. **Access the Permission Matrix**
   - Navigate to `/admin/audit-program-permissions`
   - Or go to `/manage-institution` → Permissions tab

2. **Manage Permissions**
   - Check/uncheck boxes to grant/revoke permissions
   - Changes are saved automatically
   - Use search to find specific roles
   - Filter by permission categories

3. **Monitor Changes**
   - View summary statistics
   - Track permission assignments
   - Monitor role-specific permission counts

### For Developers

1. **Adding New Permissions**
   ```javascript
   // Add to constants/auditProgramPermissions.js
   'auditProgram:new:action': {
     id: 'audit-program-new-action',
     module: 'auditProgram',
     action: 'new:action',
     description: 'Description of new permission',
     category: 'Category Name',
     roles: ['SYSTEM_ADMIN', 'MR']
   }
   ```

2. **Creating Middleware**
   ```javascript
   // Add to middleware/auditProgramPermissionMiddleware.js
   const requireAuditProgramNewActionPermission = async (req, res, next) => {
     const hasAccess = await hasPermission(req.user, 'auditProgram:new:action');
     if (!hasAccess) {
       return res.status(403).json({
         error: 'Permission denied',
         message: 'You do not have permission to perform this action'
       });
     }
     next();
   };
   ```

3. **Protecting Routes**
   ```javascript
   // Add to routes/auditProgramRoutes.js
   router.post('/new-action', 
     authenticateToken, 
     requireAuditProgramNewActionPermission,
     auditProgramController.newAction
   );
   ```

## Database Schema

### Permission Model
```sql
model Permission {
  id          String   @id @default(uuid())
  module      String
  action      String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([module, action])
}
```

### RolePermission Model
```sql
model RolePermission {
  id           String     @id @default(uuid())
  roleId       String
  permissionId String
  allowed      Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  
  @@unique([roleId, permissionId])
}
```

## Security Features

### 1. Granular Access Control
- Each operation requires specific permission
- No blanket access to audit program domain
- Role-based permission assignment

### 2. Audit Logging
- All permission changes are logged
- User actions are tracked
- Compliance with audit requirements

### 3. Tenant Isolation
- Permissions are scoped to tenant
- Cross-tenant access prevention
- Secure data boundaries

### 4. Optimistic Updates
- Immediate UI feedback
- Automatic rollback on errors
- Consistent state management

## Testing

### 1. Permission Testing
```bash
# Run the seeding script
node scripts/seed_audit_program_permissions.js

# Test specific permissions
curl -X POST /api/audit-programs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "objectives": "Test"}'
```

### 2. Frontend Testing
- Navigate to permission matrix
- Toggle permissions
- Verify API calls
- Check optimistic updates

## Migration Guide

### From Generic Permission Matrix

1. **Backup Current Permissions**
   ```sql
   -- Export current role permissions
   SELECT * FROM "RolePermission" WHERE "permissionId" IN (
     SELECT id FROM "Permission" WHERE module = 'auditProgram'
   );
   ```

2. **Run Seeding Script**
   ```bash
   node scripts/seed_audit_program_permissions.js
   ```

3. **Update Frontend**
   - Replace generic matrix with domain-specific component
   - Update permission checks in components
   - Test all audit program operations

4. **Verify Permissions**
   - Check that all roles have appropriate permissions
   - Test each operation with different roles
   - Verify audit logging

## Troubleshooting

### Common Issues

1. **Permission Not Found**
   - Check if permission exists in database
   - Verify permission string format
   - Run seeding script if needed

2. **Role Not Found**
   - Ensure role exists in database
   - Check role name spelling
   - Verify tenant association

3. **UI Not Updating**
   - Check optimistic update logic
   - Verify API responses
   - Clear browser cache

### Debug Commands

```bash
# Check permissions in database
psql -d your_database -c "SELECT * FROM \"Permission\" WHERE module = 'auditProgram';"

# Check role permissions
psql -d your_database -c "SELECT r.name, p.module, p.action FROM \"RolePermission\" rp JOIN \"Role\" r ON rp.\"roleId\" = r.id JOIN \"Permission\" p ON rp.\"permissionId\" = p.id WHERE p.module = 'auditProgram';"

# Reset permissions
node scripts/seed_audit_program_permissions.js
```

## Future Enhancements

### 1. Dynamic Permission Categories
- User-defined permission categories
- Custom permission descriptions
- Flexible permission organization

### 2. Permission Inheritance
- Role hierarchy support
- Inherited permissions
- Override capabilities

### 3. Advanced Filtering
- Permission-based filtering
- Role-based filtering
- Category-based filtering

### 4. Bulk Operations
- Bulk permission assignment
- Template-based permissions
- Import/export functionality

## Conclusion

The Audit Program Permission System provides a robust, scalable foundation for permission management. Its domain-specific approach ensures clarity, maintainability, and security while providing the flexibility needed for complex audit workflows.

This system serves as a template for implementing similar permission systems for other domains (documents, users, departments, etc.) following the same modular approach. 

## Overview

The Audit Program Permission System is a comprehensive, domain-specific permission management solution designed to provide granular access control for audit program operations. This system replaces the generic permission matrix with a focused, module-by-module approach.

## Architecture

### 1. Permission Structure

The system uses a hierarchical permission structure:

```
auditProgram:action
├── Core Operations
│   ├── auditProgram:create
│   ├── auditProgram:read
│   ├── auditProgram:update
│   └── auditProgram:delete
├── Workflow
│   ├── auditProgram:commit
│   ├── auditProgram:approve
│   └── auditProgram:reject
├── Advanced Operations
│   ├── auditProgram:export
│   └── auditProgram:manage
├── Audit Management
│   ├── auditProgram:audit:create
│   ├── auditProgram:audit:read
│   ├── auditProgram:audit:update
│   └── auditProgram:audit:delete
├── Team Management
│   └── auditProgram:team:manage
└── Meeting Management
    ├── auditProgram:meeting:create
    ├── auditProgram:meeting:read
    ├── auditProgram:meeting:update
    └── auditProgram:meeting:delete
```

### 2. Permission Categories

#### Core Operations
- **auditProgram:create** - Create new audit programs
- **auditProgram:read** - View audit program details and list
- **auditProgram:update** - Edit audit program details
- **auditProgram:delete** - Delete audit programs (only DRAFT status)

#### Workflow
- **auditProgram:commit** - Commit audit program for review
- **auditProgram:approve** - Approve committed audit programs
- **auditProgram:reject** - Reject committed audit programs

#### Advanced Operations
- **auditProgram:export** - Export audit program data
- **auditProgram:manage** - Full management of audit programs

#### Audit Management
- **auditProgram:audit:create** - Create audits within audit programs
- **auditProgram:audit:read** - View audits within audit programs
- **auditProgram:audit:update** - Edit audits within audit programs
- **auditProgram:audit:delete** - Delete audits within audit programs

#### Team Management
- **auditProgram:team:manage** - Manage audit team members

#### Meeting Management
- **auditProgram:meeting:create** - Create planning meetings
- **auditProgram:meeting:read** - View planning meetings
- **auditProgram:meeting:update** - Edit planning meetings
- **auditProgram:meeting:delete** - Delete planning meetings

## Implementation

### Backend Components

#### 1. Permission Constants (`constants/auditProgramPermissions.js`)
```javascript
const AUDIT_PROGRAM_PERMISSIONS = {
  'auditProgram:create': {
    id: 'audit-program-create',
    module: 'auditProgram',
    action: 'create',
    description: 'Create new audit programs',
    category: 'Core Operations',
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  // ... more permissions
};
```

#### 2. Permission Middleware (`middleware/auditProgramPermissionMiddleware.js`)
```javascript
const requireAuditProgramCreatePermission = async (req, res, next) => {
  const hasAccess = await hasPermission(req.user, 'auditProgram:create');
  if (!hasAccess) {
    return res.status(403).json({
      error: 'Permission denied',
      message: 'You do not have permission to create audit programs'
    });
  }
  next();
};
```

#### 3. Route Protection (`routes/auditProgramRoutes.js`)
```javascript
router.post('/', 
  authenticateToken, 
  requireAuditProgramCreatePermission,
  auditProgramController.createAuditProgram
);
```

### Frontend Components

#### 1. Permission Matrix Component (`AuditProgramPermissionMatrix.tsx`)
- Dedicated component for audit program permissions
- Category-based organization
- Real-time permission toggling
- Search and filter capabilities

#### 2. Permission Page (`admin/audit-program-permissions/page.tsx`)
- Standalone page for permission management
- Comprehensive documentation
- User-friendly interface

## Default Role Permissions

### SYSTEM_ADMIN
- All permissions (full access)

### MR (Management Representative)
- All permissions except `auditProgram:meeting:delete`

### PRINCIPAL
- All permissions except `auditProgram:manage` and `auditProgram:meeting:delete`

### HOD (Head of Department)
- Core operations (create, read, update)
- Workflow (commit)
- Advanced operations (export)
- Audit management (create, read, update)
- Team management
- Meeting management (create, read, update)

### AUDITOR
- Read permissions only (auditProgram:read, auditProgram:audit:read, auditProgram:meeting:read)

### STAFF
- Read permissions only (auditProgram:read, auditProgram:audit:read, auditProgram:meeting:read)

### ADMIN
- Limited read and export permissions

## Usage Guide

### For SYSTEM_ADMINs

1. **Access the Permission Matrix**
   - Navigate to `/admin/audit-program-permissions`
   - Or go to `/manage-institution` → Permissions tab

2. **Manage Permissions**
   - Check/uncheck boxes to grant/revoke permissions
   - Changes are saved automatically
   - Use search to find specific roles
   - Filter by permission categories

3. **Monitor Changes**
   - View summary statistics
   - Track permission assignments
   - Monitor role-specific permission counts

### For Developers

1. **Adding New Permissions**
   ```javascript
   // Add to constants/auditProgramPermissions.js
   'auditProgram:new:action': {
     id: 'audit-program-new-action',
     module: 'auditProgram',
     action: 'new:action',
     description: 'Description of new permission',
     category: 'Category Name',
     roles: ['SYSTEM_ADMIN', 'MR']
   }
   ```

2. **Creating Middleware**
   ```javascript
   // Add to middleware/auditProgramPermissionMiddleware.js
   const requireAuditProgramNewActionPermission = async (req, res, next) => {
     const hasAccess = await hasPermission(req.user, 'auditProgram:new:action');
     if (!hasAccess) {
       return res.status(403).json({
         error: 'Permission denied',
         message: 'You do not have permission to perform this action'
       });
     }
     next();
   };
   ```

3. **Protecting Routes**
   ```javascript
   // Add to routes/auditProgramRoutes.js
   router.post('/new-action', 
     authenticateToken, 
     requireAuditProgramNewActionPermission,
     auditProgramController.newAction
   );
   ```

## Database Schema

### Permission Model
```sql
model Permission {
  id          String   @id @default(uuid())
  module      String
  action      String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([module, action])
}
```

### RolePermission Model
```sql
model RolePermission {
  id           String     @id @default(uuid())
  roleId       String
  permissionId String
  allowed      Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  
  @@unique([roleId, permissionId])
}
```

## Security Features

### 1. Granular Access Control
- Each operation requires specific permission
- No blanket access to audit program domain
- Role-based permission assignment

### 2. Audit Logging
- All permission changes are logged
- User actions are tracked
- Compliance with audit requirements

### 3. Tenant Isolation
- Permissions are scoped to tenant
- Cross-tenant access prevention
- Secure data boundaries

### 4. Optimistic Updates
- Immediate UI feedback
- Automatic rollback on errors
- Consistent state management

## Testing

### 1. Permission Testing
```bash
# Run the seeding script
node scripts/seed_audit_program_permissions.js

# Test specific permissions
curl -X POST /api/audit-programs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "objectives": "Test"}'
```

### 2. Frontend Testing
- Navigate to permission matrix
- Toggle permissions
- Verify API calls
- Check optimistic updates

## Migration Guide

### From Generic Permission Matrix

1. **Backup Current Permissions**
   ```sql
   -- Export current role permissions
   SELECT * FROM "RolePermission" WHERE "permissionId" IN (
     SELECT id FROM "Permission" WHERE module = 'auditProgram'
   );
   ```

2. **Run Seeding Script**
   ```bash
   node scripts/seed_audit_program_permissions.js
   ```

3. **Update Frontend**
   - Replace generic matrix with domain-specific component
   - Update permission checks in components
   - Test all audit program operations

4. **Verify Permissions**
   - Check that all roles have appropriate permissions
   - Test each operation with different roles
   - Verify audit logging

## Troubleshooting

### Common Issues

1. **Permission Not Found**
   - Check if permission exists in database
   - Verify permission string format
   - Run seeding script if needed

2. **Role Not Found**
   - Ensure role exists in database
   - Check role name spelling
   - Verify tenant association

3. **UI Not Updating**
   - Check optimistic update logic
   - Verify API responses
   - Clear browser cache

### Debug Commands

```bash
# Check permissions in database
psql -d your_database -c "SELECT * FROM \"Permission\" WHERE module = 'auditProgram';"

# Check role permissions
psql -d your_database -c "SELECT r.name, p.module, p.action FROM \"RolePermission\" rp JOIN \"Role\" r ON rp.\"roleId\" = r.id JOIN \"Permission\" p ON rp.\"permissionId\" = p.id WHERE p.module = 'auditProgram';"

# Reset permissions
node scripts/seed_audit_program_permissions.js
```

## Future Enhancements

### 1. Dynamic Permission Categories
- User-defined permission categories
- Custom permission descriptions
- Flexible permission organization

### 2. Permission Inheritance
- Role hierarchy support
- Inherited permissions
- Override capabilities

### 3. Advanced Filtering
- Permission-based filtering
- Role-based filtering
- Category-based filtering

### 4. Bulk Operations
- Bulk permission assignment
- Template-based permissions
- Import/export functionality

## Conclusion

The Audit Program Permission System provides a robust, scalable foundation for permission management. Its domain-specific approach ensures clarity, maintainability, and security while providing the flexibility needed for complex audit workflows.

This system serves as a template for implementing similar permission systems for other domains (documents, users, departments, etc.) following the same modular approach. 

## Overview

The Audit Program Permission System is a comprehensive, domain-specific permission management solution designed to provide granular access control for audit program operations. This system replaces the generic permission matrix with a focused, module-by-module approach.

## Architecture

### 1. Permission Structure

The system uses a hierarchical permission structure:

```
auditProgram:action
├── Core Operations
│   ├── auditProgram:create
│   ├── auditProgram:read
│   ├── auditProgram:update
│   └── auditProgram:delete
├── Workflow
│   ├── auditProgram:commit
│   ├── auditProgram:approve
│   └── auditProgram:reject
├── Advanced Operations
│   ├── auditProgram:export
│   └── auditProgram:manage
├── Audit Management
│   ├── auditProgram:audit:create
│   ├── auditProgram:audit:read
│   ├── auditProgram:audit:update
│   └── auditProgram:audit:delete
├── Team Management
│   └── auditProgram:team:manage
└── Meeting Management
    ├── auditProgram:meeting:create
    ├── auditProgram:meeting:read
    ├── auditProgram:meeting:update
    └── auditProgram:meeting:delete
```

### 2. Permission Categories

#### Core Operations
- **auditProgram:create** - Create new audit programs
- **auditProgram:read** - View audit program details and list
- **auditProgram:update** - Edit audit program details
- **auditProgram:delete** - Delete audit programs (only DRAFT status)

#### Workflow
- **auditProgram:commit** - Commit audit program for review
- **auditProgram:approve** - Approve committed audit programs
- **auditProgram:reject** - Reject committed audit programs

#### Advanced Operations
- **auditProgram:export** - Export audit program data
- **auditProgram:manage** - Full management of audit programs

#### Audit Management
- **auditProgram:audit:create** - Create audits within audit programs
- **auditProgram:audit:read** - View audits within audit programs
- **auditProgram:audit:update** - Edit audits within audit programs
- **auditProgram:audit:delete** - Delete audits within audit programs

#### Team Management
- **auditProgram:team:manage** - Manage audit team members

#### Meeting Management
- **auditProgram:meeting:create** - Create planning meetings
- **auditProgram:meeting:read** - View planning meetings
- **auditProgram:meeting:update** - Edit planning meetings
- **auditProgram:meeting:delete** - Delete planning meetings

## Implementation

### Backend Components

#### 1. Permission Constants (`constants/auditProgramPermissions.js`)
```javascript
const AUDIT_PROGRAM_PERMISSIONS = {
  'auditProgram:create': {
    id: 'audit-program-create',
    module: 'auditProgram',
    action: 'create',
    description: 'Create new audit programs',
    category: 'Core Operations',
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  // ... more permissions
};
```

#### 2. Permission Middleware (`middleware/auditProgramPermissionMiddleware.js`)
```javascript
const requireAuditProgramCreatePermission = async (req, res, next) => {
  const hasAccess = await hasPermission(req.user, 'auditProgram:create');
  if (!hasAccess) {
    return res.status(403).json({
      error: 'Permission denied',
      message: 'You do not have permission to create audit programs'
    });
  }
  next();
};
```

#### 3. Route Protection (`routes/auditProgramRoutes.js`)
```javascript
router.post('/', 
  authenticateToken, 
  requireAuditProgramCreatePermission,
  auditProgramController.createAuditProgram
);
```

### Frontend Components

#### 1. Permission Matrix Component (`AuditProgramPermissionMatrix.tsx`)
- Dedicated component for audit program permissions
- Category-based organization
- Real-time permission toggling
- Search and filter capabilities

#### 2. Permission Page (`admin/audit-program-permissions/page.tsx`)
- Standalone page for permission management
- Comprehensive documentation
- User-friendly interface

## Default Role Permissions

### SYSTEM_ADMIN
- All permissions (full access)

### MR (Management Representative)
- All permissions except `auditProgram:meeting:delete`

### PRINCIPAL
- All permissions except `auditProgram:manage` and `auditProgram:meeting:delete`

### HOD (Head of Department)
- Core operations (create, read, update)
- Workflow (commit)
- Advanced operations (export)
- Audit management (create, read, update)
- Team management
- Meeting management (create, read, update)

### AUDITOR
- Read permissions only (auditProgram:read, auditProgram:audit:read, auditProgram:meeting:read)

### STAFF
- Read permissions only (auditProgram:read, auditProgram:audit:read, auditProgram:meeting:read)

### ADMIN
- Limited read and export permissions

## Usage Guide

### For SYSTEM_ADMINs

1. **Access the Permission Matrix**
   - Navigate to `/admin/audit-program-permissions`
   - Or go to `/manage-institution` → Permissions tab

2. **Manage Permissions**
   - Check/uncheck boxes to grant/revoke permissions
   - Changes are saved automatically
   - Use search to find specific roles
   - Filter by permission categories

3. **Monitor Changes**
   - View summary statistics
   - Track permission assignments
   - Monitor role-specific permission counts

### For Developers

1. **Adding New Permissions**
   ```javascript
   // Add to constants/auditProgramPermissions.js
   'auditProgram:new:action': {
     id: 'audit-program-new-action',
     module: 'auditProgram',
     action: 'new:action',
     description: 'Description of new permission',
     category: 'Category Name',
     roles: ['SYSTEM_ADMIN', 'MR']
   }
   ```

2. **Creating Middleware**
   ```javascript
   // Add to middleware/auditProgramPermissionMiddleware.js
   const requireAuditProgramNewActionPermission = async (req, res, next) => {
     const hasAccess = await hasPermission(req.user, 'auditProgram:new:action');
     if (!hasAccess) {
       return res.status(403).json({
         error: 'Permission denied',
         message: 'You do not have permission to perform this action'
       });
     }
     next();
   };
   ```

3. **Protecting Routes**
   ```javascript
   // Add to routes/auditProgramRoutes.js
   router.post('/new-action', 
     authenticateToken, 
     requireAuditProgramNewActionPermission,
     auditProgramController.newAction
   );
   ```

## Database Schema

### Permission Model
```sql
model Permission {
  id          String   @id @default(uuid())
  module      String
  action      String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([module, action])
}
```

### RolePermission Model
```sql
model RolePermission {
  id           String     @id @default(uuid())
  roleId       String
  permissionId String
  allowed      Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  
  @@unique([roleId, permissionId])
}
```

## Security Features

### 1. Granular Access Control
- Each operation requires specific permission
- No blanket access to audit program domain
- Role-based permission assignment

### 2. Audit Logging
- All permission changes are logged
- User actions are tracked
- Compliance with audit requirements

### 3. Tenant Isolation
- Permissions are scoped to tenant
- Cross-tenant access prevention
- Secure data boundaries

### 4. Optimistic Updates
- Immediate UI feedback
- Automatic rollback on errors
- Consistent state management

## Testing

### 1. Permission Testing
```bash
# Run the seeding script
node scripts/seed_audit_program_permissions.js

# Test specific permissions
curl -X POST /api/audit-programs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "objectives": "Test"}'
```

### 2. Frontend Testing
- Navigate to permission matrix
- Toggle permissions
- Verify API calls
- Check optimistic updates

## Migration Guide

### From Generic Permission Matrix

1. **Backup Current Permissions**
   ```sql
   -- Export current role permissions
   SELECT * FROM "RolePermission" WHERE "permissionId" IN (
     SELECT id FROM "Permission" WHERE module = 'auditProgram'
   );
   ```

2. **Run Seeding Script**
   ```bash
   node scripts/seed_audit_program_permissions.js
   ```

3. **Update Frontend**
   - Replace generic matrix with domain-specific component
   - Update permission checks in components
   - Test all audit program operations

4. **Verify Permissions**
   - Check that all roles have appropriate permissions
   - Test each operation with different roles
   - Verify audit logging

## Troubleshooting

### Common Issues

1. **Permission Not Found**
   - Check if permission exists in database
   - Verify permission string format
   - Run seeding script if needed

2. **Role Not Found**
   - Ensure role exists in database
   - Check role name spelling
   - Verify tenant association

3. **UI Not Updating**
   - Check optimistic update logic
   - Verify API responses
   - Clear browser cache

### Debug Commands

```bash
# Check permissions in database
psql -d your_database -c "SELECT * FROM \"Permission\" WHERE module = 'auditProgram';"

# Check role permissions
psql -d your_database -c "SELECT r.name, p.module, p.action FROM \"RolePermission\" rp JOIN \"Role\" r ON rp.\"roleId\" = r.id JOIN \"Permission\" p ON rp.\"permissionId\" = p.id WHERE p.module = 'auditProgram';"

# Reset permissions
node scripts/seed_audit_program_permissions.js
```

## Future Enhancements

### 1. Dynamic Permission Categories
- User-defined permission categories
- Custom permission descriptions
- Flexible permission organization

### 2. Permission Inheritance
- Role hierarchy support
- Inherited permissions
- Override capabilities

### 3. Advanced Filtering
- Permission-based filtering
- Role-based filtering
- Category-based filtering

### 4. Bulk Operations
- Bulk permission assignment
- Template-based permissions
- Import/export functionality

## Conclusion

The Audit Program Permission System provides a robust, scalable foundation for permission management. Its domain-specific approach ensures clarity, maintainability, and security while providing the flexibility needed for complex audit workflows.

This system serves as a template for implementing similar permission systems for other domains (documents, users, departments, etc.) following the same modular approach. 