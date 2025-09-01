-- CreateEnum
CREATE TYPE "FeedbackOrigin" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "FeedbackSource" AS ENUM ('ANONYMOUS', 'USER', 'OTHER');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "origin" "FeedbackOrigin" NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "source" "FeedbackSource" NOT NULL,
    "sourceDetail" TEXT,
    "departmentId" TEXT,
    "rating" INTEGER,
    "message" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
