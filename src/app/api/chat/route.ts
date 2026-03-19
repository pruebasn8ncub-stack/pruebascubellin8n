import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const chatSchema = z.object({
    message: z.string().min(1).max(2000),
    sessionId: z.string().min(1).max(100),
});

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // requests
const RATE_WINDOW = 60_000; // 1 minuto

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
        return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT;
}

export async function POST(request: NextRequest) {
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown";

    if (isRateLimited(ip)) {
        return NextResponse.json(
            { error: "Demasiadas solicitudes. Intenta en un momento." },
            { status: 429 }
        );
    }

    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    if (!N8N_WEBHOOK_URL) {
        return NextResponse.json(
            { error: "Service unavailable" },
            { status: 503 }
        );
    }

    try {
        const body = await request.json();
        const parsed = chatSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Missing 'message' and/or 'sessionId'" },
                { status: 400 }
            );
        }

        const { message, sessionId } = parsed.data;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout

        const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chatInput: message,
                sessionId,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();
            console.error("[Chat API] n8n error:", n8nResponse.status, errorText);
            return NextResponse.json(
                { error: "Error procesando tu mensaje. Intenta de nuevo." },
                { status: 502 }
            );
        }

        // The Respond to Webhook node returns the AI Agent's output
        const data = await n8nResponse.json();

        // Extract the bot's response text - the Respond to Webhook node
        // typically returns the last node's output
        const botResponse =
            data?.output ||
            data?.text ||
            data?.response ||
            data?.message ||
            (typeof data === "string" ? data : JSON.stringify(data));

        return NextResponse.json({ response: botResponse });
    } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
            console.error("[Chat API] Request timed out");
            return NextResponse.json(
                { error: "El asistente tardó demasiado en responder. Intenta de nuevo." },
                { status: 504 }
            );
        }

        console.error(
            "[Chat API] Unexpected error:",
            error instanceof Error ? error.message : "Unknown error"
        );
        return NextResponse.json(
            { error: "Error interno del servidor." },
            { status: 500 }
        );
    }
}
