/**
 * Evolution API v2.3.7 client helper
 *
 * All credentials are read server-side from environment variables.
 * This module must never be imported from client components.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

export interface SendMessageResult {
  messageId: string;
}

export interface MediaInfo {
  mediaType: MediaType | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  messageType: string | null;
}

export interface ReactionInfo {
  emoji: string;
  reactedMessageId: string;
}

/**
 * Extract reaction data from a raw WhatsApp message.
 * Returns null for non-reactions or reaction removals (empty emoji).
 *
 * Format sync: the content string built from this data in webhook/route.ts
 * is parsed by MessageBubble.tsx — keep both in sync.
 */
export function extractReactionInfo(
  message: Record<string, unknown>
): ReactionInfo | null {
  const reaction = message.reactionMessage;
  if (!reaction || typeof reaction !== 'object') return null;

  const r = reaction as Record<string, unknown>;
  const emoji = typeof r.text === 'string' ? r.text : '';
  if (!emoji) return null; // Empty = reaction removed, ignore

  const key = r.key as Record<string, unknown> | undefined;
  const reactedMessageId = typeof key?.id === 'string' ? key.id : '';

  return { emoji, reactedMessageId };
}

/**
 * Unwrap wrapper message types that nest the real message inside.
 * WhatsApp wraps messages in ephemeralMessage (disappearing chats),
 * viewOnceMessage/V2 (view-once photos/videos), and
 * documentWithCaptionMessage.
 *
 * Returns the inner message if wrapped, or the original message if not.
 */
export function unwrapMessage(
  message: Record<string, unknown>
): Record<string, unknown> {
  const wrapperKeys = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage',
  ];

  for (const key of wrapperKeys) {
    const wrapper = message[key];
    if (wrapper && typeof wrapper === 'object') {
      const inner = (wrapper as Record<string, unknown>).message;
      if (inner && typeof inner === 'object') {
        return inner as Record<string, unknown>;
      }
    }
  }

  return message;
}

// Shape returned by Evolution API for a sent message
interface EvolutionSendResponse {
  key?: {
    id?: string;
  };
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

/**
 * Thin wrapper around `fetch` that handles base URL, authentication header,
 * and Content-Type for every request to the Evolution API.
 */
async function evolutionFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = getEnv('EVOLUTION_API_URL').replace(/\/$/, '');
  const apiKey = getEnv('EVOLUTION_API_KEY');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: apiKey,
    ...(options.headers as Record<string, string> | undefined),
  };

  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(10000),
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a plain-text WhatsApp message.
 *
 * @param phone - Phone number in any format accepted by Evolution API
 *                (e.g. "56992533044" or "+56992533044").
 * @param text  - Message body.
 */
