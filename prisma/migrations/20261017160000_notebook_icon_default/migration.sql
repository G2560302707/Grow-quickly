-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL DEFAULT 'other',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subject" ("createdAt", "id", "name", "updatedAt", "userId") SELECT "createdAt", "id", "name", "updatedAt", "userId" FROM "Subject";
DROP TABLE "Subject";
ALTER TABLE "new_Subject" RENAME TO "Subject";
CREATE UNIQUE INDEX "Subject_name_userId_key" ON "Subject" ("name", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- 存量数据：按名称回填旧错题本图标
UPDATE "Subject" SET "iconKey" = 'yanyu'    WHERE "name" = '言语理解' AND "iconKey" = 'other';
UPDATE "Subject" SET "iconKey" = 'panduan'  WHERE "name" IN ('判断推理', '判断') AND "iconKey" = 'other';
UPDATE "Subject" SET "iconKey" = 'shuliang' WHERE "name" = '数量关系' AND "iconKey" = 'other';
UPDATE "Subject" SET "iconKey" = 'ziliao'   WHERE "name" = '资料分析' AND "iconKey" = 'other';
UPDATE "Subject" SET "iconKey" = 'changshi' WHERE "name" = '常识判断' AND "iconKey" = 'other';

-- 存量数据：已有名为"其他"的本优先设为默认本（每用户至多一个）
UPDATE "Subject" SET "isDefault" = 1
WHERE "name" = '其他' AND "isDefault" = 0
  AND "userId" NOT IN (SELECT "userId" FROM "Subject" WHERE "isDefault" = 1);

-- 存量数据：仍无默认本的用户补建"其他"默认本（幂等）
INSERT INTO "Subject" ("id", "name", "userId", "iconKey", "isDefault", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), '其他', u."id", 'other', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "Subject" s WHERE s."userId" = u."id" AND s."isDefault" = 1)
  AND NOT EXISTS (SELECT 1 FROM "Subject" s WHERE s."userId" = u."id" AND s."name" = '其他');
