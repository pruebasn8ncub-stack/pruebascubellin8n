/**
 * GET /api/whatsapp/process-pending
 *
 * Processes debounced bot replies. Called by N8N after a 10s wait.
 * Can process a specific conversation (via query params) or all pending.
 * Protected by webhook secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processPendingBotReplies } from '@/lib/whatsapp-debounce';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const conversationId = request.nextUrl.searchParams.get('conversationId') ?? undefined;
  const pendingTimestamp = request.nextUrl.searchParams.get('pendingTimestamp') ?? undefined;

  try {
    const processed = await processPendingBotReplies(conversationId, pendingTimestamp);
    return NextResponse.json({ processed }, { status: 200 });
  } catch {
    return NextResponse.json({ processed: 0, error: true }, { status: 200 });
  }
}
