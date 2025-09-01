/*
  Warnings:

  - You are about to drop the column `createdBy` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `headId` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `tenantName` on the `User` table. All the data in the column will be lost.
  - The primary key for the `UserRole` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `OTP` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_DepartmentUsers` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[tenantId,name,campusId]` on the table `Department` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,name]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,roleId]` on the table `UserRole` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdBy` to the `Tenant` table without a default value. This is not possible if the table is not empty.
  - Made the column `domain` on table `Tenant` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `Tenant` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `type` to the `Tenant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `User` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `UserRole` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updatedAt` to the `UserRole` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('UNIVERSITY', 'COLLEGE', 'SCHOOL', 'INSTITUTE', 'OTHER');

-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_headId_fkey";

-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "OTP" DROP CONSTRAINT "OTP_userId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Role" DROP CONSTRAINT "Role_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "_DepartmentUsers" DROP CONSTRAINT "_DepartmentUsers_A_fkey";

-- DropForeignKey
ALTER TABLE "_DepartmentUsers" DROP CONSTRAINT "_DepartmentUsers_B_fkey";

-- DropIndex
DROP INDEX "Department_headId_key";

-- DropIndex
DROP INDEX "Role_name_tenantId_key";

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "createdBy",
DROP COLUMN "headId",
ADD COLUMN     "campusId" TEXT,
ADD COLUMN     "hodId" TEXT;

-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "accreditationNumber" TEXT,
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "currency" TEXT DEFAULT 'KES',
ADD COLUMN     "establishedYear" INTEGER,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "InstitutionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "timezone" TEXT DEFAULT 'Africa/Nairobi',
ALTER COLUMN "domain" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "InstitutionType" NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "tenantName",
ADD COLUMN     "createdBy" TEXT NOT NULL,
ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "OTP";

-- DropTable
DROP TABLE "RefreshToken";

-- DropTable
DROP TABLE "_DepartmentUsers";

-- CreateIndex
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");

-- CreateIndex
CREATE INDEX "Department_campusId_idx" ON "Department"("campusId");

-- CreateIndex
CREATE INDEX "Department_hodId_idx" ON "Department"("hodId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_name_campusId_key" ON "Department"("tenantId", "name", "campusId");

-- CreateIndex
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Tenant_domain_idx" ON "Tenant"("domain");

-- CreateIndex
CREATE INDEX "Tenant_email_idx" ON "Tenant"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_hodId_fkey" FOREIGN KEY ("hodId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
