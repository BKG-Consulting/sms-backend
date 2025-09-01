-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'PARTIALLY_COMPLIANT');

-- CreateEnum
CREATE TYPE "ImprovementStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');

-- CreateTable
CREATE TABLE "ComplianceRecord" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'COMPLIANT',
    "evidence" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementOpportunity" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "opportunity" TEXT NOT NULL,
    "actionPlan" TEXT,
    "ownerId" TEXT,
    "status" "ImprovementStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImprovementOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRecord_findingId_key" ON "ComplianceRecord"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "ImprovementOpportunity_findingId_key" ON "ImprovementOpportunity"("findingId");

-- AddForeignKey
ALTER TABLE "ComplianceRecord" ADD CONSTRAINT "ComplianceRecord_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRecord" ADD CONSTRAINT "ComplianceRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementOpportunity" ADD CONSTRAINT "ImprovementOpportunity_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementOpportunity" ADD CONSTRAINT "ImprovementOpportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementOpportunity" ADD CONSTRAINT "ImprovementOpportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
