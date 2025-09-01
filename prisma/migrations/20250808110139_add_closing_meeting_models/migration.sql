-- CreateTable
CREATE TABLE "ClosingMeeting" (
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

    CONSTRAINT "ClosingMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosingMeetingAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosingMeetingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosingMeetingAgenda" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "agendaText" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "discussed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "ClosingMeetingAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClosingMeetingAttendance_meetingId_userId_key" ON "ClosingMeetingAttendance"("meetingId", "userId");

-- AddForeignKey
ALTER TABLE "ClosingMeeting" ADD CONSTRAINT "ClosingMeeting_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingMeeting" ADD CONSTRAINT "ClosingMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingMeetingAttendance" ADD CONSTRAINT "ClosingMeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ClosingMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingMeetingAttendance" ADD CONSTRAINT "ClosingMeetingAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingMeetingAgenda" ADD CONSTRAINT "ClosingMeetingAgenda_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ClosingMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
