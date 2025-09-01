-- CreateEnum
CREATE TYPE "ManagementReviewMeetingStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "Audit" ADD COLUMN     "managementReviewInvitationSentAt" TIMESTAMP(3),
ADD COLUMN     "managementReviewInvitationSentBy" TEXT;

-- CreateTable
CREATE TABLE "ManagementReviewMeeting" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "ManagementReviewMeetingStatus" NOT NULL DEFAULT 'UPCOMING',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "venue" TEXT,

    CONSTRAINT "ManagementReviewMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementReviewAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementReviewAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementReviewMinute" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementReviewMinute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagementReviewAttendance_meetingId_userId_key" ON "ManagementReviewAttendance"("meetingId", "userId");

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_managementReviewInvitationSentBy_fkey" FOREIGN KEY ("managementReviewInvitationSentBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementReviewMeeting" ADD CONSTRAINT "ManagementReviewMeeting_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementReviewMeeting" ADD CONSTRAINT "ManagementReviewMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementReviewAttendance" ADD CONSTRAINT "ManagementReviewAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ManagementReviewMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementReviewAttendance" ADD CONSTRAINT "ManagementReviewAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementReviewMinute" ADD CONSTRAINT "ManagementReviewMinute_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ManagementReviewMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
