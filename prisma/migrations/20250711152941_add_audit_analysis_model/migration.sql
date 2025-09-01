-- CreateTable
CREATE TABLE "AuditAnalysis" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "department" TEXT,
    "submittedById" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "remarks" TEXT NOT NULL,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "finishedAt" TIMESTAMP(3),
    "mrNotified" BOOLEAN NOT NULL DEFAULT false,
    "mrNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditAnalysis_auditId_department_key" ON "AuditAnalysis"("auditId", "department");

-- AddForeignKey
ALTER TABLE "AuditAnalysis" ADD CONSTRAINT "AuditAnalysis_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditAnalysis" ADD CONSTRAINT "AuditAnalysis_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
