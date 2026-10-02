-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AnnouncementRead_userId_idx" ON "AnnouncementRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");

-- Seed: 迁移原本写死在前端铃铛里的两条公告，保证上线后内容延续
-- 注意：本 Prisma 版本将 DateTime 存为整数毫秒，须与 CURRENT_TIMESTAMP(text) 保持一致，
-- 否则 SQLite 跨类型排序（TEXT > INTEGER）会让种子公告永远排在新公告之前。
INSERT INTO "Announcement" ("id", "title", "content", "isActive", "createdAt", "updatedAt") VALUES
('ann-seed-profile', '完善个人信息', '请务必正确填写用户教育阶段和入学年份，保障标签正确关联。查看路径：设置 → 账户。', true, (strftime('%s','now') * 1000), (strftime('%s','now') * 1000)),
('ann-seed-tags', '标签库维护提示', '如果标准标签库加载异常，请使用管理员账号在 设置 → 危险 → 标签系统迁移 重置标准标签库。', true, (strftime('%s','now') * 1000), (strftime('%s','now') * 1000));
