# WhatsApp Reactions Handling

**Date**: 2026-03-18
**Status**: Approved

## Problem

When WhatsApp clients send reactions (long-press a message and pick an emoji), Evolution API sends a `reactionMessage` event. The webhook does not handle this message type, so reactions are stored as `message_type: "unknown"` with empty content. The conversation list shows `[media]` (misleading fallback), and nothing renders in the chat view.

Clients frequently use reactions (e.g., 👍) to confirm appointments. The bot needs this context to respond appropriately, and admins need to see reactions in the panel as they appear in WhatsApp Web.

## Solution

Handle `reactionMessage` as a normal message with contextual content referencing the original message. No database schema changes required.

## Data Flow

```
1. Client reacts 👍 to admin's reminder message
2. Evolution API fires MESSAGES.UPSERT with:
   - messageType: "reactionMessage"
   - message.reactionMessage.text: "👍"
   - message.reactionMessage.key.id: "<wa_message_id of reacted message>"
3. Webhook extracts reaction emoji + referenced message ID
4. Webhook queries DB for the referenced message's content (truncated to 50 chars)
5. Webhook inserts new whatsapp_message:
   - content: "Reaccionó 👍 a: \"Te recordamos que tu sesión es mañana...\""
   - message_type: "reactionMessage"
   - media_type: null
   - media_url: null
6. Conversation last_message updated to "👍"
7. Bot debounce fires normally → bot responds with context
```

### Reaction removal

When a client removes a reaction, Evolution API sends the same `reactionMessage` with `text: ""`. This should be silently ignored (no message inserted, no bot trigger).

## Changes by File

### 1. `src/lib/evolution-api.ts` — Add `extractReactionInfo`

New exported function:

```typescript
export interface ReactionInfo {
  emoji: string;
  reactedMessageId: string;
}

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
```

### 2. `src/app/api/whatsapp/webhook/route.ts` — Handle reactions

In `handleMessagesUpsert`, after extracting `rawMessage`:

1. Call `extractReactionInfo(rawMessage)` early
2. If it returns a reaction:
   - Skip `extractTextContent` and `extractMediaInfo` (reactions have neither)
   - Query the referenced message from DB by `wa_message_id` to get its content
   - Build content string: `Reaccionó {emoji} a: "{truncated original content}"`
   - If referenced message not found: `Reaccionó {emoji}`
   - Set `messageType = "reactionMessage"`
   - Insert message normally with this content
   - Update conversation `last_message` to the emoji only
   - Trigger bot debounce if bot is active
   - Save to N8N chat history for bot context
3. If no reaction, continue with existing flow unchanged

### 3. `src/components/whatsapp/MessageBubble.tsx` — Reaction bubble

When `message.message_type === "reactionMessage"`:

- Render a compact bubble with the emoji displayed large (text-2xl)
- Below it, show the reference text in small muted gray
- Parse the content to extract emoji and reference: split on `" a: "` pattern
- No delivery ticks (incoming client message)
- Uses the existing `client` sender config for alignment/styling

### 4. No changes required

- **Types** (`whatsapp.ts`): `content` is already `string`, `message_type` is already `string`
- **Database**: No new columns, no migration
- **ConversationItem**: `last_message` will contain the emoji, renders naturally
- **ChatPanel / page.tsx**: Messages flow through existing realtime subscriptions
- **N8N / Bot**: Receives reaction content as normal human message in chat history

## Edge Cases

1. **Reaction to message not in DB**: Content falls back to `Reaccionó {emoji}` (no reference)
2. **Reaction removal (empty emoji)**: Silently ignored, no message inserted
3. **Duplicate reaction webhook**: Handled by existing idempotency check on `wa_message_id`
4. **Reaction from admin (fromMe)**: Processed via the outgoing message path, stored for completeness
5. **Multiple reactions to same message**: Each is a separate `reactionMessage` with unique `wa_message_id`

## Testing

- Send a reaction from a test WhatsApp number
- Verify message appears in chat with emoji + reference
- Verify conversation list shows emoji as last message
- Verify bot responds when active
- Verify reaction removal is ignored
- Verify admin reactions (fromMe) are stored correctly
