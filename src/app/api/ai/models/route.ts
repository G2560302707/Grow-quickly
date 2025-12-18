import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:ai:models');

interface ModelInfo {
    id: string;
    name: string;
    owned_by?: string;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const provider = searchParams.get('provider');
        const apiKey = searchParams.get('apiKey');
        const baseUrl = searchParams.get('baseUrl');

        if (!apiKey) {
            return NextResponse.json(
                { error: 'API key is required' },
                { status: 400 }
            );
        }

        // Only OpenAI-compatible APIs support /v1/models
        if (provider !== 'openai') {
            return NextResponse.json(
                {
                    error: 'Gemini原生API不支持模型列表功能。如果您使用OpenAI兼容的代理服务，请选择"OpenAI / Compatible"作为提供商。',
                    models: []
                },
                { status: 200 } // Return 200 with empty models instead of 400
            );
        }

        const url = `${baseUrl || 'https://api.openai.com/v1'}/models`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            logger.error({ statusText: response.statusText }, 'Failed to fetch models');
            return NextResponse.json(
                { error: 'Failed to fetch models from API' },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Filter for vision-capable models
        // Common patterns: gpt-4-vision, gpt-4o, gpt-4-turbo, gemini-*-vision, claude-*-vision
        const visionModels = (data.data || [])
            .filter((model: any) => {
                const id = model.id.toLowerCase();
                return (
                    id.includes('vision') ||
                    id.includes('gpt-4o') ||
                    id.includes('gpt-4-turbo') ||
                    id.includes('gemini') ||
                    id.includes('claude-3') ||
                    id.includes('glm-4v')
                );
            })
            .map((model: any) => ({
                id: model.id,
                name: model.id,
                owned_by: model.owned_by,
            }));

        return NextResponse.json({ models: visionModels });

    } catch (error) {
        logger.error({ error }, 'Error fetching models');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
