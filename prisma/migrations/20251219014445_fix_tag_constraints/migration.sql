/*
  Warnings:

  - A unique constraint covering the columns `[subject,name,userId,parentId]` on the table `KnowledgeTag` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "KnowledgeTag_subject_name_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeTag_subject_name_userId_parentId_key" ON "KnowledgeTag"("subject", "name", "userId", "parentId");
