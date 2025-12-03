-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ErrorItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "originalImageUrl" TEXT NOT NULL,
    "ocrText" TEXT,
    "questionText" TEXT,
    "answerText" TEXT,
    "analysis" TEXT,
    "knowledgePoints" TEXT,
    "source" TEXT,
    "errorType" TEXT,
    "userNotes" TEXT,
    "masteryLevel" INTEGER NOT NULL DEFAULT 0,
    "gradeSemester" TEXT,
    "paperLevel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ErrorItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ErrorItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ErrorItem" ("analysis", "answerText", "createdAt", "errorType", "gradeSemester", "id", "knowledgePoints", "masteryLevel", "ocrText", "originalImageUrl", "paperLevel", "questionText", "source", "subjectId", "updatedAt", "userId", "userNotes") SELECT "analysis", "answerText", "createdAt", "errorType", "gradeSemester", "id", "knowledgePoints", "masteryLevel", "ocrText", "originalImageUrl", "paperLevel", "questionText", "source", "subjectId", "updatedAt", "userId", "userNotes" FROM "ErrorItem";
DROP TABLE "ErrorItem";
ALTER TABLE "new_ErrorItem" RENAME TO "ErrorItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
