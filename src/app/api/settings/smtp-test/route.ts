import { NextResponse } from "next/server";
import { unauthorized, forbidden, internalError } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@grow/shared/auth-utils";
import { sendTestMail } from "@grow/shared/mailer";
import type { AppConfig } from "@grow/shared/config";

const logger = createLogger('api:settings:smtp-test');

/**
 * POST /api/settings/smtp-test
 * 管理员发送测试邮件验证 SMTP 配置。
 * body: { smtp?: AppConfig["smtp"] } —— 允许用当前表单未保存的值先测。
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return unauthorized("Authentication required");
    }
    if (!requireAdmin(session)) {
        return forbidden("Admin access required");
    }

    try {
        const body = await req.json().catch(() => ({}));
        const override = (body?.smtp && typeof body.smtp === "object" ? body.smtp : undefined) as AppConfig["smtp"] | undefined;
        const result = await sendTestMail(override);
        logger.info({ ok: result.ok }, 'SMTP test mail attempted');
        return NextResponse.json(result);
    } catch (error) {
        logger.error({ error }, 'SMTP test failed unexpectedly');
        return internalError("Failed to send test email");
    }
}
