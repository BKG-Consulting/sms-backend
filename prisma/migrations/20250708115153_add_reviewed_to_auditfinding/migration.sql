-- AlterTable
ALTER TABLE "AuditFinding" ADD COLUMN     "reviewed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
