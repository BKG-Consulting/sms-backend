-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('POLICY', 'PROCEDURE', 'FORM', 'RECORD', 'OTHER');

-- DropIndex
DROP INDEX "Campus_tenantId_idx";

-- DropIndex
DROP INDEX "Campus_tenantId_name_key";

-- DropIndex
DROP INDEX "Department_campusId_idx";

-- DropIndex
DROP INDEX "Department_hodId_idx";

-- DropIndex
DROP INDEX "Department_tenantId_idx";

-- DropIndex
DROP INDEX "Department_tenantId_name_campusId_key";

-- DropIndex
DROP INDEX "Role_tenantId_idx";

-- DropIndex
DROP INDEX "Role_tenantId_name_key";

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeRequestId" TEXT,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChangeRequest" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "description" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "newFileUrl" TEXT,
    "newVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentApproval" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "changeRequestId" TEXT,
    "approvedById" TEXT NOT NULL,
    "roleId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_tenantId_idx" ON "Document"("tenantId");

-- CreateIndex
CREATE INDEX "Document_ownerId_idx" ON "Document"("ownerId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Document_tenantId_title_key" ON "Document"("tenantId", "title");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "DocumentVersion_createdById_idx" ON "DocumentVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE INDEX "DocumentChangeRequest_documentId_idx" ON "DocumentChangeRequest"("documentId");

-- CreateIndex
CREATE INDEX "DocumentChangeRequest_requestedById_idx" ON "DocumentChangeRequest"("requestedById");

-- CreateIndex
CREATE INDEX "DocumentApproval_documentId_idx" ON "DocumentApproval"("documentId");

-- CreateIndex
CREATE INDEX "DocumentApproval_approvedById_idx" ON "DocumentApproval"("approvedById");

-- CreateIndex
CREATE INDEX "DocumentApproval_roleId_idx" ON "DocumentApproval"("roleId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "DocumentChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChangeRequest" ADD CONSTRAINT "DocumentChangeRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChangeRequest" ADD CONSTRAINT "DocumentChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "DocumentChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
