-- AlterTable
ALTER TABLE "AuditFinding" ADD COLUMN     "checklistId" TEXT;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
