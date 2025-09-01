# Database Migration Guide

## Current Issue

The enhanced institution creation form is collecting comprehensive branding information, but the database doesn't have the new fields yet. This causes Prisma errors when trying to create tenants.

## Solution: Run Database Migration

### **Step 1: Navigate to Auth Service Directory**
```bash
cd auth-service
```

### **Step 2: Generate Migration**
```bash
npx prisma migrate dev --name add_enhanced_branding_fields
```

This will:
- Create a new migration file
- Add all the new branding fields to the Tenant table
- Apply the migration to your database

### **Step 3: Verify Migration**
```bash
npx prisma migrate status
```

You should see the new migration as "Applied".

### **Step 4: Update Code (After Migration)**

#### **1. Uncomment Enhanced Fields in Tenant Creation**
Edit `auth-service/src/services/tenantOnboardingService.js`:
```javascript
// Uncomment these lines after migration
primaryColor: payload.tenant.primaryColor,
secondaryColor: payload.tenant.secondaryColor,
tagline: payload.tenant.tagline,
description: payload.tenant.description,
website: payload.tenant.website,
postalCode: payload.tenant.postalCode,
socialMedia: payload.tenant.socialMedia,
metaTitle: payload.tenant.metaTitle,
metaDescription: payload.tenant.metaDescription,
metaKeywords: payload.tenant.metaKeywords,
contactPerson: payload.tenant.contactPerson,
contactEmail: payload.tenant.contactEmail,
contactPhone: payload.tenant.contactPhone,
legalName: payload.tenant.legalName,
registrationNumber: payload.tenant.registrationNumber,
taxId: payload.tenant.taxId,
subscriptionPlan: payload.tenant.subscriptionPlan,
maxUsers: payload.tenant.maxUsers,
maxStorageGB: payload.tenant.maxStorageGB,
```

#### **2. Uncomment Enhanced Fields in Tenant Service**
Edit `auth-service/src/services/tenantService.js`:
```javascript
// Uncomment these lines in getTenantByDomain method
primaryColor: true,
secondaryColor: true,
tagline: true,
description: true,
website: true,
postalCode: true,
socialMedia: true,
metaTitle: true,
metaDescription: true,
metaKeywords: true,
contactPerson: true,
contactEmail: true,
contactPhone: true,
legalName: true,
registrationNumber: true,
taxId: true,
subscriptionPlan: true,
maxUsers: true,
maxStorageGB: true,
```

#### **3. Remove Fallback Logic in Controller**
Edit `auth-service/src/controllers/tenantController.js`:
```javascript
// Remove fallback logic and use actual values
const tenantInfo = {
  // ... existing fields ...
  primaryColor: tenant.primaryColor,
  secondaryColor: tenant.secondaryColor,
  tagline: tenant.tagline,
  description: tenant.description,
  // ... etc
};
```

## New Database Fields

The migration will add these fields to the Tenant table:

### **Branding Fields**
- `primaryColor` (String) - Primary brand color
- `secondaryColor` (String) - Secondary brand color
- `tagline` (String) - Institution tagline
- `description` (String) - Institution description
- `website` (String) - Official website URL
- `postalCode` (String) - Postal code

### **Social Media & Marketing**
- `socialMedia` (JSON) - Social media links
- `metaTitle` (String) - SEO meta title
- `metaDescription` (String) - SEO meta description
- `metaKeywords` (String) - SEO meta keywords

### **Legal & Contact**
- `contactPerson` (String) - Primary contact person
- `contactEmail` (String) - Contact email
- `contactPhone` (String) - Contact phone
- `legalName` (String) - Legal business name
- `registrationNumber` (String) - Business registration number
- `taxId` (String) - Tax identification number

### **Subscription & Billing**
- `subscriptionPlan` (String) - Subscription plan type
- `maxUsers` (Int) - Maximum number of users
- `maxStorageGB` (Int) - Maximum storage in GB

## Testing After Migration

### **1. Test Institution Creation**
1. Navigate to `/tables/add-institution`
2. Fill out the 4-step form with all branding information
3. Submit the form
4. Verify no database errors occur

### **2. Test Tenant Detection**
1. Visit `{domain}.dualdimension.org`
2. Verify the tenant landing page shows custom branding
3. Check that all branding fields are properly displayed

### **3. Test API Endpoints**
```bash
# Test tenant creation
curl -X POST https://auth-mfby.onrender.com/api/tenants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenant": {...}, "adminUser": {...}}'

# Test tenant retrieval
curl https://auth-mfby.onrender.com/api/tenants/by-domain/maasainationalpolytechnic
```

## Rollback Plan

If something goes wrong, you can rollback:

```bash
# Rollback the last migration
npx prisma migrate reset

# Or rollback to a specific migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

## Current Status

✅ **Frontend Form**: Enhanced 4-step institution creation form  
✅ **Backend API**: Routes and controllers ready  
✅ **Database Schema**: Fields defined in Prisma schema  
⏳ **Database Migration**: Needs to be run  
⏳ **Code Updates**: Need to uncomment fields after migration  

## Next Steps

1. **Run the migration** (see Step 2 above)
2. **Uncomment the enhanced fields** in the code
3. **Test the complete flow**
4. **Remove debug components** once confirmed working

The enhanced institution creation system will be fully functional once the migration is complete! 