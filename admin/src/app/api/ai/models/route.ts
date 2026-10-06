import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@grow/shared/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireAdmin } from '@grow/shared/auth-utils';
import { unauthorized, forbidden } from '@grow/shared/api-errors';

const logger = createLogger('api:ai:models');

interface ModelInfo {
    id: string;
    name: string;
    owned_by?: string;
}

interface ModelsRequestBody {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
}

// 从模型 ID 中提取短名称
function extractModelName(modelId: string): string {
    // models/gemini-2.0-flash -> gemini-2.0-flash
    return modelId.replace(/^models\//, '');
}

async function fetchGeminiModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
    const url = `${baseUrl}/v1beta/models?key=${apiKey}`;

    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, errorText }, 'Gemini models API error');
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return ((data.models || []) as Array<{ name?: string }>)
        .map((m) => {
            const id = extractModelName(m.name || '');
            return {
                id,
                name: id,
                owned_by: 'Google',
            };
        });
}

async function fetchOpenAIModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
    const url = `${baseUrl}/models`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        logger.error({ statusText: response.statusText }, 'OpenAI models API error');
        throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    return ((data.data || []) as Array<{ id?: string; owned_by?: string }>)
        .map((model) => ({
            id: model.id || '',
            name: model.id || '',
            owned_by: model.owned_by,
        }));
}

// 仅 admin 可用：该接口会以用户提供的 baseUrl 发起出站请求（SSRF 面），
// 且用于设置页校验刚输入的 apiKey（改走 body，避免 key 进 URL/访问日志）。
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return unauthorized("Authentication required");
    }
    if (!requireAdmin(session)) {
        return forbidden("Admin access required");
    }

    try {
        const body: ModelsRequestBody = await req.json();
        const provider = body.provider;
        const apiKey = body.apiKey;
        const baseUrl = body.baseUrl;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'API key is required' },
                { status: 400 }
            );
        }

        let models: ModelInfo[] = [];

        if (provider === 'gemini') {
            const effectiveBaseUrl = baseUrl || 'https://generativelanguage.googleapis.com';
            models = await fetchGeminiModels(apiKey, effectiveBaseUrl);
        } else {
            // OpenAI-compatible
            const effectiveBaseUrl = baseUrl || 'https://api.openai.com/v1';
            models = await fetchOpenAIModels(apiKey, effectiveBaseUrl);
        }

        return NextResponse.json({ models });

    } catch (error) {
        logger.error({ error }, 'Error fetching models');
        return NextResponse.json(
            { error: 'Failed to fetch models from AI provider', models: [] },
            { status: 200 } // Return 200 with empty models to allow manual input
        );
    }
}
