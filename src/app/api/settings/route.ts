import { NextResponse } from "next/server";
import { getAppConfig, updateAppConfig, AppConfig } from "@grow/shared/config";
import { internalError, unauthorized, forbidden } from "@grow/shared/api-errors";
import { createLogger } from "@grow/shared/logger";
import { OpenAIInstance } from "@grow/shared/types/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@grow/shared/auth-utils";

const logger = createLogger('api:settings');

export const dynamic = 'force-dynamic';

const MASKED_KEY = '********';

// 非 admin 用户看到的配置：API Key 一律掩码，全局 AI 凭据不下发给普通用户。
// 掩码值与 POST 的保留逻辑（'********' 不覆盖原值）配套。
function maskConfig(config: AppConfig): AppConfig {
    return {
        ...config,
        openai: {
            ...config.openai,
            instances: (config.openai?.instances || []).map(i => ({
                ...i,
                apiKey: i.apiKey ? MASKED_KEY : '',
            })),
        },
        gemini: { ...config.gemini, apiKey: config.gemini?.apiKey ? MASKED_KEY : '' },
        azure: { ...config.azure, apiKey: config.azure?.apiKey ? MASKED_KEY : '' },
        // SMTP 凭据同样不下发给普通用户
        smtp: undefined,
    };
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return unauthorized("Authentication required");
    }

    const config = getAppConfig();
    return NextResponse.json(requireAdmin(session) ? config : maskConfig(config));
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return unauthorized("Authentication required");
    }
    if (!requireAdmin(session)) {
        return forbidden("Admin access required");
    }

    try {
        const body = await req.json();
        const currentConfig = getAppConfig();

        // Don't save masked keys if they somehow get sent back (for Gemini)
        if (body.gemini?.apiKey === MASKED_KEY) {
            // 保留原有的 API Key
            body.gemini.apiKey = currentConfig.gemini?.apiKey;
        }

        // For OpenAI instances, preserve original keys for masked entries
        if (body.openai?.instances) {
            const currentInstances = currentConfig.openai?.instances || [];
            body.openai.instances = body.openai.instances.map((instance: OpenAIInstance) => {
                if (instance.apiKey === MASKED_KEY) {
                    // 查找原有实例并保留其 API Key
                    const originalInstance = currentInstances.find((i: OpenAIInstance) => i.id === instance.id);
                    return {
                        ...instance,
                        apiKey: originalInstance?.apiKey || '',
                    };
                }
                return instance;
            });
        }

        // For Azure, preserve original key if masked
        if (body.azure?.apiKey === MASKED_KEY) {
            body.azure.apiKey = currentConfig.azure?.apiKey;
        }

        // For SMTP, preserve original pass if masked
        if (body.smtp?.pass === MASKED_KEY) {
            body.smtp.pass = currentConfig.smtp?.pass || '';
        }

        const updatedConfig = updateAppConfig(body);
        return NextResponse.json(updatedConfig);
    } catch (error) {
        logger.error({ error }, 'Failed to update settings');
        return internalError("Failed to update settings");
    }
}


