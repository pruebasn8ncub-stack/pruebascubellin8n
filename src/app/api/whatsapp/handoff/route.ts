/**
 * POST /api/whatsapp/handoff
 *
 * Called by the N8N bot tool when it decides the conversation needs human attention.
 * Marks the conversation as needs_human, notifies the admin via WhatsApp and email.
 * The bot continues responding — it does NOT pause itself.
 * Protected by webhook secret (same as process-pending).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendTextMessage } from '@/lib/evolution-api';

const ADMIN_PHONE = process.env.WHATSAPP_ADMIN_PHONE;

function toString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '';
  return JSON.stringify(v);
}

function extractFields(raw: unknown): { senderPhone: string; reason: string; summary: string } {
  // Default values
  let senderPhone = '';
  let reason = '';
  let summary = '';

  // Handle double-encoded string
  let obj = raw;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj) as unknown; } catch { return { senderPhone, reason, summary: obj as string }; }
  }

  if (typeof obj !== 'object' || obj === null) {
    return { senderPhone, reason, summary: toString(obj) };
  }

  const o = obj as Record<string, unknown>;

  // Check if wrapped in body: { body: { actual fields } }
  if (o.body && typeof o.body === 'object' && !o.senderPhone) {
    const inner = o.body as Record<string, unknown>;
    senderPhone = toString(inner.senderPhone);
    reason = toString(inner.reason);
    summary = toString(inner.summary);
  } else {
    senderPhone = toString(o.senderPhone);
    reason = toString(o.reason);
    summary = toString(o.summary);
  }

  return { senderPhone, reason, summary };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret =
    request.headers.get('x-webhook-secret') ||
    request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (!ADMIN_PHONE) {
    console.error('[Handoff] Missing WHATSAPP_ADMIN_PHONE env var');
    return NextResponse.json(
      { success: false, error: 'Service configuration error' },
      { status: 503 }
    );
  }

  const adminPhone: string = ADMIN_PHONE;

  try {
    const raw = await request.json();
    const { senderPhone, reason, summary } = extractFields(raw);

    if (!senderPhone || senderPhone.length < 5) {
      return NextResponse.json({ success: false, error: 'Missing senderPhone' }, { status: 400 });
    }

    const cleanPhone = senderPhone.replace(/[^0-9]/g, '');
    // The AI now composes a natural, context-aware notification.
    // `summary` is the full notification body; `reason` is a short version for the DB.
    const finalReason = reason || 'Atencion humana solicitada';
    const finalSummary = summary || reason || 'El paciente solicita atencion del equipo humano.';

    // Find conversation
    const { data: conv } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, contact_name, phone_number')
      .eq('phone_number', cleanPhone)
      .single();

    const { data: conv2 } = !conv
      ? await supabaseAdmin
          .from('whatsapp_conversations')
          .select('id, contact_name, phone_number')
          .eq('phone_number', `+${cleanPhone}`)
          .single()
      : { data: null };

    const conversation = conv || conv2;
    if (!conversation) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
    }

    // 1. Mark as needs_human
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({
        needs_human: true,
        needs_human_since: new Date().toISOString(),
        needs_human_reason: finalSummary,
        needs_human_status: 'pending',
      })
      .eq('id', conversation.id);

    // 2. Send WhatsApp notification with the AI-composed message
    const displayName = (conversation.contact_name && conversation.contact_name !== '.')
      ? conversation.contact_name
      : conversation.phone_number;
    const showPhone = displayName !== conversation.phone_number ? ` (${conversation.phone_number})` : '';

    const whatsappMsg = `\u{1F6A8} *ATENCION REQUERIDA*\nPaciente: *${displayName}*${showPhone}\n\n${finalSummary}`;

    try {
      await sendTextMessage(adminPhone, whatsappMsg);
    } catch {
      // Don't fail if notification fails
    }

    return NextResponse.json({ success: true, conversationId: conversation.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
