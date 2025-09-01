-- AlterTable
ALTER TABLE "AuditFinding" ADD COLUMN     "categorizationFinished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "categorizationFinishedAt" TIMESTAMP(3);
