-- AlterTable
ALTER TABLE "Audit" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "timetable" JSONB;

-- AlterTable
ALTER TABLE "AuditPlan" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "timetable" JSONB;
