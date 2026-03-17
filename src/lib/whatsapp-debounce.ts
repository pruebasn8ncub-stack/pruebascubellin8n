/**
 * Debounced bot reply processing.
 *
 * Finds conversations where clients sent messages more than DEBOUNCE_SECONDS ago
 * without a bot reply, batches them, and sends to N8N.
 * Platform-agnostic — uses only the database for coordination.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendTextMessage } from '@/lib/evolution-api';

const DEBOUNCE_SECONDS = parseInt(process.env.WHATSAPP_DEBOUNCE_SECONDS ?? '10', 10);

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

  return (Array.isArray(n8nData) ? n8nData[0]?.output : n8nData.output) ?? '';
}

export async function processPendingBotReplies(
  conversationId?: string,
  pendingTimestamp?: string
): Promise<number> {
  // Only process conversations where bot is active (not paused)
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

    // Gather client messages since the last bot/admin reply
    const { data: clientMsgs } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('content, media_type')
      .eq('conversation_id', conv.id)
      .eq('sender_type', 'client')
      .gt('created_at', sinceTime)
      .order('created_at', { ascending: true });

    const combinedContent = (clientMsgs ?? [])
      .map((m) => m.content || (m.media_type ? `[${m.media_type}]` : ''))
      .filter(Boolean)
      .join('\n');

    if (!combinedContent.trim()) continue;

    const sessionId = `wa_${conv.id}`;
    const phone = conv.phone_number;

    try {
      const botReply = await callN8nWebhook(
        `[Cliente]: ${combinedContent}`,
        sessionId,
        phone,
        conv.contact_name ?? phone
      );

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
      await supabaseAdmin.from('whatsapp_messages').insert({
        conversation_id: conv.id,
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

  return processed;
}
