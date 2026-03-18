import { describe, it, expect, vi } from 'vitest';

// Mock supabase-admin to avoid env var requirements at module load time
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }));

import { extractReactionInfo, unwrapMessage, extractMediaInfo } from '@/lib/evolution-api';

describe('unwrapMessage', () => {
  it('unwraps ephemeralMessage', () => {
    const message = {
      ephemeralMessage: {
        message: {
          stickerMessage: { url: 'https://...', mimetype: 'image/webp' },
        },
      },
      messageContextInfo: {},
    };
    const unwrapped = unwrapMessage(message);
    expect(unwrapped).toHaveProperty('stickerMessage');
  });

  it('unwraps viewOnceMessage', () => {
    const message = {
      viewOnceMessage: {
        message: {
          imageMessage: { url: 'https://...', mimetype: 'image/jpeg' },
        },
      },
    };
    const unwrapped = unwrapMessage(message);
    expect(unwrapped).toHaveProperty('imageMessage');
  });

  it('unwraps viewOnceMessageV2', () => {
    const message = {
      viewOnceMessageV2: {
        message: {
          videoMessage: { url: 'https://...', mimetype: 'video/mp4' },
        },
      },
    };
    const unwrapped = unwrapMessage(message);
    expect(unwrapped).toHaveProperty('videoMessage');
  });

  it('returns original message when not wrapped', () => {
    const message = {
      imageMessage: { url: 'https://...', mimetype: 'image/jpeg' },
    };
    expect(unwrapMessage(message)).toBe(message);
  });

  it('returns original when wrapper has no inner message', () => {
    const message = {
      ephemeralMessage: { someOtherField: true },
    };
    expect(unwrapMessage(message)).toBe(message);
  });

  it('works end-to-end with extractMediaInfo for ephemeral sticker', () => {
    const message = {
      ephemeralMessage: {
        message: {
          stickerMessage: { url: 'https://sticker.url', mimetype: 'image/webp' },
        },
      },
    };
    const unwrapped = unwrapMessage(message);
    const media = extractMediaInfo(unwrapped);
    expect(media.mediaType).toBe('sticker');
    expect(media.messageType).toBe('stickerMessage');
  });
});

describe('extractReactionInfo', () => {
  it('extracts emoji and referenced message ID from a reaction', () => {
    const message = {
      reactionMessage: {
        key: { id: 'ABC123', fromMe: true, remoteJid: '123@lid' },
        text: '👍',
        senderTimestampMs: { low: 123, high: 0 },
      },
      messageContextInfo: {},
    };
    const result = extractReactionInfo(message);
    expect(result).toEqual({ emoji: '👍', reactedMessageId: 'ABC123' });
  });

  it('returns null for reaction removal (empty text)', () => {
    const message = {
      reactionMessage: {
        key: { id: 'ABC123', fromMe: true, remoteJid: '123@lid' },
        text: '',
      },
    };
    expect(extractReactionInfo(message)).toBeNull();
  });

  it('returns null for non-reaction messages', () => {
    const message = { conversation: 'hello' };
    expect(extractReactionInfo(message)).toBeNull();
  });

  it('handles missing key gracefully', () => {
    const message = {
      reactionMessage: { text: '❤️' },
    };
    const result = extractReactionInfo(message);
    expect(result).toEqual({ emoji: '❤️', reactedMessageId: '' });
  });

  it('handles skin tone emoji variants', () => {
    const message = {
      reactionMessage: {
        key: { id: 'DEF456' },
        text: '👍🏻',
      },
    };
    const result = extractReactionInfo(message);
    expect(result).toEqual({ emoji: '👍🏻', reactedMessageId: 'DEF456' });
  });
});
