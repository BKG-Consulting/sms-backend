# Role-Based Routing System

## Overview

The application uses a sophisticated role-based routing system where users can have multiple roles, but routing decisions are primarily based on the **default role** to ensure consistent user experience and proper context switching.

## Key Concepts

### **Multiple Roles vs Default Role**
- **Multiple Roles**: Users can have multiple roles (e.g., HOD, AUDITOR, SYSTEM_ADMIN)
- **Default Role**: The primary role used for routing and context decisions
- **Routing Priority**: Default role → Primary role → First user role → Legacy roles

### **User Data Structure**
```json
{
  "id": "52df54ce-1599-49e0-a20d-afeab6d74dda",
  "email": "info@dualdimension.org",
  "userRoles": [
    {
      "id": "default-tenant-super_admin",
      "name": "SUPER_ADMIN",
      "isDefault": false
    }
  ],
  "departmentRoles": [
    {
      "role": {
        "id": "default-tenant-super_admin",
        "name": "SUPER_ADMIN"
      },
      "isPrimaryRole": true
    }
  ],
  "primaryRole": {
    "id": "default-tenant-super_admin",
    "name": "SUPER_ADMIN"
  },
  "defaultRole": {
    "id": "default-tenant-super_admin",
    "name": "SUPER_ADMIN"
  }
}
```

## Routing Logic

### **1. Primary Check: Default Role**
```typescript
let role = user?.defaultRole?.name;
```
- **Purpose**: Primary routing decision
- **Why**: Ensures consistent user experience
- **Fallback**: If not available, check other role sources

### **2. Fallback Hierarchy**
```typescript
if (!role) {
  // 1. Primary Role
  if (user?.primaryRole?.name) {
    role = user.primaryRole.name;
  }
  // 2. Default User Role
  else if (user?.userRoles?.find(ur => ur.isDefault)?.name) {
    role = user.userRoles.find(ur => ur.isDefault).name;
  }
  // 3. First User Role
  else if (user?.userRoles?.[0]?.name) {
    role = user.userRoles[0].name;
  }
  // 4. Legacy Roles Array
  else if (user?.roles?.[0]?.name) {
    role = user.roles[0].name;
  }
}
```

### **3. Route Mapping**
```typescript
switch (role.toUpperCase()) {
  case "SUPER_ADMIN": return "/admin";
  case "MR": return "/mr";
  case "SYSTEM_ADMIN": return "/system_admin";
  case "AUDITOR": return "/auditors";
  default: return "/dashboard";
}
```

## Component Protection

### **RequireSuperAdmin Component**
```typescript
const isSuperAdmin = user && (
  // Primary check: default role (for routing context)
  user.defaultRole?.name?.toUpperCase() === "SUPER_ADMIN" ||
  // Fallback checks for other role locations
  user.primaryRole?.name?.toUpperCase() === "SUPER_ADMIN" ||
  user.userRoles?.some(r => r.name?.toUpperCase() === "SUPER_ADMIN") ||
  user.roles?.some(r => r.name?.toUpperCase() === "SUPER_ADMIN") ||
  user.departmentRoles?.some(dr => dr.role?.name?.toUpperCase() === "SUPER_ADMIN")
);
```

**Key Points:**
- ✅ **Default role first**: Primary check for routing context
- ✅ **Multiple fallbacks**: Ensures access even if default role is missing
- ✅ **Comprehensive logging**: Debug information for troubleshooting

## Implementation Details

### **Auth Context Enhancement**
```typescript
const userObj = {
  ...response.data,
  // Ensure roles are properly set from userRoles if roles is empty
  roles: response.data.roles || response.data.userRoles || [],
  userRoles: response.data.userRoles || response.data.roles || [],
  primaryRole: response.data.primaryRole || null,
  defaultRole: response.data.defaultRole || null,
};
```

### **Debug Components**
- **DebugUserInfo**: Shows user role structure and routing decisions
- **Console Logging**: Detailed logs for troubleshooting
- **Role Detection**: Multiple fallback mechanisms

## Benefits

### **For Users**
✅ **Consistent Experience**: Always routed to the same dashboard based on default role  
✅ **Context Switching**: Can switch between roles while maintaining primary context  
✅ **No Confusion**: Clear routing decisions prevent navigation issues  

### **For Developers**
✅ **Predictable Routing**: Default role ensures consistent behavior  
✅ **Flexible Role System**: Multiple roles supported with clear hierarchy  
✅ **Easy Debugging**: Comprehensive logging and debug components  
✅ **Backward Compatibility**: Legacy role structures still supported  

### **For System**
✅ **Scalable**: Supports complex role hierarchies  
✅ **Maintainable**: Clear separation of concerns  
✅ **Extensible**: Easy to add new roles and routes  

## Testing Scenarios

### **1. Super Admin Access**
- **User**: Has SUPER_ADMIN as default role
- **Expected**: Access to `/admin` and `/tables`
- **Test**: Navigate to `/tables` → Should show institutions page

### **2. Multiple Roles**
- **User**: Has HOD and AUDITOR roles, default is HOD
- **Expected**: Routed to `/system_admin` (HOD route)
- **Test**: Check routing decision in console logs

### **3. Missing Default Role**
- **User**: Has roles but no default role
- **Expected**: Falls back to primary role or first user role
- **Test**: Check fallback logic in console logs

### **4. Role Switching**
- **User**: Changes default role
- **Expected**: Routes to new default role's dashboard
- **Test**: Update user's default role and verify routing

## Debug Information

### **Console Logs**
```javascript
// getDashboardRoute Debug
{
  userEmail: "info@dualdimension.org",
  defaultRole: { name: "SUPER_ADMIN" },
  selectedRole: "SUPER_ADMIN",
  routingDecision: "SUPER_ADMIN"
}

// RequireSuperAdmin Debug
{
  defaultRole: { name: "SUPER_ADMIN" },
  isSuperAdmin: true,
  routingDecision: "SUPER_ADMIN"
}
```

### **Debug Component**
- Shows all role structures
- Highlights routing decision
- Displays super admin status
- Real-time role information

## Best Practices

### **1. Always Use Default Role for Routing**
```typescript
// ✅ Good
const route = getDashboardRoute(user); // Uses default role

// ❌ Avoid
const route = user.roles[0]?.name; // May not be the intended route
```

### **2. Check Multiple Role Sources**
```typescript
// ✅ Good - Comprehensive check
const isSuperAdmin = user.defaultRole?.name === "SUPER_ADMIN" || 
                    user.primaryRole?.name === "SUPER_ADMIN" ||
                    user.userRoles?.some(r => r.name === "SUPER_ADMIN");

// ❌ Avoid - Single source check
const isSuperAdmin = user.roles?.some(r => r.name === "SUPER_ADMIN");
```

### **3. Provide Fallbacks**
```typescript
// ✅ Good - Multiple fallbacks
if (!user.defaultRole?.name) {
  if (user.primaryRole?.name) role = user.primaryRole.name;
  else if (user.userRoles?.[0]?.name) role = user.userRoles[0].name;
}

// ❌ Avoid - No fallbacks
const role = user.defaultRole?.name; // May be undefined
```

## Conclusion

The role-based routing system ensures that users are consistently routed to the appropriate dashboard based on their default role, while still supporting multiple roles and providing comprehensive fallback mechanisms. This creates a predictable and maintainable user experience while allowing for complex role hierarchies. 