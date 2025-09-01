-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "OpeningMeeting" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'UPCOMING',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "venue" TEXT,

    CONSTRAINT "OpeningMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningMeetingAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningMeetingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningMeetingAgenda" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "agendaText" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "discussed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "OpeningMeetingAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpeningMeetingAttendance_meetingId_userId_key" ON "OpeningMeetingAttendance"("meetingId", "userId");

-- AddForeignKey
ALTER TABLE "OpeningMeeting" ADD CONSTRAINT "OpeningMeeting_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningMeeting" ADD CONSTRAINT "OpeningMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningMeetingAttendance" ADD CONSTRAINT "OpeningMeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "OpeningMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningMeetingAttendance" ADD CONSTRAINT "OpeningMeetingAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningMeetingAgenda" ADD CONSTRAINT "OpeningMeetingAgenda_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "OpeningMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
