-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('PLANNING', 'OPENING', 'CLOSING');

-- AlterTable
ALTER TABLE "AuditPlanningMeeting" ADD COLUMN     "type" "MeetingType" NOT NULL DEFAULT 'PLANNING';
