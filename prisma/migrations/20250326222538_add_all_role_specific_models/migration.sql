-- CreateTable
CREATE TABLE "Trainee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trainee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trainer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HOD" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HOD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registrar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registrar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trainee_userId_key" ON "Trainee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Trainer_userId_key" ON "Trainer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HOD_userId_key" ON "HOD"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "Admin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Registrar_userId_key" ON "Registrar"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdmin_userId_key" ON "SuperAdmin"("userId");

-- AddForeignKey
ALTER TABLE "Trainee" ADD CONSTRAINT "Trainee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trainer" ADD CONSTRAINT "Trainer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HOD" ADD CONSTRAINT "HOD_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registrar" ADD CONSTRAINT "Registrar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdmin" ADD CONSTRAINT "SuperAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
