-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'TRIAL', 'PENDING');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('BASIC', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "address" TEXT,
ADD COLUMN     "analyticsId" TEXT,
ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'Kenya',
ADD COLUMN     "county" TEXT,
ADD COLUMN     "customizations" JSONB,
ADD COLUMN     "features" JSONB,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "marketingInfo" JSONB,
ADD COLUMN     "maxStorageGB" INTEGER DEFAULT 5,
ADD COLUMN     "maxUsers" INTEGER DEFAULT 10,
ADD COLUMN     "nextBillingDate" TIMESTAMP(3),
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "socialMedia" JSONB,
ADD COLUMN     "subscriptionPlan" TEXT DEFAULT 'BASIC',
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "trackingCode" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "TenantBranding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "logoDarkUrl" TEXT,
    "faviconUrl" TEXT,
    "logoAltText" TEXT,
    "primaryColor" TEXT DEFAULT '#00A79D',
    "secondaryColor" TEXT DEFAULT '#EF8201',
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "fontFamily" TEXT DEFAULT 'Satoshi',
    "headingFontFamily" TEXT,
    "tagline" TEXT,
    "description" TEXT,
    "missionStatement" TEXT,
    "visionStatement" TEXT,
    "valueProposition" TEXT,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "heroImageUrl" TEXT,
    "heroVideoUrl" TEXT,
    "primaryCtaText" TEXT DEFAULT 'Get Started',
    "secondaryCtaText" TEXT DEFAULT 'Learn More',
    "footerText" TEXT,
    "footerLinks" JSONB,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "metaKeywords" TEXT,
    "ogImageUrl" TEXT,
    "customCss" TEXT,
    "customJs" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantBranding_tenantId_key" ON "TenantBranding"("tenantId");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "Tenant_subscriptionStatus_idx" ON "Tenant"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "Tenant_type_idx" ON "Tenant"("type");

-- AddForeignKey
ALTER TABLE "TenantBranding" ADD CONSTRAINT "TenantBranding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
