-- AlterTable
ALTER TABLE "User" ADD COLUMN     "campusId" TEXT;

-- CreateTable
CREATE TABLE "Campus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "county" TEXT,
    "country" TEXT DEFAULT 'Kenya',
    "phone" TEXT,
    "email" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "tenantId" TEXT,
    "targetUserId" TEXT NOT NULL,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTP" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "OTP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campus_tenantId_idx" ON "Campus"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_tenantId_name_key" ON "Campus"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_targetUserId_idx" ON "Notification"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "OTP_email_createdAt_key" ON "OTP"("email", "createdAt");

-- CreateIndex
CREATE INDEX "User_campusId_idx" ON "User"("campusId");

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTP" ADD CONSTRAINT "OTP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
