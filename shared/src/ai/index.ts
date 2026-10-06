import { AIService } from "./types";
import { GeminiProvider } from "./gemini-provider";
import { OpenAIProvider } from "./openai-provider";
import { AzureOpenAIProvider } from "./azure-provider";

export * from "./types";

import { getAppConfig, getActiveOpenAIConfig } from "../config";
import { createLogger } from "../logger";

const logger = createLogger('ai');

export function getAIService(): AIService {
    // Always get fresh config
    const config = getAppConfig();
    const provider = config.aiProvider;
    const timeoutMs = config.timeouts?.analyze;

    if (provider === "openai") {
        const activeConfig = getActiveOpenAIConfig();
        logger.info({ activeInstance: activeConfig?.name }, 'Using OpenAI Provider');
        return new OpenAIProvider({ ...activeConfig, timeoutMs });
    } else if (provider === "azure") {
        logger.info({ deployment: config.azure?.deploymentName }, 'Using Azure OpenAI Provider');
        return new AzureOpenAIProvider({ ...config.azure, timeoutMs });
    } else {
        logger.info('Using Gemini Provider');
        return new GeminiProvider({ ...config.gemini, timeoutMs });
    }
}

