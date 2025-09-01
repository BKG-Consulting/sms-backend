/*
  Warnings:

  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `departmentId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_departmentId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "createdAt",
DROP COLUMN "createdBy",
DROP COLUMN "departmentId",
DROP COLUMN "updatedAt",
DROP COLUMN "verified";

-- CreateTable
CREATE TABLE "UserDepartmentRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "roleId" TEXT NOT NULL,
    "isPrimaryDepartment" BOOLEAN NOT NULL DEFAULT false,
    "isPrimaryRole" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDepartmentRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDepartmentRole_userId_idx" ON "UserDepartmentRole"("userId");

-- CreateIndex
CREATE INDEX "UserDepartmentRole_departmentId_idx" ON "UserDepartmentRole"("departmentId");

-- CreateIndex
CREATE INDEX "UserDepartmentRole_roleId_idx" ON "UserDepartmentRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDepartmentRole_userId_departmentId_roleId_key" ON "UserDepartmentRole"("userId", "departmentId", "roleId");

-- AddForeignKey
ALTER TABLE "UserDepartmentRole" ADD CONSTRAINT "UserDepartmentRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartmentRole" ADD CONSTRAINT "UserDepartmentRole_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartmentRole" ADD CONSTRAINT "UserDepartmentRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
