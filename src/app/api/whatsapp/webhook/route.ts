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
  downloadAndStoreMedia,
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

  // Check if bot is globally paused — new conversations inherit that state
  const { data: botSettingsRow } = await supabaseAdmin
    .from('whatsapp_bot_settings')
    .select('global_pause')
    .limit(1)
    .single();
  const startPaused = (botSettingsRow as { global_pause: boolean } | null)?.global_pause ?? false;

  const avatarUrl = await fetchProfilePicture(phone);
  const { data: created, error } = await supabaseAdmin
    .from('whatsapp_conversations')
    .upsert(
      {
        jid,
        phone_number: phone,
        contact_name: contactName,
        contact_avatar_url: avatarUrl,
        is_bot_paused: startPaused,
      },
      { onConflict: 'jid', ignoreDuplicates: true }
    )
    .select('*')
    .single();

  if (error || !created) {
    // Race condition: another request created it first — fetch it
    const { data: raced } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('*')
      .eq('jid', jid)
      .single();
    if (raced) return raced as WhatsAppConversation;
    throw new Error(`Failed to create conversation for jid: ${jid}`);
  }

  return created as WhatsAppConversation;
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
// Media processing (audio transcription + image description)
// ---------------------------------------------------------------------------

async function transcribeAudio(mediaUrl: string): Promise<string | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    let audioBuffer: Buffer;
    if (mediaUrl.startsWith('data:')) {
      const base64Match = mediaUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (!base64Match) return null;
      audioBuffer = Buffer.from(base64Match[1], 'base64');
    } else {
      const res = await fetch(mediaUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      audioBuffer = Buffer.from(await res.arrayBuffer());
    }

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' }), 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) return null;

    const result = (await response.json()) as { text: string };
    return result.text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Generate a text description of an image for memory/context storage.
 * The chatbot sees the real image via multimodal — this is only for the chat history.
 */
async function describeImageForMemory(imageUrl: string, caption?: string): Promise<string | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: caption
                  ? `Describe esta imagen en 1-2 frases concisas. El usuario la envió con el mensaje: "${caption}".`
                  : 'Describe esta imagen en 1-2 frases concisas.',
              },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
            ],
          },
        ],
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const result = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return result.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
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
  const rawJid = typeof key.remoteJid === 'string' ? key.remoteJid : '';
  const remoteJidAlt = typeof key.remoteJidAlt === 'string' ? key.remoteJidAlt : '';
  const waMessageId = typeof key.id === 'string' ? key.id : '';
  const pushName = typeof data.pushName === 'string' ? data.pushName : undefined;
  const rawMessage =
    data.message !== null &&
    data.message !== undefined &&
    typeof data.message === 'object'
      ? (data.message as Record<string, unknown>)
      : {};

  // Ignore group messages
  if (rawJid.includes('@g.us')) return;

  // Use remoteJidAlt (real phone JID) when remoteJid is a LID (@lid format)
  const jid = rawJid.endsWith('@lid') && remoteJidAlt ? remoteJidAlt : rawJid;
  const phone = parseJidToPhone(jid);

  // Respect testing filter
  if (!isTestingAllowed(phone)) return;

  let content = extractTextContent(rawMessage);
  const mediaInfo = extractMediaInfo(rawMessage);
  const messageType =
    mediaInfo.messageType ?? (rawMessage.conversation !== undefined ? 'conversation' : 'unknown');

  // Only use pushName for incoming messages — for outgoing (fromMe), pushName is our own name
  const conversation = await findOrCreateConversation(jid, phone, fromMe ? undefined : pushName);

  const hasMedia = !!(mediaInfo.mediaType && waMessageId && jid);
  const botActive = !fromMe && !conversation.is_bot_paused;
  const debounceSeconds = parseInt(process.env.WHATSAPP_DEBOUNCE_SECONDS ?? '10', 10);
  const debounceUrl = process.env.N8N_DEBOUNCE_WEBHOOK_URL;

  // Helper: set pending timestamp and fire debounce timer
  async function setPendingAndFireDebounce(): Promise<string> {
    const ts = new Date().toISOString();
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({ bot_pending_since: ts })
      .eq('id', conversation.id);
    if (debounceUrl) {
      try {
        await fetch(debounceUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conversation.id,
            pendingTimestamp: ts,
            debounceSeconds,
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch { /* N8N unavailable */ }
    }
    return ts;
  }

  // ── Idempotency check BEFORE media processing (avoid wasting API calls) ──
  if (!fromMe && waMessageId) {
    const { data: existingIncoming } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('id')
      .eq('wa_message_id', waMessageId)
      .single();
    if (existingIncoming) return;
  }

  // ── Early debounce signal: invalidate any pending timers while media processes
  // This prevents the bot from responding to earlier text messages before this
  // media message (audio/image) finishes downloading and transcribing/describing.
  if (hasMedia && botActive) {
    await setPendingAndFireDebounce();
  }

  // Download media and upload to Supabase Storage (SLOW: 3-25 seconds)
  let mediaDataUri: string | null = null;
  if (hasMedia) {
    const stored = await downloadAndStoreMedia(waMessageId, rawJid, fromMe, conversation.id, mediaInfo.mediaType!);
    if (stored) {
      mediaInfo.mediaUrl = stored.url;
      mediaInfo.mediaMimeType = stored.mimeType;
      mediaDataUri = stored.dataUri;
    } else {
      // Don't store WhatsApp encrypted URLs — they're not browser-accessible
      mediaInfo.mediaUrl = null;
    }
  }

  // ── AI processing BEFORE insert so real-time gets full content (SLOW: 2-15 seconds)
  if (!fromMe && mediaInfo.mediaUrl) {
    if (mediaInfo.mediaType === 'audio' && !content) {
      const transcription = await transcribeAudio(mediaDataUri ?? mediaInfo.mediaUrl);
      if (transcription) {
        content = `[Audio transcrito]: ${transcription}`;
      }
    } else if (mediaInfo.mediaType === 'image') {
      // Generate description for memory/context — Gemini still sees the real image via multimodal
      const description = await describeImageForMemory(mediaDataUri ?? mediaInfo.mediaUrl, content || undefined);
      if (description) {
        content = content
          ? `${content}\n[Imagen: ${description}]`
          : `[Imagen: ${description}]`;
      }
    }
  }

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

    // If client replied, any outgoing messages still in 'sent' must have been delivered
    await supabaseAdmin
      .from('whatsapp_messages')
      .update({ status: 'delivered' })
      .eq('conversation_id', conversation.id)
      .eq('from_me', true)
      .eq('status', 'sent');

    // Update conversation metadata
    const conversationUpdate: Record<string, unknown> = {
      last_message: content || `[${mediaInfo.mediaType ?? 'media'}]`,
      last_message_at: new Date().toISOString(),
      last_message_from_me: false,
      last_message_sender_type: 'client',
    };
    if (pushName && pushName !== conversation.contact_name) {
      conversationUpdate.contact_name = pushName;
    }
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update(conversationUpdate)
      .eq('id', conversation.id);

    // ── Bot logic (with configurable debounce) ─────────────────────────────
    // Per-conversation toggle is the authority. Global pause only affects new conversations.
    if (botActive) {
      // Set pending timestamp and fire debounce — resets on each new message.
      // For media messages this is the SECOND fire (first was early, before processing).
      // The new timestamp invalidates the early timer, starting a fresh debounce cycle.
      await setPendingAndFireDebounce();
    }

    // Save client message to N8N memory when bot is paused
    // (when bot is active, N8N saves it via Postgres Chat Memory node)
    if (!botActive) {
      const sessionId = `wa_${conversation.id}`;
      const memoryContent = content || `[${mediaInfo.mediaType ?? 'media'}]`;
      await saveN8nChatHistory(sessionId, 'human', `[Cliente]: ${memoryContent}`);
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

    // Auto-pause bot and cancel pending debounce when human takes over
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({
        is_bot_paused: true,
        paused_by: null,
        paused_at: new Date().toISOString(),
        bot_pending_since: null,
        last_message: content || `[${mediaInfo.mediaType ?? 'media'}]`,
        last_message_at: new Date().toISOString(),
        last_message_from_me: true,
        last_message_sender_type: 'admin',
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
  // Evolution API v2 sends keyId directly, not nested in key.id
  const key = data.key as Record<string, unknown> | undefined;
  const waMessageId =
    (typeof data.keyId === 'string' ? data.keyId : '') ||
    (key && typeof key.id === 'string' ? key.id : '');

  // Status can be at data.status, data.update.status, or nested in key
  const update = data.update as Record<string, unknown> | undefined;
  const rawStatus = data.status ?? update?.status ?? update;

  if (!waMessageId || rawStatus === undefined) return;

  const mappedStatus = mapEvolutionStatus(rawStatus as string | number);
  if (!mappedStatus) return;

  // Try exact match first
  const { count } = await supabaseAdmin
    .from('whatsapp_messages')
    .update({ status: mappedStatus })
    .eq('wa_message_id', waMessageId);

  if (!count && waMessageId.length > 20) {
    // Evolution API status updates may use longer IDs than sendText returned.
    // Try matching the first 20 chars (the short ID we stored).
    await supabaseAdmin
      .from('whatsapp_messages')
      .update({ status: mappedStatus })
      .eq('wa_message_id', waMessageId.substring(0, 20));
  }
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
