-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "auditId" TEXT;

-- CreateIndex
CREATE INDEX "Document_auditId_idx" ON "Document"("auditId");
