/**
 * Debounced bot reply processing.
 *
 * Finds conversations where clients sent messages more than DEBOUNCE_SECONDS ago
 * without a bot reply, batches them, and sends to N8N.
 * Platform-agnostic — uses only the database for coordination.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendTextMessage } from '@/lib/evolution-api';

const rawDebounce = parseInt(process.env.WHATSAPP_DEBOUNCE_SECONDS ?? '10', 10);
const DEBOUNCE_SECONDS = Number.isNaN(rawDebounce) ? 10 : Math.max(1, Math.min(300, rawDebounce));

interface N8nPayload {
  content: string;
  sessionId: string;
  senderPhone: string;
  senderName: string;
  images?: Array<{ base64: string; mimeType: string }>;
}

async function callN8nWebhook(payload: N8nPayload): Promise<string> {
  const n8nUrl = process.env.N8N_WHATSAPP_WEBHOOK_URL;
  if (!n8nUrl) throw new Error('N8N_WHATSAPP_WEBHOOK_URL is not configured');

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90000),
  });

  const n8nData = (await response.json()) as
    | { output?: string }
    | Array<{ output?: string }>;

  return (Array.isArray(n8nData) ? n8nData[0]?.output : n8nData.output) ?? '';
}

/**
 * Fetch image as base64 from a Storage URL or return existing data URI.
 */
async function fetchImageBase64(mediaUrl: string, mimeType: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    if (mediaUrl.startsWith('data:')) {
      const match = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) return { base64: match[2], mimeType: match[1] };
      return null;
    }

    const res = await fetch(mediaUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return { base64, mimeType };
  } catch {
    return null;
  }
}

export async function processPendingBotReplies(
  conversationId?: string,
  pendingTimestamp?: string
): Promise<number> {
  // Only process conversations where bot is active per-conversation
  // Global pause only affects new conversations, not individually-activated ones
  let query = supabaseAdmin
    .from('whatsapp_conversations')
    .select('id, phone_number, contact_name, jid, bot_pending_since')
    .not('bot_pending_since', 'is', null)
    .eq('is_bot_paused', false);

  if (conversationId && pendingTimestamp) {
    query = query.eq('id', conversationId).eq('bot_pending_since', pendingTimestamp);
  } else {
    const cutoff = new Date(Date.now() - DEBOUNCE_SECONDS * 1000).toISOString();
    query = query.lt('bot_pending_since', cutoff);
  }

  const { data: pendingConvs } = await query;

  // Clean up pending flags on paused conversations (admin took over)
  await supabaseAdmin
    .from('whatsapp_conversations')
    .update({ bot_pending_since: null })
    .not('bot_pending_since', 'is', null)
    .eq('is_bot_paused', true);

  if (!pendingConvs || pendingConvs.length === 0) return 0;

  let processed = 0;

  for (const conv of pendingConvs) {
    // Clear pending flag immediately to prevent double processing
    const { data: cleared } = await supabaseAdmin
      .from('whatsapp_conversations')
      .update({ bot_pending_since: null })
      .eq('id', conv.id)
      .eq('bot_pending_since', conv.bot_pending_since)
      .select('id');

    // If no rows updated, another process already cleared it
    if (!cleared || cleared.length === 0) continue;

    // Get the last outgoing message (bot or admin) timestamp
    const { data: lastOutgoing } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('created_at')
      .eq('conversation_id', conv.id)
      .eq('from_me', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const sinceTime = lastOutgoing?.created_at ?? '1970-01-01T00:00:00Z';

    // Gather client messages since the last bot/admin reply (include media_url and mime)
    const { data: clientMsgs } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('content, media_type, media_url, media_mime_type')
      .eq('conversation_id', conv.id)
      .eq('sender_type', 'client')
      .gt('created_at', sinceTime)
      .order('created_at', { ascending: true });

    // Build text content (skip image description prefixes — Gemini will see the image directly)
    const textParts: string[] = [];
    const imageMessages: Array<{ url: string; mime: string }> = [];

    for (const m of clientMsgs ?? []) {
      if (m.media_type === 'image' && m.media_url) {
        imageMessages.push({ url: m.media_url, mime: m.media_mime_type ?? 'image/jpeg' });
        // Only add caption text (not AI description)
        if (m.content && !m.content.startsWith('[Imagen adjunta') && !m.content.startsWith('[Foto del cliente')) {
          textParts.push(m.content);
        } else if (!m.content) {
          textParts.push('[El paciente envió una foto]');
        }
      } else if (m.content) {
        textParts.push(m.content);
      } else if (m.media_type) {
        textParts.push(`[El paciente envió un ${m.media_type}]`);
      }
    }

    const combinedContent = textParts.filter(Boolean).join('\n');
    if (!combinedContent.trim() && imageMessages.length === 0) continue;

    const sessionId = `wa_${conv.id}`;
    const phone = conv.phone_number;

    // Fetch image base64 data for Gemini vision
    const images: Array<{ base64: string; mimeType: string }> = [];
    for (const img of imageMessages) {
      const imgData = await fetchImageBase64(img.url, img.mime);
      if (imgData) images.push(imgData);
    }

    try {
      const botReply = await callN8nWebhook({
        content: combinedContent || '[El paciente envió una foto]',
        sessionId,
        senderPhone: phone,
        senderName: conv.contact_name ?? phone,
        ...(images.length > 0 ? { images } : {}),
      });

      if (botReply) {
        const sendResult = await sendTextMessage(phone, botReply);

        await supabaseAdmin.from('whatsapp_messages').insert({
          conversation_id: conv.id,
          wa_message_id: sendResult.messageId,
          sender_type: 'bot',
          sender_id: null,
          content: botReply,
          media_type: null,
          media_url: null,
          media_mime_type: null,
          message_type: 'conversation',
          status: 'sent',
          from_me: true,
        });

        await supabaseAdmin
          .from('whatsapp_conversations')
          .update({
            last_message: botReply,
            last_message_at: new Date().toISOString(),
            last_message_from_me: true,
            last_message_sender_type: 'bot',
          })
          .eq('id', conv.id);

        processed++;
      }
    } catch {
      const failId = `failed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await supabaseAdmin.from('whatsapp_messages').insert({
        conversation_id: conv.id,
        wa_message_id: failId,
        sender_type: 'bot',
        sender_id: null,
        content: '[Error: el bot no pudo responder]',
        media_type: null,
        media_url: null,
        media_mime_type: null,
        message_type: 'conversation',
        status: 'failed',
        from_me: true,
      });

      // Update conversation metadata so the list reflects the error
      await supabaseAdmin
        .from('whatsapp_conversations')
        .update({
          last_message: '[Error: el bot no pudo responder]',
          last_message_at: new Date().toISOString(),
          last_message_from_me: true,
          last_message_sender_type: 'bot',
        })
        .eq('id', conv.id);
    }
  }

  return processed;
}
