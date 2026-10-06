-- AlterTable
ALTER TABLE "ErrorItem" ADD COLUMN "sourceType" TEXT;

-- CreateTable
CREATE TABLE "PracticeQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "subject" TEXT,
    "tagId" TEXT,
    "errorItemId" TEXT,
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
    CONSTRAINT "PracticeQuestion_errorItemId_fkey" FOREIGN KEY ("errorItemId") REFERENCES "ErrorItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "channel" TEXT,
    "questionId" TEXT,
    "questionText" TEXT,
    "answerText" TEXT,
    "analysis" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeRecord_errorItemId_fkey" FOREIGN KEY ("errorItemId") REFERENCES "ErrorItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PracticeRecord_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "KnowledgeTag" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PracticeRecord_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PracticeQuestion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PracticeRecord" ("analysis", "answerText", "createdAt", "difficulty", "errorItemId", "id", "isCorrect", "questionText", "subject", "tagId", "userId") SELECT "analysis", "answerText", "createdAt", "difficulty", "errorItemId", "id", "isCorrect", "questionText", "subject", "tagId", "userId" FROM "PracticeRecord";
DROP TABLE "PracticeRecord";
ALTER TABLE "new_PracticeRecord" RENAME TO "PracticeRecord";
CREATE INDEX "PracticeRecord_userId_tagId_idx" ON "PracticeRecord"("userId", "tagId");
CREATE INDEX "PracticeRecord_userId_createdAt_idx" ON "PracticeRecord"("userId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PracticeQuestion_userId_status_idx" ON "PracticeQuestion"("userId", "status");

-- CreateIndex
CREATE INDEX "PracticeQuestion_userId_channel_status_idx" ON "PracticeQuestion"("userId", "channel", "status");

-- CreateIndex
CREATE INDEX "PracticeQuestion_userId_tagId_status_idx" ON "PracticeQuestion"("userId", "tagId", "status");

-- CreateIndex
CREATE INDEX "PracticeQuestion_userId_difficulty_status_idx" ON "PracticeQuestion"("userId", "difficulty", "status");


-- 回填：历史练习记录按归因字段推导渠道（与前端历史推导规则一致：tagId→smart，errorItemId→similar，其余→free）
UPDATE "PracticeRecord" SET "channel" = CASE
  WHEN "tagId" IS NOT NULL THEN 'smart'
  WHEN "errorItemId" IS NOT NULL THEN 'similar'
  ELSE 'free' END
WHERE "channel" IS NULL;

-- 回填：错题数据大类（拍照/手动录入为 manual，练习答错自动收录为 practice）
UPDATE "ErrorItem" SET "sourceType" = CASE
  WHEN "origin" IS NULL THEN 'manual'
  ELSE 'practice' END
WHERE "sourceType" IS NULL;
