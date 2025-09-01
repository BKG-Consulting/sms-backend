/*
  Warnings:

  - You are about to drop the column `roleId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Admin` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Auditor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `HOD` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ManagementRep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Registrar` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Staff` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SuperAdmin` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Trainee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Trainer` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `firstName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Admin" DROP CONSTRAINT "Admin_userId_fkey";

-- DropForeignKey
ALTER TABLE "Auditor" DROP CONSTRAINT "Auditor_userId_fkey";

-- DropForeignKey
ALTER TABLE "HOD" DROP CONSTRAINT "HOD_userId_fkey";

-- DropForeignKey
ALTER TABLE "ManagementRep" DROP CONSTRAINT "ManagementRep_userId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Registrar" DROP CONSTRAINT "Registrar_userId_fkey";

-- DropForeignKey
ALTER TABLE "Staff" DROP CONSTRAINT "Staff_userId_fkey";

-- DropForeignKey
ALTER TABLE "SuperAdmin" DROP CONSTRAINT "SuperAdmin_userId_fkey";

-- DropForeignKey
ALTER TABLE "Trainee" DROP CONSTRAINT "Trainee_userId_fkey";

-- DropForeignKey
ALTER TABLE "Trainer" DROP CONSTRAINT "Trainer_userId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_roleId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "roleId",
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL;

-- DropTable
DROP TABLE "Admin";

-- DropTable
DROP TABLE "Auditor";

-- DropTable
DROP TABLE "HOD";

-- DropTable
DROP TABLE "ManagementRep";

-- DropTable
DROP TABLE "Registrar";

-- DropTable
DROP TABLE "Staff";

-- DropTable
DROP TABLE "SuperAdmin";

-- DropTable
DROP TABLE "Trainee";

-- DropTable
DROP TABLE "Trainer";

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "tenantId" TEXT NOT NULL,
    "headId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTP" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "OTP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DepartmentUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DepartmentUsers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_headId_key" ON "Department"("headId");

-- CreateIndex
CREATE UNIQUE INDEX "OTP_email_createdAt_key" ON "OTP"("email", "createdAt");

-- CreateIndex
CREATE INDEX "_DepartmentUsers_B_index" ON "_DepartmentUsers"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTP" ADD CONSTRAINT "OTP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentUsers" ADD CONSTRAINT "_DepartmentUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentUsers" ADD CONSTRAINT "_DepartmentUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
