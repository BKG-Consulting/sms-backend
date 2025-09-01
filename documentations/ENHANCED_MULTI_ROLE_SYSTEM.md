# Enhanced Multi-Role System Documentation

## Overview

The Enhanced Multi-Role System provides a robust, flexible role and permission management solution that supports complex organizational structures with multiple role assignments per user.

## Key Features

### 1. Multi-Role Support
- Users can have multiple roles simultaneously
- Roles can be tenant-wide, department-specific, or hybrid
- Permission inheritance from all assigned roles
- Default role designation for login behavior

### 2. Role Scopes

#### Tenant-Wide Roles
- **SYSTEM_ADMIN**: Full system administration
- **PRINCIPAL**: Institution head with comprehensive oversight
- **MR**: Management Representative with audit program oversight
- **AUDITOR**: Audit professional with audit-related permissions
- **AUDIT_TEAM_LEADER**: Leads audit teams with enhanced permissions
- **AUDIT_TEAM_MEMBER**: Member of audit teams with execution permissions

#### Department-Specific Roles
- **HOD**: Head of Department with department authority
- **STAFF**: Standard staff member with basic permissions

#### Hybrid Roles
- **HOD_AUDITOR**: Combines HOD department authority with auditor permissions

## HOD_AUDITOR Role Logic

### Special Behavior
The **HOD_AUDITOR** role has unique behavior that combines two functions:

1. **Department HOD Authority**: Automatically becomes the HOD of the assigned department
2. **Auditor Permissions**: Gains all auditor permissions for tenant-wide operations

### Implementation Details

```javascript
// When HOD_AUDITOR is assigned to a user:
if (role.name === 'HOD_AUDITOR') {
  // 1. Check if department already has an HOD
  const existingHod = await userRepository.findHodByDepartment(departmentId);
  if (existingHod) {
    throw new Error('Department already has an HOD');
  }

  // 2. Create as department role (HOD part)
  userDepartmentRoles.push({
    userId,
    departmentId,
    roleId,
    isPrimaryDepartment: true,
    isPrimaryRole: true,
    isDefault: isPrimary
  });

  // 3. Also create as tenant role (AUDITOR part)
  userRoles.push({
    userId,
    roleId,
    isDefault: false // Department role is primary
  });
}
```

### Constraints
- Only one HOD per department (including HOD_AUDITOR)
- HOD_AUDITOR requires department assignment
- Department role is primary, tenant role is secondary

## User Role Assignment Scenarios

### Scenario 1: Basic User Registration
```javascript
// User gets STAFF or HOD role in their department
const userRoles = [
  {
    roleId: 'staff-role-id',
    departmentId: 'department-id',
    isPrimary: true
  }
];
```

### Scenario 2: HOD Auditor Assignment
```javascript
// User becomes HOD of department + gets auditor permissions
const userRoles = [
  {
    roleId: 'hod-auditor-role-id',
    departmentId: 'department-id',
    isPrimary: true
  }
];
// System automatically creates both department and tenant role assignments
```

### Scenario 3: Multi-Role User
```javascript
// User has multiple roles
const userRoles = [
  {
    roleId: 'hod-role-id',
    departmentId: 'department-id',
    isPrimary: true
  },
  {
    roleId: 'mr-role-id',
    isPrimary: false
  }
];
// User inherits permissions from both HOD and MR roles
```

## Permission Inheritance

### Effective Permissions Calculation
```javascript
const getUserEffectivePermissions = async (userId, tenantId) => {
  // Get all user roles (both tenant-wide and department-specific)
  const userRoles = await userRepository.getUserRoles(userId);
  const userDepartmentRoles = await userRepository.getUserDepartmentRoles(userId);
  
  const allRoleIds = [
    ...userRoles.map(ur => ur.roleId),
    ...userDepartmentRoles.map(udr => udr.roleId)
  ];
  
  // Get all permissions for these roles
  const rolePermissions = await rolePermissionService.getRolePermissionsForRoles(allRoleIds);
  
  // Deduplicate permissions (user might have same permission from multiple roles)
  const uniquePermissions = new Map();
  rolePermissions.forEach(rp => {
    const key = `${rp.permission.module}:${rp.permission.action}`;
    if (rp.allowed && !uniquePermissions.has(key)) {
      uniquePermissions.set(key, {
        id: rp.permission.id,
        module: rp.permission.module,
        action: rp.permission.action,
        description: rp.permission.description
      });
    }
  });
  
  return Array.from(uniquePermissions.values());
};
```

## Database Schema

### Role Model
```prisma
model Role {
  id                  String               @id @default(uuid())
  name                String
  description         String?
  tenantId            String?
  roleScope           String               @default("tenant") // tenant, department, hybrid
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  defaultContext      String               @default("dashboard")
  isDefault           Boolean              @default(false)
  isRemovable         Boolean              @default(true)
  loginDestination    String               @default("/dashboard")
  // ... relations
}
```

