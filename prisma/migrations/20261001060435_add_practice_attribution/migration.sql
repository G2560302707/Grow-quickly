-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PracticeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subject" TEXT,
    "difficulty" TEXT,
    "isCorrect" BOOLEAN,
    "errorItemId" TEXT,
    "tagId" TEXT,
    "questionText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeRecord_errorItemId_fkey" FOREIGN KEY ("errorItemId") REFERENCES "ErrorItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PracticeRecord_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "KnowledgeTag" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PracticeRecord" ("createdAt", "difficulty", "id", "isCorrect", "subject", "userId") SELECT "createdAt", "difficulty", "id", "isCorrect", "subject", "userId" FROM "PracticeRecord";
DROP TABLE "PracticeRecord";
ALTER TABLE "new_PracticeRecord" RENAME TO "PracticeRecord";
CREATE INDEX "PracticeRecord_userId_tagId_idx" ON "PracticeRecord"("userId", "tagId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
