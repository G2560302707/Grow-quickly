import { AIService } from "./types";
import { GeminiProvider } from "./gemini-provider";
import { OpenAIProvider } from "./openai-provider";

export * from "./types";

import { getAppConfig } from "../config";
import { createLogger } from "../logger";

const logger = createLogger('ai');

export function getAIService(): AIService {
    // Always get fresh config
    const config = getAppConfig();
    const provider = config.aiProvider;

    if (provider === "openai") {
        logger.info('Using OpenAI Provider');
        return new OpenAIProvider(config.openai);
    } else {
        logger.info('Using Gemini Provider');
        return new GeminiProvider(config.gemini);
    }
}
