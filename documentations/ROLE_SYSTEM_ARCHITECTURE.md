# 🎯 Multi-Layered Role System Architecture

## Overview

This system implements a sophisticated multi-layered role management system where users can have different roles at different levels (department and institution) and switch between them seamlessly.

## 🏗️ Role Hierarchy

### 1. Department-Level Roles
- **STAFF**: Default role for all department members
- **HOD**: Head of Department (assigned by system admin)

### 2. Institution-Level Roles
- **PRINCIPAL**: Institution leadership
- **AUDITOR**: Audit management
- **HOD AUDITOR**: Head of Audit Department
- **ADMIN**: System administration
- **MR**: Management Representative
- **CEO**: Chief Executive Officer
- **SUPER_ADMIN**: Full system access

## 🔄 Role Context Switching

### How It Works

1. **User Login**: System determines default role based on `isDefault` flag
2. **Context Switching**: Users can switch between their available roles
3. **Routing**: Frontend routes based on the active default role
4. **Permissions**: Backend checks permissions based on active role context

### Default Role Priority

```javascript
// Priority order for determining default role:
1. userRoles with isDefault = true
2. First userRole if no default set
3. userDepartmentRoles with isPrimaryRole = true
4. First userDepartmentRole if no primary set
```

## 🗄️ Database Schema

### UserDepartmentRoles Table
```sql
userDepartmentRoles {
  id: UUID
  userId: UUID (FK to users)
  departmentId: UUID (FK to departments)
  roleId: UUID (FK to roles)
  isPrimaryDepartment: Boolean
  isPrimaryRole: Boolean
  isDefault: Boolean
}
```

### UserRoles Table
```sql
userRoles {
  id: UUID
  userId: UUID (FK to users)
  roleId: UUID (FK to roles)
  isDefault: Boolean
}
```

## 🎨 Frontend Implementation

### Role Context Switcher Component

The `RoleContextSwitcher` component allows users to:
- View their current role context
- See all available role contexts
- Switch between department and institution roles
- Automatically redirect to appropriate dashboard

### Dashboard Routing

```typescript
export const getDashboardRoute = (user: any): string => {
  let role = user?.defaultRole?.name;
  
  switch ((role || "").trim().toUpperCase()) {
    case "MR": return "/mr";
    case "SUPER_ADMIN": return "/admin";
    case "SYSTEM_ADMIN":
    case "HOD":
    case "PRINCIPAL":
    case "HOD AUDITOR": return "/system_admin";
    case "AUDITOR": return "/auditors";
    default: return "/dashboard";
  }
};
```

## 🔧 Backend Implementation

### Role Assignment Service

```javascript
setDefaultRole: async ({ userId, roleId, type }) => {
  // Clear all defaults for this user
  await prisma.userRole.updateMany({ 
    where: { userId }, 
    data: { isDefault: false } 
  });
  await prisma.userDepartmentRole.updateMany({ 
    where: { userId }, 
    data: { isDefault: false } 
  });

  if (type === 'userRole') {
    // Set isDefault for institution roles
    await prisma.userRole.updateMany({ 
      where: { userId, roleId }, 
      data: { isDefault: true } 
    });
  } else {
    // Set isDefault for department roles
    await prisma.userDepartmentRole.updateMany({ 
      where: { userId, roleId }, 
      data: { isDefault: true } 
    });
  }
}
```

### Authentication Flow

1. **Login**: User authenticates with email/password
2. **Role Resolution**: System determines default role
3. **Token Generation**: JWT includes role information
4. **Session Creation**: Session stores role context
5. **Dashboard Redirect**: User redirected based on default role

## 🎯 Use Cases

### Example 1: Department Staff with Institution Role
```
User: John Doe
Department: IT Department
Department Role: STAFF (default)
Institution Role: AUDITOR

John can:
- Login as STAFF → Access department dashboard
- Switch to AUDITOR → Access audit dashboard
- Switch back to STAFF → Return to department view
```

### Example 2: Head of Department
```
User: Jane Smith
Department: Finance Department
Department Role: HOD (default)
Institution Role: PRINCIPAL

Jane can:
- Login as HOD → Access department management
- Switch to PRINCIPAL → Access institution-wide dashboard
- Manage both department and institution contexts
```

### Example 3: System Admin
```
User: Admin User
Department: None (or any department)
Department Role: None
Institution Role: SUPER_ADMIN (default)

Admin can:
- Access full system administration
- Manage all users, roles, and departments
- No context switching needed (single role)
```

## 🔐 Permission System

### Role-Permission Matrix

Each role has predefined permissions:

```javascript
const ROLE_PERMISSIONS = {
  MR: {
    permissions: {
      audit: ['create', 'read', 'update', 'delete', 'assign'],
      auditProgram: ['create', 'read', 'update', 'delete', 'assign'],
      user: ['read', 'assign'],
      // ... more permissions
    }
  },
  PRINCIPAL: {
    permissions: {
      audit: ['read', 'approve', 'review'],
      auditProgram: ['read', 'approve', 'review'],
      // ... approval permissions
    }
  }
  // ... other roles
};
```

### Permission Checking

```javascript
// Middleware checks permissions based on active role
function requirePermission(module, action) {
  return async (req, res, next) => {
    const userId = req.user.userId;
    const defaultRole = req.user.defaultRole;
    
    const allowed = await hasPermission(userId, module, action, defaultRole);
    if (!allowed) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}
```

## 🚀 API Endpoints

### Role Management
- `POST /api/users/set-default-role` - Set user's default role
- `GET /api/roles/available-roles` - Get predefined roles
- `POST /api/roles/:roleId/reset-permissions` - Reset role permissions

### User Management
- `GET /api/users/me` - Get current user with roles
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/change-password` - Change password

## 🎨 UI Components

### RoleContextSwitcher
- Displays current role context
- Shows all available contexts
- Allows seamless switching
- Automatic dashboard redirection

### EnhancedRoleFormModal
- Predefined role selection
- Automatic permission assignment
- Role description display
- Permission preview

## 🔄 Workflow Examples

### New User Onboarding
1. System admin creates user account
2. Assigns department (STAFF role automatically assigned)
3. Optionally assigns institution role (e.g., AUDITOR)
4. Sets default role (STAFF or AUDITOR)
5. User logs in and sees appropriate dashboard

### Role Promotion
1. System admin promotes STAFF to HOD
2. User now has HOD role in department
3. User can switch between STAFF and HOD contexts
4. Different permissions and dashboards for each context

### Institution Role Assignment
1. System admin assigns institution role (e.g., PRINCIPAL)
2. User now has both department and institution roles
3. User can switch between contexts as needed
4. Each context has appropriate permissions and UI

## 🛡️ Security Considerations

1. **Role Validation**: Backend validates role assignments
2. **Permission Checking**: All actions checked against active role
3. **Session Management**: Role context stored in session
4. **Audit Logging**: All role changes logged
5. **Access Control**: Routes protected by role-based middleware

## 📈 Benefits

1. **Flexibility**: Users can have multiple roles
2. **Context Switching**: Seamless role switching
3. **Permission Management**: Granular permission control
4. **User Experience**: Appropriate UI for each role
5. **Scalability**: Easy to add new roles and permissions
6. **Maintainability**: Centralized role management

## 🔮 Future Enhancements

1. **Role Templates**: Predefined role configurations
2. **Permission Inheritance**: Role hierarchy with inheritance
3. **Temporary Roles**: Time-limited role assignments
4. **Role Analytics**: Usage tracking and analytics
5. **Advanced Permissions**: Conditional permissions based on context 