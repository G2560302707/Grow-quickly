import { AIService } from "./types";
import { GeminiProvider } from "./gemini-provider";
import { OpenAIProvider } from "./openai-provider";

export * from "./types";

import { getAppConfig } from "../config";

export function getAIService(): AIService {
    // Always get fresh config
    const config = getAppConfig();
    const provider = config.aiProvider;

    if (provider === "openai") {
        console.log("Using OpenAI Provider");
        return new OpenAIProvider(config.openai);
    } else {
        console.log("Using Gemini Provider");
        return new GeminiProvider(config.gemini);
    }
}
