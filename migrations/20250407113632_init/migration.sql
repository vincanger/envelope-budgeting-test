-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'DECLINED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetProfile" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" INTEGER NOT NULL,

    CONSTRAINT "BudgetProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBudgetProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "budgetProfileId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBudgetProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Envelope" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "budgetProfileId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Envelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "envelopeId" INTEGER NOT NULL,
    "budgetProfileId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringRule" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "budgetProfileId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invitedByUserId" INTEGER,
    "acceptedByUserId" INTEGER,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auth" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "providerName" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerData" TEXT NOT NULL DEFAULT '{}',
    "authId" TEXT NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("providerName","providerUserId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetProfile_ownerId_key" ON "BudgetProfile"("ownerId");

-- CreateIndex
CREATE INDEX "UserBudgetProfile_userId_idx" ON "UserBudgetProfile"("userId");

-- CreateIndex
CREATE INDEX "UserBudgetProfile_budgetProfileId_idx" ON "UserBudgetProfile"("budgetProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBudgetProfile_userId_budgetProfileId_key" ON "UserBudgetProfile"("userId", "budgetProfileId");

-- CreateIndex
CREATE INDEX "Envelope_budgetProfileId_idx" ON "Envelope"("budgetProfileId");

-- CreateIndex
CREATE INDEX "Transaction_envelopeId_idx" ON "Transaction"("envelopeId");

-- CreateIndex
CREATE INDEX "Transaction_budgetProfileId_idx" ON "Transaction"("budgetProfileId");

-- CreateIndex
CREATE INDEX "Transaction_createdById_idx" ON "Transaction"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_budgetProfileId_idx" ON "Invitation"("budgetProfileId");

-- CreateIndex
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Auth_userId_key" ON "Auth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_id_key" ON "Session"("id");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "BudgetProfile" ADD CONSTRAINT "BudgetProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBudgetProfile" ADD CONSTRAINT "UserBudgetProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBudgetProfile" ADD CONSTRAINT "UserBudgetProfile_budgetProfileId_fkey" FOREIGN KEY ("budgetProfileId") REFERENCES "BudgetProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envelope" ADD CONSTRAINT "Envelope_budgetProfileId_fkey" FOREIGN KEY ("budgetProfileId") REFERENCES "BudgetProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_budgetProfileId_fkey" FOREIGN KEY ("budgetProfileId") REFERENCES "BudgetProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_budgetProfileId_fkey" FOREIGN KEY ("budgetProfileId") REFERENCES "BudgetProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auth" ADD CONSTRAINT "Auth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_authId_fkey" FOREIGN KEY ("authId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
