-- AlterTable
ALTER TABLE "ErrorItem" ADD COLUMN "gradeSemester" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "educationStage" TEXT;
ALTER TABLE "User" ADD COLUMN "enrollmentYear" INTEGER;