export async function sendTextMessage(
  phone: string,
  text: string
): Promise<SendMessageResult> {
  const instance = getEnv('EVOLUTION_INSTANCE_NAME');

  const response = await evolutionFetch(`/message/sendText/${instance}`, {
    method: 'POST',
    body: JSON.stringify({ number: phone, text }),
  });

  if (!response.ok) {
    throw new Error(
      `Evolution API sendText failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as EvolutionSendResponse;
  return { messageId: data?.key?.id ?? '' };
}

/**
 * Send a media message (image, video, audio, or document).
 *
 * @param phone     - Recipient phone number.
 * @param mediaUrl  - Publicly accessible URL of the media file.
 * @param mediaType - One of: 'image' | 'video' | 'audio' | 'document'.
 * @param caption   - Optional caption displayed below the media.
 */
export async function sendMediaMessage(
  phone: string,
  mediaUrl: string,
  mediaType: MediaType,
  caption?: string
): Promise<SendMessageResult> {
  const instance = getEnv('EVOLUTION_INSTANCE_NAME');

  const response = await evolutionFetch(`/message/sendMedia/${instance}`, {
    method: 'POST',
    body: JSON.stringify({
      number: phone,
      mediatype: mediaType,
      media: mediaUrl,
      caption: caption ?? '',
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Evolution API sendMedia failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as EvolutionSendResponse;
  return { messageId: data?.key?.id ?? '' };
}

// ---------------------------------------------------------------------------
// Message parsing utilities
// ---------------------------------------------------------------------------

/**
 * Extract the human-readable text content from a raw WhatsApp message object.
 * Handles plain text, extended text (links/replies), and media captions/filenames.
 *
 * Returns an empty string when no text content can be found.
 */
export function extractTextContent(
  message: Record<string, unknown>
): string {
  // Plain text message
  if (typeof message.conversation === 'string' && message.conversation) {
    return message.conversation;
  }

  // Extended text message (links, quoted replies)
  const extended = message.extendedTextMessage;
  if (
    extended !== null &&
    extended !== undefined &&
    typeof extended === 'object'
  ) {
    const text = (extended as Record<string, unknown>).text;
    if (typeof text === 'string' && text) {
      return text;
    }
  }

  // Image caption
  const imageMsg = message.imageMessage;
  if (
    imageMsg !== null &&
    imageMsg !== undefined &&
    typeof imageMsg === 'object'
  ) {
    const caption = (imageMsg as Record<string, unknown>).caption;
    if (typeof caption === 'string' && caption) {
      return caption;
    }
  }

  // Video caption
  const videoMsg = message.videoMessage;
  if (
    videoMsg !== null &&
    videoMsg !== undefined &&
    typeof videoMsg === 'object'
  ) {
    const caption = (videoMsg as Record<string, unknown>).caption;
    if (typeof caption === 'string' && caption) {
      return caption;
    }
  }

  // Document filename (useful for file identification)
  const docMsg = message.documentMessage;
  if (
    docMsg !== null &&
    docMsg !== undefined &&
    typeof docMsg === 'object'
  ) {
    const fileName = (docMsg as Record<string, unknown>).fileName;
    if (typeof fileName === 'string' && fileName) {
      return fileName;
    }
  }

  return '';
}

/**
 * Extract media metadata from a raw WhatsApp message object.
 *
 * Returns a `MediaInfo` object with all fields set to `null` when the message
 * contains no media.
 */
export function extractMediaInfo(
  message: Record<string, unknown>
): MediaInfo {
  const mediaChecks: Array<{ key: string; type: MediaType }> = [
    { key: 'imageMessage', type: 'image' },
    { key: 'videoMessage', type: 'video' },
    { key: 'audioMessage', type: 'audio' },
    { key: 'documentMessage', type: 'document' },
    { key: 'stickerMessage', type: 'sticker' },
  ];

  for (const { key, type } of mediaChecks) {
    const mediaMsg = message[key];
    if (
      mediaMsg !== null &&
      mediaMsg !== undefined &&
      typeof mediaMsg === 'object'
    ) {
      const msg = mediaMsg as Record<string, unknown>;
      const mediaUrl =
        typeof msg.url === 'string' ? msg.url : null;
      const mediaMimeType =
        typeof msg.mimetype === 'string' ? msg.mimetype : null;

      return {
        mediaType: type,
        mediaUrl,
        mediaMimeType,
        messageType: key,
      };
    }
  }

  return {
    mediaType: null,
    mediaUrl: null,
    mediaMimeType: null,
    messageType: null,
  };
}

// ---------------------------------------------------------------------------
// Media download
// ---------------------------------------------------------------------------

/**
 * Download media from Evolution API and upload to Supabase Storage.
 *
 * @returns The public URL of the uploaded file, or null on failure.
 */
export async function downloadAndStoreMedia(
  messageId: string,
  remoteJid: string,
  fromMe: boolean,
  conversationId: string,
  mediaType: string
): Promise<{ url: string; mimeType: string; dataUri: string } | null> {
  try {
    const instance = getEnv('EVOLUTION_INSTANCE_NAME');
    const response = await evolutionFetch(
      `/chat/getBase64FromMediaMessage/${instance}`,
      {
        method: 'POST',
        body: JSON.stringify({
          message: {
            key: { id: messageId, remoteJid, fromMe },
          },
        }),
        // Media downloads can be large — use 25s timeout instead of default 10s
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    const base64 = data.base64;
    if (typeof base64 !== 'string' || !base64) return null;

    const rawMime = (data.mimetype as string) ?? 'image/webp';
    const mimeType = rawMime.split(';')[0].trim();

    // Convert base64 to binary buffer
    const buffer = Buffer.from(base64, 'base64');

    // Determine file extension from mime type
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
      'video/mp4': 'mp4', 'video/3gpp': '3gp',
      'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
      'application/pdf': 'pdf',
    };
    const ext = extMap[mimeType] ?? 'bin';
    const filePath = `${conversationId}/${mediaType}/${messageId}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from('whatsapp-media')
      .upload(filePath, new Uint8Array(buffer), {
        contentType: mimeType,
        upsert: true,
      });

    const dataUri = `data:${mimeType};base64,${base64}`;

    if (error) {
      console.error('[Storage upload error]', error.message);
      // Fallback to base64 data URI when Storage is unavailable
      return { url: dataUri, mimeType, dataUri };
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('whatsapp-media')
      .getPublicUrl(filePath);

    return { url: urlData.publicUrl, mimeType, dataUri };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// JID utilities
// ---------------------------------------------------------------------------

/**
 * Convert a WhatsApp JID to an E.164-style phone number string.
 *
 * @example
 * parseJidToPhone('56992533044@s.whatsapp.net') // '+56992533044'
 * parseJidToPhone('56992533044@g.us')           // '+56992533044'
 */
/**
 * Fetch the profile picture URL for a WhatsApp contact.
 * Returns null if not available.
 */
export async function fetchProfilePicture(phone: string): Promise<string | null> {
  try {
    const instance = getEnv('EVOLUTION_INSTANCE_NAME');
    const response = await evolutionFetch(`/chat/fetchProfilePictureUrl/${instance}`, {
      method: 'POST',
      body: JSON.stringify({ number: phone.replace(/^\+/, '') }),
    });
    if (!response.ok) return null;
    const data = await response.json() as Record<string, unknown>;
    const url = data.profilePictureUrl ?? data.profilePicUrl ?? data.picture ?? null;
    return typeof url === 'string' ? url : null;
  } catch {
    return null;
  }
}

export function parseJidToPhone(jid: string): string {
  const [numberPart] = jid.split('@');
  return `+${numberPart}`;
}