### User Role Assignments
```prisma
model UserRole {
  userId    String
  roleId    String
  createdAt DateTime @default(now())
  id        String   @id @default(uuid())
  updatedAt DateTime @updatedAt
  isDefault Boolean  @default(false)
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model UserDepartmentRole {
  id                  String      @id @default(uuid())
  userId              String
  departmentId        String?
  roleId              String
  isPrimaryDepartment Boolean     @default(false)
  isPrimaryRole       Boolean     @default(false)
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  isDefault           Boolean     @default(false)
  department          Department? @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  role                Role        @relation(fields: [roleId], references: [id], onDelete: Cascade)
  user                User        @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## API Endpoints

### Role Management
- `POST /api/roles` - Create role with permissions
- `PUT /api/roles/:id` - Update role and permissions
- `GET /api/roles` - Get all roles for tenant
- `GET /api/roles/:id` - Get role with permissions
- `DELETE /api/roles/:id` - Delete role

### User Role Assignment
- `POST /api/users` - Create user with roles
- `PUT /api/users/:id/roles` - Update user roles
- `GET /api/users/:id/roles` - Get user roles and permissions
- `POST /api/users/:id/default-role` - Set default role

### Permission Checking
- `GET /api/users/:id/permissions` - Get user's effective permissions
- `POST /api/permissions/check` - Check if user has specific permission

## Frontend Integration

### Role Form Modal
The enhanced role form modal supports:
- Role scope selection (tenant, department, hybrid)
- Permission assignment with search and filtering
- Predefined role templates
- Custom permission customization

### User Form Modal
The user form modal supports:
- Multiple role assignments
- Department-specific role assignment
- Default role selection
- HOD_AUDITOR special handling

## Security Considerations

### Permission Validation
- All API endpoints validate user permissions
- Permission checks consider all user roles
- Department-specific permissions are scoped correctly

### Role Constraints
- Only one HOD per department
- SYSTEM_ADMIN can manage all roles
- Role deletion checks for active users

## Migration Guide

### Adding roleScope Field
```sql
-- Add roleScope column to Role table
ALTER TABLE "Role" ADD COLUMN "roleScope" TEXT DEFAULT 'tenant';

