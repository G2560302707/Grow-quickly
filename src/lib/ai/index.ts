import { AIService } from "./types";
import { GeminiProvider } from "./gemini-provider";
import { OpenAIProvider } from "./openai-provider";

export * from "./types";

let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
    if (aiServiceInstance) {
        return aiServiceInstance;
    }

    const provider = process.env.AI_PROVIDER || "gemini";

    if (provider === "openai") {
        console.log("Using OpenAI Provider");
        aiServiceInstance = new OpenAIProvider();
    } else {
        console.log("Using Gemini Provider");
        aiServiceInstance = new GeminiProvider();
    }

    return aiServiceInstance;
}
