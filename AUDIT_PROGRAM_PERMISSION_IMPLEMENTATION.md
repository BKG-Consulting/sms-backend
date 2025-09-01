# Audit Program Permission System Implementation

## 🎯 **Overview**

This document outlines the comprehensive permission-based access control system implemented for the Audit Program domain. The system ensures that users can only perform actions they are authorized to do based on their roles, permissions, and ownership of audit programs.

## 🏗️ **Architecture**

### **Backend Components**

#### 1. **Permission Middleware** (`src/middleware/auditProgramPermissionMiddleware.js`)
- **Purpose**: Specialized middleware for audit program permission checks
- **Features**:
  - Role-based permission validation
  - Ownership verification for sensitive operations
  - Status-based operation validation
  - Admin bypass for SYSTEM_ADMIN and SUPER_ADMIN roles

#### 2. **Enhanced Routes** (`src/routes/auditProgramRoutes.js`)
- **Purpose**: API routes with integrated permission checks
- **Protected Operations**:
  - `POST /` - Create audit program (requires `auditProgram:create`)
  - `GET /` - List audit programs (requires `auditProgram:read`)
  - `GET /:programId` - Get program details (requires `auditProgram:read`)
  - `PUT /:programId` - Update program (requires `auditProgram:update` + ownership)
  - `DELETE /:programId` - Delete program (requires `auditProgram:delete` + ownership)
  - `PATCH /:programId/commit` - Commit program (requires `auditProgram:submit` + ownership)
  - `PATCH /:programId/approve` - Approve program (requires `auditProgram:approve`)
  - `PATCH /:programId/reject` - Reject program (requires `auditProgram:approve`)

#### 3. **Enhanced Service Layer** (`src/services/auditProgramService.js`)
- **Purpose**: Business logic with permission-aware operations
- **Features**:
  - Status validation for operations
  - Ownership verification
  - Audit logging for all operations
  - Proper error handling with meaningful messages

### **Frontend Components**

#### 1. **Permission Utilities** (`src/utils/auditProgramPermissions.ts`)
- **Purpose**: Client-side permission checking and UI state management
- **Features**:
  - `useAuditProgramPermissions()` hook for permission checking
  - `canPerformAction()` utility for specific action validation
  - `getPermissionBasedUIState()` for UI state management
  - Role-based permission logic

#### 2. **Enhanced API Service** (`src/api/auditProgramService.ts`)
- **Purpose**: TypeScript API client with permission-aware methods
- **Features**:
  - Complete CRUD operations
  - Proper error handling
  - Type safety with TypeScript interfaces

## 🔐 **Permission Matrix**

### **Role-Based Permissions**

| Role | Create | Read | Update | Delete | Commit | Approve/Reject | View Stats | View History |
|------|--------|------|--------|--------|--------|----------------|------------|--------------|
| SYSTEM_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MR | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| PRINCIPAL | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| AUDITOR | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| TEAM_LEADER | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| HOD | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| STAFF | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### **Status-Based Restrictions**

| Operation | DRAFT | UNDER_REVIEW | APPROVED | REJECTED |
|-----------|-------|--------------|----------|----------|
| Update | ✅ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ |
| Commit | ✅ | ❌ | ❌ | ❌ |
| Approve/Reject | ❌ | ✅ | ❌ | ❌ |

### **Ownership Rules**

- **Update/Delete/Commit**: Only program creator or users with `auditProgram:manage` permission
- **View**: All authenticated users within the tenant
- **Approve/Reject**: Users with `auditProgram:approve` permission (typically PRINCIPAL role)

## 🔄 **Workflow Integration**

### **1. Program Creation**
```
User with MR/SYSTEM_ADMIN role → Creates DRAFT program → Can edit/delete/commit
```

### **2. Program Commitment**
```
MR commits DRAFT program → Status: UNDER_REVIEW → PRINCIPAL can approve/reject
```

### **3. Program Approval**
```
PRINCIPAL approves → Status: APPROVED → Program locked for editing
```

### **4. Program Rejection**
```
PRINCIPAL rejects → Status: DRAFT → MR can modify and recommit
```

## 🛡️ **Security Features**

### **1. Multi-Layer Validation**
- **Authentication**: JWT token validation
- **Authorization**: Role and permission checks
- **Business Logic**: Status and ownership validation
- **Database**: Tenant isolation

