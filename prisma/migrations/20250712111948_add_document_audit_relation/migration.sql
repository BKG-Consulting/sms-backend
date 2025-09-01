-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
