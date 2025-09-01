-- CreateEnum
CREATE TYPE "PlanningMeetingStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "AuditPlanningMeeting" ADD COLUMN     "status" "PlanningMeetingStatus" NOT NULL DEFAULT 'UPCOMING';
