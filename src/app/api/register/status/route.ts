import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";

export async function GET() {
    const config = getAppConfig();
    return NextResponse.json({
        allowRegistration: config.allowRegistration !== false
    });
}
