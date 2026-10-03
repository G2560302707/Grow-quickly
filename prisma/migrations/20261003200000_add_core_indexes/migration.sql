-- P0-2: 核心表索引(按用户+时间查询、错题本归属、掌握度筛选、复习计划、练习记录列表)
CREATE INDEX "ErrorItem_userId_createdAt_idx" ON "ErrorItem"("userId", "createdAt");
CREATE INDEX "ErrorItem_subjectId_idx" ON "ErrorItem"("subjectId");
CREATE INDEX "ErrorItem_userId_masteryLevel_idx" ON "ErrorItem"("userId", "masteryLevel");
CREATE INDEX "ReviewSchedule_errorItemId_idx" ON "ReviewSchedule"("errorItemId");
CREATE INDEX "PracticeRecord_userId_createdAt_idx" ON "PracticeRecord"("userId", "createdAt");
