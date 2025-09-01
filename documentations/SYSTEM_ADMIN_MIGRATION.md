# SYSTEM_ADMIN Permissions Migration

## Overview

This migration fixes permissions for existing SYSTEM_ADMIN users who were created before the permission matrix changes. These users currently have either no permissions or generic "all permissions" instead of the proper role-based permissions.

## What This Migration Does

1. **Finds all SYSTEM_ADMIN roles** in the database
2. **Removes existing permissions** (to avoid duplicates)
3. **Assigns proper permissions** based on the permission matrix
4. **Ensures SYSTEM_ADMIN users** can manage their tenants immediately

## How to Run the Migration

### Option 1: Using the Admin Interface (Recommended)

1. Log in as a **Super Admin**
2. Navigate to the admin dashboard
3. Find the "SYSTEM_ADMIN Permissions Migration" section
4. Click "Fix SYSTEM_ADMIN Permissions"
5. Wait for the migration to complete

### Option 2: Using the Command Line Script

```bash
# Navigate to the auth-service directory
cd auth-service

# Run the migration script
node scripts/fix-system-admin-permissions.js all
```

#### Available Commands:

- `migrate` - Fix permissions for existing SYSTEM_ADMIN roles
- `verify` - Verify that permissions are correctly assigned
- `summary` - Show summary of current SYSTEM_ADMIN roles and permissions
- `all` - Run summary, migrate, and verify in sequence

### Option 3: Using the API Endpoint

```bash
curl -X POST https://dualdauth.onrender.com/api/tenants/fix-system-admin-permissions \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

## What Permissions SYSTEM_ADMIN Gets

After migration, SYSTEM_ADMIN users will have:

### User & Role Management
- ✅ Create, read, update, delete users
- ✅ Assign users to roles and departments
- ✅ Create, read, update, delete roles
- ✅ Approve user registrations

### Department & Campus Management
- ✅ Create, read, update, delete departments
- ✅ Create, read, update, delete campuses
- ✅ Assign users to departments

### Full Audit Management
- ✅ Create, read, update, delete audits
- ✅ Approve, assign, submit, review, publish audits
- ✅ Export audit data
- ✅ Manage audit programs, findings, checklists
- ✅ Handle corrective and preventive actions

### Document Management
- ✅ Create, read, update, delete documents
- ✅ Approve, assign, submit, review, publish documents
- ✅ Archive documents

### Notifications & Communications
- ✅ Create, read, update, delete notifications
- ✅ Assign and submit notifications

### Dashboard & Analytics
- ✅ Read dashboard data
- ✅ Export analytics

### Feedback & Reporting
- ✅ Create, read, update, delete feedback
- ✅ Assign, submit, review feedback

### Tenant Settings (Limited)
- ✅ Read and update their own tenant information
- ❌ Cannot access other tenants

## Safety Features

- **Idempotent**: Can be run multiple times safely
- **Super Admin Only**: Only super admins can run the migration
- **Verification**: Includes verification steps to ensure success
- **Logging**: Comprehensive logging for troubleshooting
- **Rollback Safe**: Doesn't delete any data, only adds permissions

## Troubleshooting

### Migration Fails
1. Check that you're logged in as a Super Admin
2. Verify database connectivity
3. Check the logs for specific error messages
4. Ensure the permission matrix is properly configured

### No SYSTEM_ADMIN Roles Found
- This is normal if no tenants have been created yet
- The migration will complete successfully with a message

### Permissions Not Assigned
1. Run the verification command: `node scripts/fix-system-admin-permissions.js verify`
2. Check if permissions exist in the database
3. Ensure the permission matrix is properly exported

## After Migration

Once the migration is complete:

1. **SYSTEM_ADMIN users** can immediately start managing their tenants
2. **User creation** will work properly
3. **Department management** will be available
4. **Audit management** will be fully functional
5. **All tenant operations** will work as expected

## Verification

To verify the migration worked:

1. **Check the logs** for success messages
2. **Try logging in** as a SYSTEM_ADMIN user
3. **Test user creation** functionality
4. **Test department management**
5. **Verify audit access**

## Support

If you encounter issues:

1. Check the application logs
2. Run the verification script
3. Contact the development team with the error details
4. Provide the migration logs for troubleshooting 