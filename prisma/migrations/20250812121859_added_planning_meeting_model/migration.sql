/*
  Warnings:

  - You are about to drop the `AuditPlanningAgenda` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AuditPlanningAttendance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AuditPlanningMeeting` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuditPlanningAgenda" DROP CONSTRAINT "AuditPlanningAgenda_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "AuditPlanningAttendance" DROP CONSTRAINT "AuditPlanningAttendance_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "AuditPlanningAttendance" DROP CONSTRAINT "AuditPlanningAttendance_userId_fkey";

-- DropForeignKey
ALTER TABLE "AuditPlanningMeeting" DROP CONSTRAINT "AuditPlanningMeeting_auditId_fkey";

-- DropForeignKey
ALTER TABLE "AuditPlanningMeeting" DROP CONSTRAINT "AuditPlanningMeeting_createdById_fkey";

-- DropTable
DROP TABLE "AuditPlanningAgenda";

-- DropTable
DROP TABLE "AuditPlanningAttendance";

-- DropTable
DROP TABLE "AuditPlanningMeeting";

-- CreateTable
CREATE TABLE "PlanningMeeting" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "PlanningMeetingStatus" NOT NULL DEFAULT 'UPCOMING',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "venue" TEXT,

    CONSTRAINT "PlanningMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningMeetingAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningMeetingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningMeetingAgenda" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "agendaText" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "discussed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "PlanningMeetingAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanningMeetingAttendance_meetingId_userId_key" ON "PlanningMeetingAttendance"("meetingId", "userId");

-- AddForeignKey
ALTER TABLE "PlanningMeeting" ADD CONSTRAINT "PlanningMeeting_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningMeeting" ADD CONSTRAINT "PlanningMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningMeetingAttendance" ADD CONSTRAINT "PlanningMeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "PlanningMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningMeetingAttendance" ADD CONSTRAINT "PlanningMeetingAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningMeetingAgenda" ADD CONSTRAINT "PlanningMeetingAgenda_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "PlanningMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
