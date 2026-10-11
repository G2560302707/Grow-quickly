-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BankQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL DEFAULT '',
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
INSERT INTO "new_BankQuestion" ("analysis", "answerText", "attemptCount", "confidence", "contentHash", "correctCount", "createdAt", "difficulty", "duplicateOf", "extraTagIds", "id", "importBatchId", "primaryTagId", "questionText", "questionType", "rawText", "requiresImage", "source", "status", "subject", "updatedAt") SELECT "analysis", "answerText", "attemptCount", "confidence", "contentHash", "correctCount", "createdAt", "difficulty", "duplicateOf", "extraTagIds", "id", "importBatchId", "primaryTagId", "questionText", "questionType", "rawText", "requiresImage", "source", "status", "subject", "updatedAt" FROM "BankQuestion";
DROP TABLE "BankQuestion";
ALTER TABLE "new_BankQuestion" RENAME TO "BankQuestion";
CREATE INDEX "BankQuestion_status_subject_difficulty_idx" ON "BankQuestion"("status", "subject", "difficulty");
CREATE INDEX "BankQuestion_primaryTagId_status_idx" ON "BankQuestion"("primaryTagId", "status");
CREATE INDEX "BankQuestion_importBatchId_idx" ON "BankQuestion"("importBatchId");
CREATE UNIQUE INDEX "BankQuestion_contentHash_key" ON "BankQuestion"("contentHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

