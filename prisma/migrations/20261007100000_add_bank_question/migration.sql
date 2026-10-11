-- CreateTable
CREATE TABLE "BankQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "primaryTagId" TEXT,
    "extraTagIds" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "questionType" TEXT NOT NULL DEFAULT 'single',
    "questionText" TEXT NOT NULL DEFAULT '',
    "rawText" TEXT,
    "answerText" TEXT,
    "analysis" TEXT,
    "requiresImage" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'raw',
    "contentHash" TEXT,
    "duplicateOf" TEXT,
    "confidence" TEXT,
    "importBatchId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankQuestion_primaryTagId_fkey" FOREIGN KEY ("primaryTagId") REFERENCES "KnowledgeTag" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankQuestion_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "BankImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "source" TEXT,
    "rawText" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "autoPublish" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'parsing',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PracticeQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "subject" TEXT,
    "tagId" TEXT,
    "errorItemId" TEXT,
    "bankQuestionId" TEXT,
    "questionText" TEXT NOT NULL,
    "answerText" TEXT,
    "analysis" TEXT,
    "eloRating" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isCorrect" BOOLEAN,
    "answeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PracticeQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeQuestion_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "KnowledgeTag" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PracticeQuestion_errorItemId_fkey" FOREIGN KEY ("errorItemId") REFERENCES "ErrorItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PracticeQuestion_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "BankQuestion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PracticeQuestion" ("analysis", "answerText", "answeredAt", "channel", "createdAt", "difficulty", "eloRating", "errorItemId", "id", "isCorrect", "questionText", "status", "subject", "tagId", "updatedAt", "userId") SELECT "analysis", "answerText", "answeredAt", "channel", "createdAt", "difficulty", "eloRating", "errorItemId", "id", "isCorrect", "questionText", "status", "subject", "tagId", "updatedAt", "userId" FROM "PracticeQuestion";
DROP TABLE "PracticeQuestion";
ALTER TABLE "new_PracticeQuestion" RENAME TO "PracticeQuestion";
CREATE INDEX "PracticeQuestion_userId_status_idx" ON "PracticeQuestion"("userId", "status");
CREATE INDEX "PracticeQuestion_userId_channel_status_idx" ON "PracticeQuestion"("userId", "channel", "status");
CREATE INDEX "PracticeQuestion_userId_tagId_status_idx" ON "PracticeQuestion"("userId", "tagId", "status");
CREATE INDEX "PracticeQuestion_userId_difficulty_status_idx" ON "PracticeQuestion"("userId", "difficulty", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BankQuestion_status_subject_difficulty_idx" ON "BankQuestion"("status", "subject", "difficulty");

-- CreateIndex
CREATE INDEX "BankQuestion_primaryTagId_status_idx" ON "BankQuestion"("primaryTagId", "status");

-- CreateIndex
CREATE INDEX "BankQuestion_importBatchId_idx" ON "BankQuestion"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "BankQuestion_contentHash_key" ON "BankQuestion"("contentHash");

-- CreateIndex
CREATE INDEX "BankImportBatch_createdAt_idx" ON "BankImportBatch"("createdAt");

