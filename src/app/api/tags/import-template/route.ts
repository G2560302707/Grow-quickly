/**
 * POST /api/tags/import-template
 * body: { mode?: 'merge' | 'replace' }  默认 merge
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createLogger } from "@grow/shared/logger";
import {
    importTemplateForUser,
    countUserTags,
    listUserTags,
    buildTagTree,
} from "@/lib/user-tag-tree";

const logger = createLogger("api:tags:import-template");

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let mode: "merge" | "replace" = "merge";
        try {
            const body = await request.json();
            if (body?.mode === "replace" || body?.mode === "merge") mode = body.mode;
        } catch {
            /* empty body ok */
        }

        const result = await importTemplateForUser(session.user.id, mode);
        const tags = await listUserTags(session.user.id);
        logger.info({ userId: session.user.id, mode, ...result }, "Imported gongkao template");

        return NextResponse.json({
            success: true,
            mode,
            ...result,
            total: await countUserTags(session.user.id),
            tags: buildTagTree(tags),
            message:
                mode === "replace"
                    ? `已替换个人树：删除 ${result.removed}，新建 ${result.created}`
                    : `已合并官方考点：新建 ${result.created} 个节点`,
        });
    } catch (error) {
        logger.error({ error }, "Import template failed");
        return NextResponse.json({ error: "导入失败" }, { status: 500 });
    }
}
