/*
  Warnings:

  - A unique constraint covering the columns `[documentId]` on the table `AuditPlan` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'AUDIT_PLAN';

-- AlterTable
ALTER TABLE "AuditPlan" ADD COLUMN     "documentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AuditPlan_documentId_key" ON "AuditPlan"("documentId");

-- AddForeignKey
ALTER TABLE "AuditPlan" ADD CONSTRAINT "AuditPlan_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
