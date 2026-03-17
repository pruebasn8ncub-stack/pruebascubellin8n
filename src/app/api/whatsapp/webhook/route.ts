/**
 * POST /api/whatsapp/webhook
 *
 * Receives Evolution API webhook events for incoming/outgoing WhatsApp messages
 * and status updates. No user auth — validated by secret query param.
 *
 * Always returns 200 so Evolution API never retries on application errors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  extractTextContent,
  extractMediaInfo,
  parseJidToPhone,
  sendTextMessage,
  fetchProfilePicture,
} from '@/lib/evolution-api';
import type { WhatsAppConversation, WhatsAppBotSettings } from '@/types/whatsapp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(message: string = 'ok'): NextResponse {
  return NextResponse.json({ message }, { status: 200 });
}

function isTestingAllowed(phone: string): boolean {
  const raw = process.env.WHATSAPP_TESTING_NUMBERS ?? '';
  if (!raw.trim()) return true; // Empty = allow all

  const allowed = raw
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  // Normalize both sides: strip leading '+' for comparison
  const normalized = phone.replace(/^\+/, '');
  return allowed.some((n) => n.replace(/^\+/, '') === normalized);
}

async function findOrCreateConversation(
  jid: string,
  phone: string,
  pushName?: string
): Promise<WhatsAppConversation> {
  const { data: existing } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('*')
    .eq('jid', jid)
    .single();

  if (existing) {
    // Update avatar if missing
    if (!existing.contact_avatar_url) {
      const avatarUrl = await fetchProfilePicture(phone);
      if (avatarUrl) {
        await supabaseAdmin
          .from('whatsapp_conversations')
          .update({ contact_avatar_url: avatarUrl })
          .eq('id', existing.id);
        existing.contact_avatar_url = avatarUrl;
      }
    }
    // Update contact name if pushName is available and different
    if (pushName && pushName !== existing.contact_name) {
      await supabaseAdmin
        .from('whatsapp_conversations')
        .update({ contact_name: pushName })
        .eq('id', existing.id);
      existing.contact_name = pushName;
    }
    return existing as WhatsAppConversation;
  }

  const contactName = pushName || phone;
  const avatarUrl = await fetchProfilePicture(phone);
  const { data: created, error } = await supabaseAdmin
    .from('whatsapp_conversations')
    .insert({
      jid,
      phone_number: phone,
      contact_name: contactName,
      contact_avatar_url: avatarUrl,
    })
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(`Failed to create conversation for jid: ${jid}`);
  }

  return created as WhatsAppConversation;
}

async function callN8nWebhook(
  content: string,
  sessionId: string,
  senderPhone: string,
  senderName: string
): Promise<string> {
  const n8nUrl = process.env.N8N_WHATSAPP_WEBHOOK_URL;
  if (!n8nUrl) throw new Error('N8N_WHATSAPP_WEBHOOK_URL is not configured');

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, sessionId, senderPhone, senderName }),
    signal: AbortSignal.timeout(90000),
  });

  const n8nData = (await response.json()) as
    | { output?: string }
    | Array<{ output?: string }>;

  const botReply =
    (Array.isArray(n8nData)
      ? n8nData[0]?.output
      : n8nData.output) ?? '';

  return botReply;
}

async function saveN8nChatHistory(
  sessionId: string,
  role: 'human' | 'ai',
  content: string
): Promise<void> {
  await supabaseAdmin.from('n8n_chat_histories').insert({
    session_id: sessionId,
    message: { type: role, data: { content } },
  });
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

function mapEvolutionStatus(
  status: string | number
): 'delivered' | 'read' | null {
  // Handle numeric status codes
  const s = Number(status);
  if (s === 3) return 'delivered';
  if (s === 4 || s === 5) return 'read';

  // Handle string status labels from Evolution API
  if (typeof status === 'string') {
    const upper = status.toUpperCase();
    if (upper === 'DELIVERY_ACK' || upper === 'DELIVERED') return 'delivered';
    if (upper === 'READ' || upper === 'PLAYED') return 'read';
    if (upper === 'SERVER_ACK' || upper === 'SENT') return null; // already saved as 'sent'
  }

  return null;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleMessagesUpsert(
  data: Record<string, unknown>
): Promise<void> {
  const key = data.key as Record<string, unknown> | undefined;
  if (!key) return;

  const fromMe = Boolean(key.fromMe);
  const jid = typeof key.remoteJid === 'string' ? key.remoteJid : '';
  const waMessageId = typeof key.id === 'string' ? key.id : '';
  const pushName = typeof data.pushName === 'string' ? data.pushName : undefined;
  const rawMessage =
    data.message !== null &&
    data.message !== undefined &&
    typeof data.message === 'object'
      ? (data.message as Record<string, unknown>)
      : {};

  // Ignore group messages
  if (jid.includes('@g.us')) return;

  const phone = parseJidToPhone(jid);

  // Respect testing filter
  if (!isTestingAllowed(phone)) return;

  const content = extractTextContent(rawMessage);
  const mediaInfo = extractMediaInfo(rawMessage);
  const messageType =
    mediaInfo.messageType ?? (rawMessage.conversation !== undefined ? 'conversation' : 'unknown');

  const conversation = await findOrCreateConversation(jid, phone, pushName);

  if (!fromMe) {
    // ── Incoming client message ──────────────────────────────────────────────
    await supabaseAdmin.from('whatsapp_messages').insert({
      conversation_id: conversation.id,
      wa_message_id: waMessageId,
      sender_type: 'client',
      sender_id: null,
      content,
      media_type: mediaInfo.mediaType,
      media_url: mediaInfo.mediaUrl,
      media_mime_type: mediaInfo.mediaMimeType,
      message_type: messageType,
      status: 'delivered',
      from_me: false,
    });

    // Increment unread counter
    await supabaseAdmin.rpc('increment_unread', { conv_id: conversation.id });

    // Update conversation metadata
    const conversationUpdate: Record<string, unknown> = {
      last_message: content || `[${mediaInfo.mediaType ?? 'media'}]`,
      last_message_at: new Date().toISOString(),
    };
    if (pushName && pushName !== conversation.contact_name) {
      conversationUpdate.contact_name = pushName;
    }
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update(conversationUpdate)
      .eq('id', conversation.id);

    // ── Bot logic ────────────────────────────────────────────────────────────
    const { data: botSettingsRow } = await supabaseAdmin
      .from('whatsapp_bot_settings')
      .select('global_pause')
      .limit(1)
      .single();

    const botSettings = botSettingsRow as Pick<WhatsAppBotSettings, 'global_pause'> | null;
    const globallyPaused = botSettings?.global_pause ?? false;
    const conversationPaused = conversation.is_bot_paused;

    if (!globallyPaused && !conversationPaused) {
      const sessionId = `wa_${conversation.id}`;
      try {
        const botReply = await callN8nWebhook(
          content,
          sessionId,
          phone,
          pushName ?? phone
        );

        if (botReply) {
          const sendResult = await sendTextMessage(phone, botReply);

          await supabaseAdmin.from('whatsapp_messages').insert({
            conversation_id: conversation.id,
            wa_message_id: sendResult.messageId,
            sender_type: 'bot',
            sender_id: null,
            content: botReply,
            media_type: null,
            media_url: null,
            media_mime_type: null,
            message_type: 'conversation',
            status: 'delivered',
            from_me: true,
          });

          await supabaseAdmin
            .from('whatsapp_conversations')
            .update({ last_message: botReply, last_message_at: new Date().toISOString() })
            .eq('id', conversation.id);
        }
      } catch {
        // Save failed bot message without sending to client
        await supabaseAdmin.from('whatsapp_messages').insert({
          conversation_id: conversation.id,
          wa_message_id: `failed_${Date.now()}`,
          sender_type: 'bot',
          sender_id: null,
          content: '',
          media_type: null,
          media_url: null,
          media_mime_type: null,
          message_type: 'conversation',
          status: 'failed',
          from_me: true,
        });
      }
    }
  } else {
    // ── Outgoing message (fromMe = true) ─────────────────────────────────────
    const { data: existingMsg } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('id')
      .eq('wa_message_id', waMessageId)
      .single();

    if (existingMsg) {
      // Already saved by bot/panel — skip
      return;
    }

    // Admin sent from WhatsApp Web or App
    await supabaseAdmin.from('whatsapp_messages').insert({
      conversation_id: conversation.id,
      wa_message_id: waMessageId,
      sender_type: 'admin',
      sender_id: null,
      content,
      media_type: mediaInfo.mediaType,
      media_url: mediaInfo.mediaUrl,
      media_mime_type: mediaInfo.mediaMimeType,
      message_type: messageType,
      status: 'sent',
      from_me: true,
    });

    // Auto-pause bot when human takes over
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({
        is_bot_paused: true,
        paused_by: null,
        paused_at: new Date().toISOString(),
        last_message: content || `[${mediaInfo.mediaType ?? 'media'}]`,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversation.id);

    // Sync to N8N memory so the bot knows a human replied
    const sessionId = `wa_${conversation.id}`;
    await saveN8nChatHistory(
      sessionId,
      'human',
      `[Agente Humano]: ${content}`
    );
  }
}

async function handleMessagesUpdate(
  data: Record<string, unknown>
): Promise<void> {
  const key = data.key as Record<string, unknown> | undefined;
  if (!key) return;

  const waMessageId = typeof key.id === 'string' ? key.id : '';

  // Status can be in data.status, data.update.status, or data.update
  const update = data.update as Record<string, unknown> | undefined;
  const rawStatus = data.status ?? update?.status ?? update;

  if (!waMessageId || rawStatus === undefined) return;

  const mappedStatus = mapEvolutionStatus(rawStatus as string | number);
  if (!mappedStatus) return;

  await supabaseAdmin
    .from('whatsapp_messages')
    .update({ status: mappedStatus })
    .eq('wa_message_id', waMessageId);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Secret validation
    const secret = request.nextUrl.searchParams.get('secret');
    const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const event = typeof body.event === 'string' ? body.event : '';
    const data =
      body.data !== null &&
      body.data !== undefined &&
      typeof body.data === 'object'
        ? (body.data as Record<string, unknown>)
        : {};

    const normalizedEvent = event.toUpperCase();

    if (normalizedEvent === 'MESSAGES.UPSERT' || normalizedEvent === 'MESSAGES_UPSERT') {
      await handleMessagesUpsert(data);
    } else if (normalizedEvent === 'MESSAGES.UPDATE' || normalizedEvent === 'MESSAGES_UPDATE') {
      await handleMessagesUpdate(data);
    }

    return ok();
  } catch {
    // Always return 200 so Evolution API does not retry
    return ok();
  }
}