-- Update existing roles
UPDATE "Role" SET "roleScope" = 'tenant' WHERE name IN ('SYSTEM_ADMIN', 'PRINCIPAL', 'MR', 'AUDITOR');
UPDATE "Role" SET "roleScope" = 'department' WHERE name IN ('HOD', 'STAFF');
UPDATE "Role" SET "roleScope" = 'hybrid' WHERE name = 'HOD_AUDITOR';
```

### Creating HOD_AUDITOR Role
```javascript
// Create HOD_AUDITOR role with hybrid scope
const hodAuditorRole = await roleService.createOrUpdateRole({
  name: 'HOD_AUDITOR',
  description: 'Department Head who is also an Auditor',
  roleScope: 'hybrid',
  permissions: [
    // HOD permissions
    'department:view',
    'user:view',
    'audit:view',
    'document:view',
    'meeting:view',
    'notification:view',
    'report:view',
    'dashboard:view',
    'finding:manage',
    'correctiveAction:manage',
    // Auditor permissions
    'audit:execute',
    'auditPlan:view',
    'auditPlan:create',
    'checklist:manage',
    'finding:create',
    'finding:view'
  ]
});
```

## Testing

### Unit Tests
- Role creation with different scopes
- HOD_AUDITOR assignment logic
- Permission inheritance calculation
- Role constraint validation

### Integration Tests
- User creation with multiple roles
- HOD_AUDITOR department assignment
- Permission checking across roles
- Default role behavior

## Best Practices

### Role Design
1. Use clear, descriptive role names
2. Define role scopes appropriately
3. Document role behaviors and constraints
4. Test role assignments thoroughly

### Permission Management
1. Grant minimum required permissions
2. Use role inheritance for common permissions
3. Regularly audit role assignments
4. Monitor permission usage

### User Management
1. Set appropriate default roles
2. Validate role constraints during assignment
3. Provide clear role descriptions
4. Support role transitions and updates

## Troubleshooting

### Common Issues

#### "Department already has an HOD"
- Check if department has existing HOD or HOD_AUDITOR
- Remove existing HOD before assigning new one
- Verify role assignment logic

#### "Permission denied"
- Check user's effective permissions
- Verify role assignments are active
- Ensure permission inheritance is working

#### "Role not found"
- Verify role exists in tenant
- Check role scope matches assignment context
- Ensure role is not deleted or inactive

### Debug Tools
- User permission audit endpoint
- Role assignment validation
- Permission inheritance visualization
- Role constraint checking

## Future Enhancements

### Planned Features
1. Role templates and inheritance
2. Time-based role assignments
3. Role approval workflows
4. Advanced permission rules
5. Role analytics and reporting

### Scalability Considerations
1. Permission caching
2. Role assignment optimization
3. Database indexing for role queries
4. Permission checking performance 

## Overview

The Enhanced Multi-Role System provides a robust, flexible role and permission management solution that supports complex organizational structures with multiple role assignments per user.

## Key Features

### 1. Multi-Role Support
- Users can have multiple roles simultaneously
- Roles can be tenant-wide, department-specific, or hybrid
- Permission inheritance from all assigned roles
- Default role designation for login behavior

### 2. Role Scopes

#### Tenant-Wide Roles
- **SYSTEM_ADMIN**: Full system administration
- **PRINCIPAL**: Institution head with comprehensive oversight
- **MR**: Management Representative with audit program oversight
- **AUDITOR**: Audit professional with audit-related permissions
- **AUDIT_TEAM_LEADER**: Leads audit teams with enhanced permissions
- **AUDIT_TEAM_MEMBER**: Member of audit teams with execution permissions

#### Department-Specific Roles
- **HOD**: Head of Department with department authority
- **STAFF**: Standard staff member with basic permissions

#### Hybrid Roles
- **HOD_AUDITOR**: Combines HOD department authority with auditor permissions

## HOD_AUDITOR Role Logic

### Special Behavior
The **HOD_AUDITOR** role has unique behavior that combines two functions:

1. **Department HOD Authority**: Automatically becomes the HOD of the assigned department
2. **Auditor Permissions**: Gains all auditor permissions for tenant-wide operations

### Implementation Details

```javascript
// When HOD_AUDITOR is assigned to a user:
if (role.name === 'HOD_AUDITOR') {
  // 1. Check if department already has an HOD
  const existingHod = await userRepository.findHodByDepartment(departmentId);
  if (existingHod) {
    throw new Error('Department already has an HOD');
  }

  // 2. Create as department role (HOD part)
  userDepartmentRoles.push({
    userId,
    departmentId,
    roleId,
    isPrimaryDepartment: true,
    isPrimaryRole: true,
    isDefault: isPrimary
  });

  // 3. Also create as tenant role (AUDITOR part)
  userRoles.push({
    userId,
    roleId,
    isDefault: false // Department role is primary
  });
}
```

### Constraints
- Only one HOD per department (including HOD_AUDITOR)
- HOD_AUDITOR requires department assignment
- Department role is primary, tenant role is secondary

## User Role Assignment Scenarios

### Scenario 1: Basic User Registration
```javascript
// User gets STAFF or HOD role in their department
const userRoles = [
  {
    roleId: 'staff-role-id',
    departmentId: 'department-id',
    isPrimary: true
  }
];
```

### Scenario 2: HOD Auditor Assignment
```javascript
// User becomes HOD of department + gets auditor permissions
const userRoles = [
  {
    roleId: 'hod-auditor-role-id',
    departmentId: 'department-id',
    isPrimary: true
  }
];
// System automatically creates both department and tenant role assignments
```

### Scenario 3: Multi-Role User
```javascript
// User has multiple roles
const userRoles = [
  {
    roleId: 'hod-role-id',
    departmentId: 'department-id',
    isPrimary: true
  },
  {
    roleId: 'mr-role-id',
    isPrimary: false
  }
];
// User inherits permissions from both HOD and MR roles
```

## Permission Inheritance

### Effective Permissions Calculation
```javascript
const getUserEffectivePermissions = async (userId, tenantId) => {
  // Get all user roles (both tenant-wide and department-specific)
  const userRoles = await userRepository.getUserRoles(userId);
  const userDepartmentRoles = await userRepository.getUserDepartmentRoles(userId);
  
  const allRoleIds = [
    ...userRoles.map(ur => ur.roleId),
    ...userDepartmentRoles.map(udr => udr.roleId)
  ];
  
  // Get all permissions for these roles
  const rolePermissions = await rolePermissionService.getRolePermissionsForRoles(allRoleIds);
  
  // Deduplicate permissions (user might have same permission from multiple roles)
  const uniquePermissions = new Map();
  rolePermissions.forEach(rp => {
    const key = `${rp.permission.module}:${rp.permission.action}`;
    if (rp.allowed && !uniquePermissions.has(key)) {
      uniquePermissions.set(key, {
        id: rp.permission.id,
        module: rp.permission.module,
        action: rp.permission.action,
        description: rp.permission.description
      });
    }
  });
  
  return Array.from(uniquePermissions.values());
};
```

## Database Schema

### Role Model
```prisma
model Role {
  id                  String               @id @default(uuid())
  name                String
  description         String?
  tenantId            String?
  roleScope           String               @default("tenant") // tenant, department, hybrid
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  defaultContext      String               @default("dashboard")
  isDefault           Boolean              @default(false)
  isRemovable         Boolean              @default(true)
  loginDestination    String               @default("/dashboard")
  // ... relations
}
```

### User Role Assignments
```prisma
model UserRole {
  userId    String
  roleId    String
  createdAt DateTime @default(now())
  id        String   @id @default(uuid())
  updatedAt DateTime @updatedAt
  isDefault Boolean  @default(false)
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model UserDepartmentRole {
  id                  String      @id @default(uuid())
  userId              String
  departmentId        String?
  roleId              String
  isPrimaryDepartment Boolean     @default(false)
  isPrimaryRole       Boolean     @default(false)
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  isDefault           Boolean     @default(false)
  department          Department? @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  role                Role        @relation(fields: [roleId], references: [id], onDelete: Cascade)
  user                User        @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## API Endpoints

### Role Management
- `POST /api/roles` - Create role with permissions
- `PUT /api/roles/:id` - Update role and permissions
- `GET /api/roles` - Get all roles for tenant
- `GET /api/roles/:id` - Get role with permissions
- `DELETE /api/roles/:id` - Delete role

### User Role Assignment
- `POST /api/users` - Create user with roles
- `PUT /api/users/:id/roles` - Update user roles
- `GET /api/users/:id/roles` - Get user roles and permissions
- `POST /api/users/:id/default-role` - Set default role

### Permission Checking
- `GET /api/users/:id/permissions` - Get user's effective permissions
- `POST /api/permissions/check` - Check if user has specific permission

## Frontend Integration

### Role Form Modal
The enhanced role form modal supports:
- Role scope selection (tenant, department, hybrid)
- Permission assignment with search and filtering
- Predefined role templates
- Custom permission customization

### User Form Modal
The user form modal supports:
- Multiple role assignments
- Department-specific role assignment
- Default role selection
- HOD_AUDITOR special handling

## Security Considerations

### Permission Validation
- All API endpoints validate user permissions
- Permission checks consider all user roles
- Department-specific permissions are scoped correctly

### Role Constraints
- Only one HOD per department
- SYSTEM_ADMIN can manage all roles
- Role deletion checks for active users

## Migration Guide

### Adding roleScope Field
```sql
-- Add roleScope column to Role table
ALTER TABLE "Role" ADD COLUMN "roleScope" TEXT DEFAULT 'tenant';

-- Update existing roles
UPDATE "Role" SET "roleScope" = 'tenant' WHERE name IN ('SYSTEM_ADMIN', 'PRINCIPAL', 'MR', 'AUDITOR');
UPDATE "Role" SET "roleScope" = 'department' WHERE name IN ('HOD', 'STAFF');
UPDATE "Role" SET "roleScope" = 'hybrid' WHERE name = 'HOD_AUDITOR';
```

### Creating HOD_AUDITOR Role
```javascript
// Create HOD_AUDITOR role with hybrid scope
const hodAuditorRole = await roleService.createOrUpdateRole({
  name: 'HOD_AUDITOR',
  description: 'Department Head who is also an Auditor',
  roleScope: 'hybrid',
  permissions: [
    // HOD permissions
    'department:view',
    'user:view',
    'audit:view',
    'document:view',
    'meeting:view',
    'notification:view',
    'report:view',
    'dashboard:view',
    'finding:manage',
    'correctiveAction:manage',
    // Auditor permissions
    'audit:execute',
    'auditPlan:view',
    'auditPlan:create',
    'checklist:manage',
    'finding:create',
    'finding:view'
  ]
});
```

## Testing

### Unit Tests
- Role creation with different scopes
- HOD_AUDITOR assignment logic
- Permission inheritance calculation
- Role constraint validation

### Integration Tests
- User creation with multiple roles
- HOD_AUDITOR department assignment
- Permission checking across roles
- Default role behavior

## Best Practices

### Role Design
1. Use clear, descriptive role names
2. Define role scopes appropriately
3. Document role behaviors and constraints
4. Test role assignments thoroughly

### Permission Management
1. Grant minimum required permissions
2. Use role inheritance for common permissions
3. Regularly audit role assignments
4. Monitor permission usage

### User Management
1. Set appropriate default roles
2. Validate role constraints during assignment
3. Provide clear role descriptions
4. Support role transitions and updates

## Troubleshooting

### Common Issues

#### "Department already has an HOD"
- Check if department has existing HOD or HOD_AUDITOR
- Remove existing HOD before assigning new one
- Verify role assignment logic

#### "Permission denied"
- Check user's effective permissions
- Verify role assignments are active
- Ensure permission inheritance is working

#### "Role not found"
- Verify role exists in tenant
- Check role scope matches assignment context
- Ensure role is not deleted or inactive

### Debug Tools
- User permission audit endpoint
- Role assignment validation
- Permission inheritance visualization
- Role constraint checking

## Future Enhancements

### Planned Features
1. Role templates and inheritance
2. Time-based role assignments
3. Role approval workflows
4. Advanced permission rules
5. Role analytics and reporting

### Scalability Considerations
1. Permission caching
2. Role assignment optimization
3. Database indexing for role queries
4. Permission checking performance 

## Overview

The Enhanced Multi-Role System provides a robust, flexible role and permission management solution that supports complex organizational structures with multiple role assignments per user.

## Key Features

### 1. Multi-Role Support
- Users can have multiple roles simultaneously
- Roles can be tenant-wide, department-specific, or hybrid
- Permission inheritance from all assigned roles
- Default role designation for login behavior

### 2. Role Scopes

#### Tenant-Wide Roles
- **SYSTEM_ADMIN**: Full system administration
- **PRINCIPAL**: Institution head with comprehensive oversight
- **MR**: Management Representative with audit program oversight
- **AUDITOR**: Audit professional with audit-related permissions
- **AUDIT_TEAM_LEADER**: Leads audit teams with enhanced permissions
- **AUDIT_TEAM_MEMBER**: Member of audit teams with execution permissions

#### Department-Specific Roles
- **HOD**: Head of Department with department authority
- **STAFF**: Standard staff member with basic permissions

#### Hybrid Roles
- **HOD_AUDITOR**: Combines HOD department authority with auditor permissions

## HOD_AUDITOR Role Logic

### Special Behavior
The **HOD_AUDITOR** role has unique behavior that combines two functions:

1. **Department HOD Authority**: Automatically becomes the HOD of the assigned department
2. **Auditor Permissions**: Gains all auditor permissions for tenant-wide operations

### Implementation Details

```javascript
// When HOD_AUDITOR is assigned to a user:
if (role.name === 'HOD_AUDITOR') {
  // 1. Check if department already has an HOD
  const existingHod = await userRepository.findHodByDepartment(departmentId);
  if (existingHod) {
    throw new Error('Department already has an HOD');
  }

  // 2. Create as department role (HOD part)
  userDepartmentRoles.push({
    userId,
    departmentId,
    roleId,
    isPrimaryDepartment: true,
    isPrimaryRole: true,
    isDefault: isPrimary
  });

  // 3. Also create as tenant role (AUDITOR part)
  userRoles.push({
    userId,
    roleId,
    isDefault: false // Department role is primary
  });
}
```

### Constraints
- Only one HOD per department (including HOD_AUDITOR)
- HOD_AUDITOR requires department assignment
- Department role is primary, tenant role is secondary

## User Role Assignment Scenarios

### Scenario 1: Basic User Registration
```javascript
// User gets STAFF or HOD role in their department
const userRoles = [
  {
    roleId: 'staff-role-id',
    departmentId: 'department-id',
    isPrimary: true
  }
];
```

### Scenario 2: HOD Auditor Assignment
```javascript
// User becomes HOD of department + gets auditor permissions
const userRoles = [
  {
    roleId: 'hod-auditor-role-id',
    departmentId: 'department-id',
    isPrimary: true
  }
];
// System automatically creates both department and tenant role assignments
```

### Scenario 3: Multi-Role User
```javascript
// User has multiple roles
const userRoles = [
  {
    roleId: 'hod-role-id',
    departmentId: 'department-id',
    isPrimary: true
  },
  {
    roleId: 'mr-role-id',
    isPrimary: false
  }
];
// User inherits permissions from both HOD and MR roles
```

## Permission Inheritance

### Effective Permissions Calculation
```javascript
const getUserEffectivePermissions = async (userId, tenantId) => {
  // Get all user roles (both tenant-wide and department-specific)
  const userRoles = await userRepository.getUserRoles(userId);
  const userDepartmentRoles = await userRepository.getUserDepartmentRoles(userId);
  
  const allRoleIds = [
    ...userRoles.map(ur => ur.roleId),
    ...userDepartmentRoles.map(udr => udr.roleId)
  ];
  
  // Get all permissions for these roles
  const rolePermissions = await rolePermissionService.getRolePermissionsForRoles(allRoleIds);
  
  // Deduplicate permissions (user might have same permission from multiple roles)
  const uniquePermissions = new Map();
  rolePermissions.forEach(rp => {
    const key = `${rp.permission.module}:${rp.permission.action}`;
    if (rp.allowed && !uniquePermissions.has(key)) {
      uniquePermissions.set(key, {
        id: rp.permission.id,
        module: rp.permission.module,
        action: rp.permission.action,
        description: rp.permission.description
      });
    }
  });
  
  return Array.from(uniquePermissions.values());
};
```

## Database Schema

### Role Model
```prisma
model Role {
  id                  String               @id @default(uuid())
  name                String
  description         String?
  tenantId            String?
  roleScope           String               @default("tenant") // tenant, department, hybrid
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  defaultContext      String               @default("dashboard")
  isDefault           Boolean              @default(false)
  isRemovable         Boolean              @default(true)
  loginDestination    String               @default("/dashboard")
  // ... relations
}
```

### User Role Assignments
```prisma
model UserRole {
  userId    String
  roleId    String
  createdAt DateTime @default(now())
  id        String   @id @default(uuid())
  updatedAt DateTime @updatedAt
  isDefault Boolean  @default(false)
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model UserDepartmentRole {
  id                  String      @id @default(uuid())
  userId              String
  departmentId        String?
  roleId              String
  isPrimaryDepartment Boolean     @default(false)
  isPrimaryRole       Boolean     @default(false)
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  isDefault           Boolean     @default(false)
  department          Department? @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  role                Role        @relation(fields: [roleId], references: [id], onDelete: Cascade)
  user                User        @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## API Endpoints

### Role Management
- `POST /api/roles` - Create role with permissions
- `PUT /api/roles/:id` - Update role and permissions
- `GET /api/roles` - Get all roles for tenant
- `GET /api/roles/:id` - Get role with permissions
- `DELETE /api/roles/:id` - Delete role

### User Role Assignment
- `POST /api/users` - Create user with roles
- `PUT /api/users/:id/roles` - Update user roles
- `GET /api/users/:id/roles` - Get user roles and permissions
- `POST /api/users/:id/default-role` - Set default role

### Permission Checking
- `GET /api/users/:id/permissions` - Get user's effective permissions
- `POST /api/permissions/check` - Check if user has specific permission

## Frontend Integration

### Role Form Modal
The enhanced role form modal supports:
- Role scope selection (tenant, department, hybrid)
- Permission assignment with search and filtering
- Predefined role templates
- Custom permission customization

### User Form Modal
The user form modal supports:
- Multiple role assignments
- Department-specific role assignment
- Default role selection
- HOD_AUDITOR special handling

## Security Considerations

### Permission Validation
- All API endpoints validate user permissions
- Permission checks consider all user roles
- Department-specific permissions are scoped correctly

### Role Constraints
- Only one HOD per department
- SYSTEM_ADMIN can manage all roles
- Role deletion checks for active users

## Migration Guide

### Adding roleScope Field
```sql
-- Add roleScope column to Role table
ALTER TABLE "Role" ADD COLUMN "roleScope" TEXT DEFAULT 'tenant';

-- Update existing roles
UPDATE "Role" SET "roleScope" = 'tenant' WHERE name IN ('SYSTEM_ADMIN', 'PRINCIPAL', 'MR', 'AUDITOR');
UPDATE "Role" SET "roleScope" = 'department' WHERE name IN ('HOD', 'STAFF');
UPDATE "Role" SET "roleScope" = 'hybrid' WHERE name = 'HOD_AUDITOR';
```

### Creating HOD_AUDITOR Role
```javascript
// Create HOD_AUDITOR role with hybrid scope
const hodAuditorRole = await roleService.createOrUpdateRole({
  name: 'HOD_AUDITOR',
  description: 'Department Head who is also an Auditor',
  roleScope: 'hybrid',
  permissions: [
    // HOD permissions
    'department:view',
    'user:view',
    'audit:view',
    'document:view',
    'meeting:view',
    'notification:view',
    'report:view',
    'dashboard:view',
    'finding:manage',
    'correctiveAction:manage',
    // Auditor permissions
    'audit:execute',
    'auditPlan:view',
    'auditPlan:create',
    'checklist:manage',
    'finding:create',
    'finding:view'
  ]
});
```

## Testing

### Unit Tests
- Role creation with different scopes
- HOD_AUDITOR assignment logic
- Permission inheritance calculation
- Role constraint validation

### Integration Tests
- User creation with multiple roles
- HOD_AUDITOR department assignment
- Permission checking across roles
- Default role behavior

## Best Practices

### Role Design
1. Use clear, descriptive role names
2. Define role scopes appropriately
3. Document role behaviors and constraints
4. Test role assignments thoroughly

### Permission Management
1. Grant minimum required permissions
2. Use role inheritance for common permissions
3. Regularly audit role assignments
4. Monitor permission usage

### User Management
1. Set appropriate default roles
2. Validate role constraints during assignment
3. Provide clear role descriptions
4. Support role transitions and updates

## Troubleshooting

### Common Issues

#### "Department already has an HOD"
- Check if department has existing HOD or HOD_AUDITOR
- Remove existing HOD before assigning new one
- Verify role assignment logic

#### "Permission denied"
- Check user's effective permissions
- Verify role assignments are active
- Ensure permission inheritance is working

#### "Role not found"
- Verify role exists in tenant
- Check role scope matches assignment context
- Ensure role is not deleted or inactive

### Debug Tools
- User permission audit endpoint
- Role assignment validation
- Permission inheritance visualization
- Role constraint checking

## Future Enhancements

### Planned Features
1. Role templates and inheritance
2. Time-based role assignments
3. Role approval workflows
4. Advanced permission rules
5. Role analytics and reporting

### Scalability Considerations
1. Permission caching
2. Role assignment optimization
3. Database indexing for role queries
4. Permission checking performance 

## Overview

The Enhanced Multi-Role System provides a robust, flexible role and permission management solution that supports complex organizational structures with multiple role assignments per user.

## Key Features

### 1. Multi-Role Support
- Users can have multiple roles simultaneously
- Roles can be tenant-wide, department-specific, or hybrid
- Permission inheritance from all assigned roles
- Default role designation for login behavior

### 2. Role Scopes

#### Tenant-Wide Roles
- **SYSTEM_ADMIN**: Full system administration
- **PRINCIPAL**: Institution head with comprehensive oversight
- **MR**: Management Representative with audit program oversight
- **AUDITOR**: Audit professional with audit-related permissions
- **AUDIT_TEAM_LEADER**: Leads audit teams with enhanced permissions
- **AUDIT_TEAM_MEMBER**: Member of audit teams with execution permissions

#### Department-Specific Roles
- **HOD**: Head of Department with department authority
- **STAFF**: Standard staff member with basic permissions

#### Hybrid Roles
- **HOD_AUDITOR**: Combines HOD department authority with auditor permissions

## HOD_AUDITOR Role Logic

### Special Behavior
The **HOD_AUDITOR** role has unique behavior that combines two functions:

1. **Department HOD Authority**: Automatically becomes the HOD of the assigned department
2. **Auditor Permissions**: Gains all auditor permissions for tenant-wide operations

### Implementation Details

```javascript
// When HOD_AUDITOR is assigned to a user:
if (role.name === 'HOD_AUDITOR') {
  // 1. Check if department already has an HOD
  const existingHod = await userRepository.findHodByDepartment(departmentId);
  if (existingHod) {
    throw new Error('Department already has an HOD');
  }

  // 2. Create as department role (HOD part)
  userDepartmentRoles.push({
    userId,
    departmentId,
    roleId,
    isPrimaryDepartment: true,
    isPrimaryRole: true,
    isDefault: isPrimary
  });

  // 3. Also create as tenant role (AUDITOR part)
  userRoles.push({
    userId,
    roleId,
    isDefault: false // Department role is primary
  });
}
```

### Constraints
- Only one HOD per department (including HOD_AUDITOR)
- HOD_AUDITOR requires department assignment
- Department role is primary, tenant role is secondary

## User Role Assignment Scenarios

### Scenario 1: Basic User Registration
```javascript
// User gets STAFF or HOD role in their department
const userRoles = [
  {
    roleId: 'staff-role-id',
    departmentId: 'department-id',
    isPrimary: true
  }
];
```

### Scenario 2: HOD Auditor Assignment
```javascript
// User becomes HOD of department + gets auditor permissions
const userRoles = [
  {
    roleId: 'hod-auditor-role-id',
    departmentId: 'department-id',
    isPrimary: true
  }
];
// System automatically creates both department and tenant role assignments
```

### Scenario 3: Multi-Role User
```javascript
// User has multiple roles
const userRoles = [
  {
    roleId: 'hod-role-id',
    departmentId: 'department-id',
    isPrimary: true
  },
  {
    roleId: 'mr-role-id',
    isPrimary: false
  }
];
// User inherits permissions from both HOD and MR roles
```

## Permission Inheritance

### Effective Permissions Calculation
```javascript
const getUserEffectivePermissions = async (userId, tenantId) => {
  // Get all user roles (both tenant-wide and department-specific)
  const userRoles = await userRepository.getUserRoles(userId);
  const userDepartmentRoles = await userRepository.getUserDepartmentRoles(userId);
  
  const allRoleIds = [
    ...userRoles.map(ur => ur.roleId),
    ...userDepartmentRoles.map(udr => udr.roleId)
  ];
  
  // Get all permissions for these roles
  const rolePermissions = await rolePermissionService.getRolePermissionsForRoles(allRoleIds);
  
  // Deduplicate permissions (user might have same permission from multiple roles)
  const uniquePermissions = new Map();
  rolePermissions.forEach(rp => {
    const key = `${rp.permission.module}:${rp.permission.action}`;
    if (rp.allowed && !uniquePermissions.has(key)) {
      uniquePermissions.set(key, {
        id: rp.permission.id,
        module: rp.permission.module,
        action: rp.permission.action,
        description: rp.permission.description
      });
    }
  });
  
  return Array.from(uniquePermissions.values());
};
```

## Database Schema

### Role Model
```prisma
model Role {
  id                  String               @id @default(uuid())
  name                String
  description         String?
  tenantId            String?
  roleScope           String               @default("tenant") // tenant, department, hybrid
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  defaultContext      String               @default("dashboard")
  isDefault           Boolean              @default(false)
  isRemovable         Boolean              @default(true)
  loginDestination    String               @default("/dashboard")
  // ... relations
}
```

### User Role Assignments
```prisma
model UserRole {
  userId    String
  roleId    String
  createdAt DateTime @default(now())
  id        String   @id @default(uuid())
  updatedAt DateTime @updatedAt
  isDefault Boolean  @default(false)
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model UserDepartmentRole {
  id                  String      @id @default(uuid())
  userId              String
  departmentId        String?
  roleId              String
  isPrimaryDepartment Boolean     @default(false)
  isPrimaryRole       Boolean     @default(false)
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  isDefault           Boolean     @default(false)
  department          Department? @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  role                Role        @relation(fields: [roleId], references: [id], onDelete: Cascade)
  user                User        @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## API Endpoints

### Role Management
- `POST /api/roles` - Create role with permissions
- `PUT /api/roles/:id` - Update role and permissions
- `GET /api/roles` - Get all roles for tenant
- `GET /api/roles/:id` - Get role with permissions
- `DELETE /api/roles/:id` - Delete role

### User Role Assignment
- `POST /api/users` - Create user with roles
- `PUT /api/users/:id/roles` - Update user roles
- `GET /api/users/:id/roles` - Get user roles and permissions
- `POST /api/users/:id/default-role` - Set default role

### Permission Checking
- `GET /api/users/:id/permissions` - Get user's effective permissions
- `POST /api/permissions/check` - Check if user has specific permission

## Frontend Integration

### Role Form Modal
The enhanced role form modal supports:
- Role scope selection (tenant, department, hybrid)
- Permission assignment with search and filtering
- Predefined role templates
- Custom permission customization

### User Form Modal
The user form modal supports:
- Multiple role assignments
- Department-specific role assignment
- Default role selection
- HOD_AUDITOR special handling

## Security Considerations

### Permission Validation
- All API endpoints validate user permissions
- Permission checks consider all user roles
- Department-specific permissions are scoped correctly

### Role Constraints
- Only one HOD per department
- SYSTEM_ADMIN can manage all roles
- Role deletion checks for active users

## Migration Guide

### Adding roleScope Field
```sql
-- Add roleScope column to Role table
ALTER TABLE "Role" ADD COLUMN "roleScope" TEXT DEFAULT 'tenant';

-- Update existing roles
UPDATE "Role" SET "roleScope" = 'tenant' WHERE name IN ('SYSTEM_ADMIN', 'PRINCIPAL', 'MR', 'AUDITOR');
UPDATE "Role" SET "roleScope" = 'department' WHERE name IN ('HOD', 'STAFF');
UPDATE "Role" SET "roleScope" = 'hybrid' WHERE name = 'HOD_AUDITOR';
```

### Creating HOD_AUDITOR Role
```javascript
// Create HOD_AUDITOR role with hybrid scope
const hodAuditorRole = await roleService.createOrUpdateRole({
  name: 'HOD_AUDITOR',
  description: 'Department Head who is also an Auditor',
  roleScope: 'hybrid',
  permissions: [
    // HOD permissions
    'department:view',
    'user:view',
    'audit:view',
    'document:view',
    'meeting:view',
    'notification:view',
    'report:view',
    'dashboard:view',
    'finding:manage',
    'correctiveAction:manage',
    // Auditor permissions
    'audit:execute',
    'auditPlan:view',
    'auditPlan:create',
    'checklist:manage',
    'finding:create',
    'finding:view'
  ]
});
```

## Testing

### Unit Tests
- Role creation with different scopes
- HOD_AUDITOR assignment logic
- Permission inheritance calculation
- Role constraint validation

### Integration Tests
- User creation with multiple roles
- HOD_AUDITOR department assignment
- Permission checking across roles
- Default role behavior

## Best Practices

### Role Design
1. Use clear, descriptive role names
2. Define role scopes appropriately
3. Document role behaviors and constraints
4. Test role assignments thoroughly

### Permission Management
1. Grant minimum required permissions
2. Use role inheritance for common permissions
3. Regularly audit role assignments
4. Monitor permission usage

### User Management
1. Set appropriate default roles
2. Validate role constraints during assignment
3. Provide clear role descriptions
4. Support role transitions and updates

## Troubleshooting

### Common Issues

#### "Department already has an HOD"
- Check if department has existing HOD or HOD_AUDITOR
- Remove existing HOD before assigning new one
- Verify role assignment logic

#### "Permission denied"
- Check user's effective permissions
- Verify role assignments are active
- Ensure permission inheritance is working

#### "Role not found"
- Verify role exists in tenant
- Check role scope matches assignment context
- Ensure role is not deleted or inactive

### Debug Tools
- User permission audit endpoint
- Role assignment validation
- Permission inheritance visualization
- Role constraint checking

## Future Enhancements

### Planned Features
1. Role templates and inheritance
2. Time-based role assignments
3. Role approval workflows
4. Advanced permission rules
5. Role analytics and reporting

### Scalability Considerations
1. Permission caching
2. Role assignment optimization
3. Database indexing for role queries
4. Permission checking performance 