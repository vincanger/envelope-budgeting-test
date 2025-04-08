/*
  Warnings:

  - You are about to drop the column `createdById` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `isArchived` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `recurring` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `recurringRule` on the `Transaction` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_envelopeId_fkey";

-- DropIndex
DROP INDEX "Transaction_createdById_idx";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "createdById",
DROP COLUMN "isArchived",
DROP COLUMN "recurring",
DROP COLUMN "recurringRule",
ALTER COLUMN "envelopeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;