### **2. Audit Logging**
- All operations logged with user context
- Detailed metadata for each action
- Timestamp and user identification
- Operation-specific details

### **3. Error Handling**
- Meaningful error messages
- Proper HTTP status codes
- Security-conscious error responses
- Detailed logging for debugging

## 📋 **Implementation Checklist**

### **Backend Implementation** ✅
- [x] Permission middleware created
- [x] Routes updated with permission checks
- [x] Service layer enhanced with validation
- [x] Controller methods updated
- [x] Delete functionality added
- [x] Error handling improved

### **Frontend Implementation** ✅
- [x] Permission utilities created
- [x] API service enhanced
- [x] TypeScript interfaces defined
- [x] Permission hooks implemented
- [x] UI state management utilities

### **Testing Requirements** ⏳
- [ ] Unit tests for permission middleware
- [ ] Integration tests for API endpoints
- [ ] Frontend permission hook tests
- [ ] End-to-end workflow tests
- [ ] Security penetration tests

## 🚀 **Usage Examples**

### **Backend Usage**

```javascript
// Route with permission check
router.post('/', 
  authenticateToken, 
  requireAuditProgramCreatePermission(),
  auditProgramController.createAuditProgram
);

// Service with business logic validation
const updateAuditProgram = async ({ programId, updates, tenantId, updatedBy }) => {
  // Permission already checked by middleware
  // Business logic validation
  if (existingProgram.status !== 'DRAFT') {
    throw new AppError('Cannot update audit program that is not in DRAFT status', 400);
  }
  // ... rest of implementation
};
```

### **Frontend Usage**

```typescript
// Using permission hook
const permissions = useAuditProgramPermissions();

// Conditional rendering
{permissions.canCreate && (
  <Button onClick={handleCreateProgram}>Create Program</Button>
)}

// Action validation
const handleUpdate = async () => {
  if (!permissions.canModify(program)) {
    toast.error('You cannot modify this program');
    return;
  }
  // ... update logic
};
```

## 🔧 **Configuration**

### **Environment Variables**
```bash
# Permission system configuration
PERMISSION_CHECK_ENABLED=true
AUDIT_LOGGING_ENABLED=true
ADMIN_BYPASS_ENABLED=true
```

### **Role Configuration**
```javascript
// In constants/rolePermissions.js
MR: {
  permissions: {
    auditProgram: ['create', 'read', 'update', 'delete', 'submit', 'review', 'publish'],
  }
}
```

## 📊 **Monitoring and Logging**

### **Permission Check Logs**
```javascript
logger.debug('[AUDIT_PROGRAM_PERMISSION] Checking', { 
  userId, 
  operation, 
  module: 'auditProgram', 
  action: 'create' 
});
```

### **Audit Trail**
```javascript
await tx.auditLog.create({
  data: {
    action: 'CREATE',
    entityType: 'AUDIT_PROGRAM',
    entityId: programId,
    userId: createdBy,
    tenantId,
    details: `Created audit program: ${title}`,
    metadata: { title, objectives, status: 'DRAFT' }
  }
});
```

## 🔄 **Next Steps**

### **Immediate Actions**
1. **Testing**: Implement comprehensive test suite
2. **Documentation**: Create user guides for different roles
3. **Monitoring**: Set up permission failure alerts
4. **Training**: Educate users on new permission system

### **Future Enhancements**
1. **Granular Permissions**: Department-specific permissions
2. **Temporary Permissions**: Time-limited permission grants
3. **Permission Delegation**: Allow users to delegate permissions
4. **Advanced Analytics**: Permission usage analytics
5. **Audit Reports**: Permission audit reports

## 🎯 **Benefits**

### **Security**
- **Reduced Risk**: Proper access control prevents unauthorized actions
- **Audit Trail**: Complete logging of all operations
- **Compliance**: Meets regulatory requirements for audit systems

### **User Experience**
- **Clear Feedback**: Users understand what they can/cannot do
- **Intuitive UI**: Permission-based UI state management
- **Consistent Behavior**: Predictable permission enforcement

### **Maintainability**
- **Modular Design**: Easy to extend and modify
- **Type Safety**: TypeScript ensures correctness
- **Documentation**: Clear implementation guidelines

---

**Implementation Status**: ✅ **Complete**
**Last Updated**: January 2025
**Version**: 1.0.0 