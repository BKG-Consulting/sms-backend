-- CreateTable
CREATE TABLE "AuditPlanningMeeting" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditPlanningMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditPlanningAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditPlanningAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditPlanningAgenda" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "agendaText" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditPlanningAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditPlanningAttendance_meetingId_userId_key" ON "AuditPlanningAttendance"("meetingId", "userId");

-- AddForeignKey
ALTER TABLE "AuditPlanningMeeting" ADD CONSTRAINT "AuditPlanningMeeting_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlanningMeeting" ADD CONSTRAINT "AuditPlanningMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlanningAttendance" ADD CONSTRAINT "AuditPlanningAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "AuditPlanningMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlanningAttendance" ADD CONSTRAINT "AuditPlanningAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlanningAgenda" ADD CONSTRAINT "AuditPlanningAgenda_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "AuditPlanningMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
