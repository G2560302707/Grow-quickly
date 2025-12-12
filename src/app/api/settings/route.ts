import { NextResponse } from "next/server";
import { getAppConfig, updateAppConfig } from "@/lib/config";
import { internalError } from "@/lib/api-errors";

export async function GET() {
    const config = getAppConfig();
    // Return full config including API keys since this is an authenticated endpoint
    return NextResponse.json(config);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Don't save masked keys if they somehow get sent back
        if (body.openai?.apiKey === '********') delete body.openai.apiKey;
        if (body.gemini?.apiKey === '********') delete body.gemini.apiKey;

        const updatedConfig = updateAppConfig(body);
        return NextResponse.json(updatedConfig);
    } catch (error) {
        console.error("Failed to update settings:", error);
        return internalError("Failed to update settings");
    }
}
