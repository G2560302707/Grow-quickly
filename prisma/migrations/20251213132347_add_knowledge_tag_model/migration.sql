-- CreateTable
CREATE TABLE "KnowledgeTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "code" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeTag_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KnowledgeTag" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ErrorItemToKnowledgeTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ErrorItemToKnowledgeTag_A_fkey" FOREIGN KEY ("A") REFERENCES "ErrorItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ErrorItemToKnowledgeTag_B_fkey" FOREIGN KEY ("B") REFERENCES "KnowledgeTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KnowledgeTag_parentId_idx" ON "KnowledgeTag"("parentId");

-- CreateIndex
CREATE INDEX "KnowledgeTag_subject_idx" ON "KnowledgeTag"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeTag_subject_name_userId_key" ON "KnowledgeTag"("subject", "name", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "_ErrorItemToKnowledgeTag_AB_unique" ON "_ErrorItemToKnowledgeTag"("A", "B");

-- CreateIndex
CREATE INDEX "_ErrorItemToKnowledgeTag_B_index" ON "_ErrorItemToKnowledgeTag"("B");
