-- AlterTable
ALTER TABLE "Audit" ADD COLUMN     "generalNotificationSentAt" TIMESTAMP(3),
ADD COLUMN     "generalNotificationSentBy" TEXT;

-- CreateIndex
CREATE INDEX "Audit_generalNotificationSentAt_idx" ON "Audit"("generalNotificationSentAt");

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_generalNotificationSentBy_fkey" FOREIGN KEY ("generalNotificationSentBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
