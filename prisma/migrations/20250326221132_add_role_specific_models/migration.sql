-- DropEnum
DROP TYPE "InstitutionStatus";

-- DropEnum
DROP TYPE "InstitutionType";

-- CreateTable
CREATE TABLE "Auditor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementRep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagementRep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Auditor_userId_key" ON "Auditor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementRep_userId_key" ON "ManagementRep"("userId");

-- AddForeignKey
ALTER TABLE "Auditor" ADD CONSTRAINT "Auditor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementRep" ADD CONSTRAINT "ManagementRep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
