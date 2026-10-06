/**
 * 邮件通知：nodemailer SMTP。
 * 配置来自 app-config.json 的 smtp 节（管理员在设置弹窗"邮件通知"里配置）。
 * 反馈提交后的通知是 fire-and-forget：任何失败只记日志，绝不阻塞反馈本身。
 */
import nodemailer, { type Transporter } from "nodemailer";
import { getAppConfig, type AppConfig, type FeedbackNotificationPayload } from "./config";
import { createLogger } from "./logger";

const logger = createLogger("lib:mailer");

let cached: { key: string; transport: Transporter } | null = null;

function smtpKey(smtp: NonNullable<AppConfig["smtp"]>): string {
    return `${smtp.host}:${smtp.port || 465}:${smtp.secure ? 1 : 0}:${smtp.user}:${smtp.pass}:${smtp.to || ""}`;
}

function getTransport(smtp: NonNullable<AppConfig["smtp"]>): Transporter {
    const key = smtpKey(smtp);
    if (cached && cached.key === key) return cached.transport;
    cached = {
        key,
        transport: nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port || 465,
            secure: smtp.secure ?? (smtp.port || 465) === 465,
            auth: { user: smtp.user, pass: smtp.pass },
        }),
    };
    return cached.transport;
}

export function isMailNotifyEnabled(): boolean {
    const smtp = getAppConfig().smtp;
    return !!(smtp?.host && smtp.user && smtp.pass && smtp.enabled !== false);
}

function renderFeedbackHtml(p: FeedbackNotificationPayload): string {
    const typeLabel = p.type === "bug" ? "问题反馈" : p.type === "feature" ? "功能建议" : "其他";
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return [
        `<h2 style="margin:0 0 12px">新用户反馈（${typeLabel}）</h2>`,
        `<p style="margin:0 0 8px;color:#555">来自 <b>${esc(p.userName || p.userEmail || "未知用户")}</b>（${esc(p.userEmail || "—")}），${esc(p.createdAt)}</p>`,
        p.contact ? `<p style="margin:0 0 8px;color:#555">联系方式：${esc(p.contact)}</p>` : "",
        `<div style="white-space:pre-wrap;border:1px solid #ddd;border-radius:8px;padding:12px;line-height:1.6">${esc(p.content)}</div>`,
        `<p style="margin-top:12px;color:#999;font-size:12px">处理入口：网页端 → 设置 → 反馈管理</p>`,
    ].join("\n");
}

/** 发送反馈通知邮件；未配置/被禁用时静默跳过，失败只记日志 */
export async function sendFeedbackNotification(p: FeedbackNotificationPayload): Promise<boolean> {
    const smtp = getAppConfig().smtp;
    if (!smtp || !smtp.host || !smtp.user || !smtp.pass || smtp.enabled === false) {
        logger.debug("SMTP not configured or disabled, skip feedback notification");
        return false;
    }
    try {
        const typeLabel = p.type === "bug" ? "问题反馈" : p.type === "feature" ? "功能建议" : "其他";
        const info = await getTransport(smtp).sendMail({
            from: `"错题本反馈" <${smtp.user}>`,
            to: smtp.to || smtp.user,
            subject: `【用户反馈·${typeLabel}】${(p.content || "").slice(0, 40)}${(p.content || "").length > 40 ? "…" : ""}`,
            text: p.content,
            html: renderFeedbackHtml(p),
        });
        logger.info({ messageId: info.messageId, type: p.type }, "Feedback notification emailed");
        return true;
    } catch (error) {
        logger.error({ error }, "Failed to send feedback notification email");
        return false;
    }
}

/** 管理员"发送测试邮件"：配置未保存时允许传入当前表单值覆盖 */
export async function sendTestMail(override?: AppConfig["smtp"]): Promise<{ ok: boolean; message: string }> {
    const smtp = override?.host ? override : getAppConfig().smtp;
    if (!smtp || !smtp.host || !smtp.user || !smtp.pass) {
        return { ok: false, message: "请先完整填写 SMTP 主机、账号与授权码" };
    }
    try {
        const info = await getTransport(smtp).sendMail({
            from: `"错题本" <${smtp.user}>`,
            to: smtp.to || smtp.user,
            subject: "【错题本】邮件通知测试成功",
            text: "这是一封测试邮件。收到即说明 SMTP 配置正确，用户反馈将会推送到这个邮箱。",
        });
        logger.info({ messageId: info.messageId }, "Test email sent");
        return { ok: true, message: `测试邮件已发送至 ${smtp.to || smtp.user}` };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error }, "Test email failed");
        return { ok: false, message: `发送失败：${message}` };
    }
}
