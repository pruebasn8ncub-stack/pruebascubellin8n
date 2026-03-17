# WhatsApp Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WhatsApp admin panel at `/admin/whatsapp` that replaces Chatwoot — with conversation monitoring, message sending, and bot pause/play controls.

**Architecture:** Next.js API routes receive Evolution API webhooks and store everything in Supabase. The panel reads from Supabase with Realtime subscriptions. N8N is called only to generate AI responses. Bot state lives in Supabase as the single source of truth.

**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL + Realtime + Storage), Evolution API v2.3.7, N8N, TypeScript, Tailwind CSS, Lucide React, Zod.

**Spec:** `docs/superpowers/specs/2026-03-16-whatsapp-admin-panel-design.md`

---

## Chunk 1: Foundation — Types, Env, Supabase Admin Client, DB Schema

### Task 1: TypeScript types

**Files:**
- Create: `src/types/whatsapp.ts`

- [ ] **Step 1: Create WhatsApp types file**

```typescript
// src/types/whatsapp.ts

export type SenderType = 'client' | 'bot' | 'admin' | 'system';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MediaType = 'image' | 'video' | 'audio' | 'document';

export interface WhatsAppConversation {
  id: string;
  jid: string;
  phone_number: string;
  contact_name: string;
  contact_avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  is_bot_paused: boolean;
  paused_by: string | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  wa_message_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  content: string;
  media_type: MediaType | null;
  media_url: string | null;
  media_mime_type: string | null;
  message_type: string;
  status: MessageStatus;
  from_me: boolean;
  created_at: string;
}

export interface WhatsAppBotSettings {
  id: number;
  global_pause: boolean;
  global_paused_by: string | null;
  global_paused_at: string | null;
  transition_message_on: string;
  transition_message_off: string;
  updated_at: string;
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  mediaUrl?: string;
  mediaType?: MediaType;
}

export interface BotControlRequest {
  action: 'pause' | 'resume' | 'global_pause' | 'global_resume';
  conversationId?: string;
  sendTransition?: boolean;
  transitionMessage?: string;
}

export interface MarkReadRequest {
  conversationId: string;
}

// Evolution API webhook payload types
export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionMessageData;
}

export interface EvolutionMessageData {
  key: {
    id: string;
    fromMe: boolean;
    remoteJid: string;
  };
  pushName?: string;
  messageType?: string;
  message?: Record<string, unknown>;
  messageTimestamp?: number;
  source?: string;
  instanceId?: string;
  status?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/whatsapp.ts
git commit -m "feat(whatsapp): add TypeScript types for WhatsApp admin panel"
```

---

### Task 2: Environment variables

**Files:**
- Modify: `src/app/.env.example`
- Modify: `src/app/.env.local`

- [ ] **Step 1: Add new env vars to `.env.example`**

Append to `.env.example`:
```
# Evolution API
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=

# WhatsApp Bot
WHATSAPP_TESTING_NUMBERS=
N8N_WHATSAPP_WEBHOOK_URL=
WHATSAPP_WEBHOOK_SECRET=
```

- [ ] **Step 2: Add actual values to `.env.local`**

Read current `.env.local` values for Evolution API URL, key, and N8N webhook URL (already known from session). Add them under the new variable names. Generate a random string for `WHATSAPP_WEBHOOK_SECRET`.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add WhatsApp panel environment variables to .env.example"
```

---

### Task 3: Supabase admin client

**Files:**
- Create: `src/lib/supabase-admin.ts`

- [ ] **Step 1: Create server-side Supabase client with service role key**

```typescript
// src/lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase-admin.ts
git commit -m "feat: add server-side Supabase admin client for webhook operations"
```

---

### Task 4: Database schema (SQL migration)

**Files:**
- Create: `supabase/migrations/001_whatsapp_tables.sql` (reference file — execute via Supabase directly)

- [ ] **Step 1: Create migration SQL file**

```sql
-- whatsapp_conversations
CREATE TABLE whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jid text UNIQUE NOT NULL,
  phone_number text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  contact_avatar_url text,
  last_message text DEFAULT '',
  last_message_at timestamptz DEFAULT now(),
  unread_count integer DEFAULT 0,
  is_bot_paused boolean DEFAULT false,
  paused_by uuid REFERENCES profiles(id),
  paused_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_whatsapp_conversations_last_message_at
  ON whatsapp_conversations (last_message_at DESC);

-- whatsapp_messages
CREATE TABLE whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES whatsapp_conversations(id),
  wa_message_id text UNIQUE NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('client', 'bot', 'admin', 'system')),
  sender_id uuid REFERENCES profiles(id),
  content text DEFAULT '',
  media_type text CHECK (media_type IN ('image', 'video', 'audio', 'document')),
  media_url text,
  media_mime_type text,
  message_type text NOT NULL DEFAULT 'conversation',
  status text DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  from_me boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_whatsapp_messages_conv_created
  ON whatsapp_messages (conversation_id, created_at DESC);

-- whatsapp_bot_settings (singleton)
CREATE TABLE whatsapp_bot_settings (
  id integer PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  global_pause boolean DEFAULT false,
  global_paused_by uuid REFERENCES profiles(id),
  global_paused_at timestamptz,
  transition_message_on text DEFAULT 'Te comunicamos con un especialista de Innovakine. En breve te atenderemos.',
  transition_message_off text DEFAULT 'Estoy de vuelta! Hay algo mas en que pueda ayudarte?',
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings row
INSERT INTO whatsapp_bot_settings (id) VALUES (1);

-- RLS
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_bot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_conversations_access ON whatsapp_conversations
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'receptionist'))
);

CREATE POLICY whatsapp_messages_access ON whatsapp_messages
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'receptionist'))
);

CREATE POLICY whatsapp_settings_read ON whatsapp_bot_settings
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'receptionist'))
);

CREATE POLICY whatsapp_settings_update ON whatsapp_bot_settings
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- RPC for atomic unread increment
CREATE OR REPLACE FUNCTION increment_unread(conv_id uuid)
RETURNS void AS $$
  UPDATE whatsapp_conversations
  SET unread_count = unread_count + 1
  WHERE id = conv_id;
$$ LANGUAGE sql;

-- Enable Realtime
ALTER publication supabase_realtime ADD TABLE whatsapp_conversations;
ALTER publication supabase_realtime ADD TABLE whatsapp_messages;
```

- [ ] **Step 2: Execute migration against Supabase**

Connect to the self-hosted Supabase PostgreSQL and run the SQL. Use the DB credentials from `.env.local` (`SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`).

```bash
psql -h $SUPABASE_DB_HOST -p $SUPABASE_DB_PORT -U $SUPABASE_DB_USER -d postgres -f supabase/migrations/001_whatsapp_tables.sql
```

- [ ] **Step 3: Verify tables exist**

```bash
psql -h $SUPABASE_DB_HOST -p $SUPABASE_DB_PORT -U $SUPABASE_DB_USER -d postgres -c "\dt whatsapp_*"
```

Expected: 3 tables listed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_whatsapp_tables.sql
git commit -m "feat(whatsapp): add database schema for conversations, messages, and bot settings"
```

---

### Task 5: Evolution API client helper

**Files:**
- Create: `src/lib/evolution-api.ts`

- [ ] **Step 1: Create Evolution API client**

```typescript
// src/lib/evolution-api.ts
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME!;

async function evolutionFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${EVOLUTION_API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'apikey': EVOLUTION_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response;
}

export async function sendTextMessage(phone: string, text: string): Promise<{ messageId: string }> {
  const response = await evolutionFetch(`/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({ number: phone, text }),
  });
  const data = await response.json();
  return { messageId: data?.key?.id || '' };
}

export async function sendMediaMessage(
  phone: string,
  mediaUrl: string,
  mediaType: string,
  caption?: string
): Promise<{ messageId: string }> {
  const response = await evolutionFetch(`/message/sendMedia/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({
      number: phone,
      mediatype: mediaType,
      media: mediaUrl,
      caption: caption || '',
    }),
  });
  const data = await response.json();
  return { messageId: data?.key?.id || '' };
}

export function extractTextContent(message: Record<string, unknown>): string {
  if (typeof message.conversation === 'string') return message.conversation;
  const ext = message.extendedTextMessage as Record<string, unknown> | undefined;
  if (ext && typeof ext.text === 'string') return ext.text;
  const img = message.imageMessage as Record<string, unknown> | undefined;
  if (img && typeof img.caption === 'string') return img.caption;
  const vid = message.videoMessage as Record<string, unknown> | undefined;
  if (vid && typeof vid.caption === 'string') return vid.caption;
  const doc = message.documentMessage as Record<string, unknown> | undefined;
  if (doc && typeof doc.fileName === 'string') return doc.fileName;
  return '';
}

export function extractMediaInfo(message: Record<string, unknown>): {
  mediaType: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  messageType: string;
} {
  if (message.imageMessage) {
    const img = message.imageMessage as Record<string, unknown>;
    return { mediaType: 'image', mediaUrl: img.url as string || null, mediaMimeType: img.mimetype as string || null, messageType: 'imageMessage' };
  }
  if (message.videoMessage) {
    const vid = message.videoMessage as Record<string, unknown>;
    return { mediaType: 'video', mediaUrl: vid.url as string || null, mediaMimeType: vid.mimetype as string || null, messageType: 'videoMessage' };
  }
  if (message.audioMessage) {
    const aud = message.audioMessage as Record<string, unknown>;
    return { mediaType: 'audio', mediaUrl: aud.url as string || null, mediaMimeType: aud.mimetype as string || null, messageType: 'audioMessage' };
  }
  if (message.documentMessage) {
    const doc = message.documentMessage as Record<string, unknown>;
    return { mediaType: 'document', mediaUrl: doc.url as string || null, mediaMimeType: doc.mimetype as string || null, messageType: 'documentMessage' };
  }
  return { mediaType: null, mediaUrl: null, mediaMimeType: null, messageType: 'conversation' };
}

export function parseJidToPhone(jid: string): string {
  const number = jid.split('@')[0];
  return `+${number}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/evolution-api.ts
git commit -m "feat(whatsapp): add Evolution API client helper"
```

---

## Chunk 2: API Routes — Webhook, Send, Bot Control, Conversations, Messages

### Task 6: Webhook API route

**Files:**
- Create: `src/app/api/whatsapp/webhook/route.ts`

- [ ] **Step 1: Create webhook handler**

This is the most critical route. It receives all Evolution API events, saves to Supabase, and optionally calls N8N for bot responses.

Key logic:
1. Validate `?secret=` query parameter against `WHATSAPP_WEBHOOK_SECRET`
2. Parse `event` field from body
3. For `messages.upsert`: extract message data, find/create conversation, save message
4. For client messages with bot active: call N8N, save bot response, send via Evolution API
5. For `fromMe` messages not already in DB: save as admin, auto-pause bot
6. For `messages.update`: update message status
7. Filter by `WHATSAPP_TESTING_NUMBERS` if set
8. Use `supabaseAdmin` for all DB operations

The full implementation should handle: group message filtering (`@g.us`), LID format JIDs, N8N error handling (save as `status: 'failed'`), and writing admin messages to `n8n_chat_histories` for bot memory continuity.

- [ ] **Step 2: Test webhook manually**

```bash
curl -X POST "http://localhost:3000/api/whatsapp/webhook?secret=YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":"messages.upsert","instance":"Innovakine","data":{"key":{"id":"test123","fromMe":false,"remoteJid":"56992533044@s.whatsapp.net"},"pushName":"Test User","message":{"conversation":"Hola test"},"messageTimestamp":1773700000}}'
```

Expected: 200 OK, message saved in `whatsapp_messages`, conversation created in `whatsapp_conversations`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/whatsapp/webhook/route.ts
git commit -m "feat(whatsapp): add webhook API route for Evolution API events"
```

---

### Task 7: Send message API route

**Files:**
- Create: `src/app/api/whatsapp/send/route.ts`

- [ ] **Step 1: Create send endpoint**

Key logic:
1. Validate auth via `supabase.auth.getSession()`
2. Validate role is `admin` or `receptionist` from `profiles` table
3. Validate body with Zod: `{ conversationId: string, content: string, mediaUrl?: string, mediaType?: string }`
4. Get conversation JID from Supabase
5. Send via `sendTextMessage` or `sendMediaMessage` from `evolution-api.ts`
6. Save in `whatsapp_messages` with `sender_type: 'admin'`, `sender_id: user.id`
7. Also save to `n8n_chat_histories` with `[Agente Humano]:` prefix for bot memory
8. If bot was active (`is_bot_paused = false`), auto-pause conversation
9. Update conversation `last_message` and `last_message_at`

- [ ] **Step 2: Commit**

```bash
git add src/app/api/whatsapp/send/route.ts
git commit -m "feat(whatsapp): add send message API route"
```

---

### Task 8: Bot control API route

**Files:**
- Create: `src/app/api/whatsapp/bot-control/route.ts`

- [ ] **Step 1: Create bot control endpoint**

Key logic:
1. Validate auth and role
2. Validate body with Zod: `BotControlRequest`
3. Switch on `action`:
   - `pause`: Update conversation `is_bot_paused = true`, `paused_by`, `paused_at`. If `sendTransition`, send message via Evolution API and save as `sender_type: 'system'`
   - `resume`: Update conversation `is_bot_paused = false`, clear `paused_by`/`paused_at`. If `sendTransition`, send return message
   - `global_pause`: Update `whatsapp_bot_settings.global_pause = true` (admin only). No transition messages.
   - `global_resume`: Update `whatsapp_bot_settings.global_pause = false` (admin only). No transition messages.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/whatsapp/bot-control/route.ts
git commit -m "feat(whatsapp): add bot control API route (pause/resume/global)"
```

---

### Task 9: Mark read, conversations list, and messages API routes

**Files:**
- Create: `src/app/api/whatsapp/mark-read/route.ts`
- Create: `src/app/api/whatsapp/conversations/route.ts`
- Create: `src/app/api/whatsapp/messages/[id]/route.ts`

- [ ] **Step 1: Create mark-read endpoint**

Simple: validate auth, set `unread_count = 0` on conversation by ID.

- [ ] **Step 2: Create conversations list endpoint**

GET with query params `?search=text&page=1&limit=50`. Query `whatsapp_conversations` ordered by `last_message_at DESC`. If `search`, filter by `contact_name ILIKE` or `phone_number ILIKE`. Return paginated results with total count.

- [ ] **Step 3: Create messages endpoint**

GET `/api/whatsapp/messages/[id]` with query params `?before=timestamp&limit=50`. Query `whatsapp_messages` for `conversation_id = id` where `created_at < before`, ordered by `created_at DESC`, limited. Return messages in chronological order (reverse the DESC result).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/whatsapp/mark-read/route.ts src/app/api/whatsapp/conversations/route.ts src/app/api/whatsapp/messages/\[id\]/route.ts
git commit -m "feat(whatsapp): add mark-read, conversations list, and messages API routes"
```

---

## Chunk 3: Admin Layout Modification and UI Components

### Task 10: Modify admin layout for WhatsApp route

**Files:**
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Add WhatsApp nav item and remove padding for WhatsApp route**

In `src/app/admin/layout.tsx`:
1. Add `MessageCircle` to lucide-react imports
2. Add `{ name: "WhatsApp", href: "/admin/whatsapp", icon: MessageCircle }` to navigation array
3. Add `const isWhatsApp = pathname === "/admin/whatsapp";` check
4. Modify the main content wrapper: if `isWhatsApp`, remove `p-4 md:p-8` padding and `overflow-y-auto`

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat(whatsapp): add WhatsApp nav item and remove padding for chat layout"
```

---

### Task 11: EmptyChat and BotStatusBar components

**Files:**
- Create: `src/components/whatsapp/EmptyChat.tsx`
- Create: `src/components/whatsapp/BotStatusBar.tsx`

- [ ] **Step 1: Create EmptyChat**

Centered display with MessageCircle icon, title "WhatsApp Innovakine", subtitle "Selecciona una conversacion para comenzar". Uses design system colors.

- [ ] **Step 2: Create BotStatusBar**

Horizontal bar below chat header. Three states:
- `active`: green background, text "Kini esta activo en esta conversacion"
- `paused`: red background, text "Bot pausado — Estas respondiendo directamente"
- `global_paused`: yellow background, text "Bot pausado globalmente"

Props: `{ isBotPaused: boolean, isGlobalPaused: boolean }`

- [ ] **Step 3: Commit**

```bash
git add src/components/whatsapp/EmptyChat.tsx src/components/whatsapp/BotStatusBar.tsx
git commit -m "feat(whatsapp): add EmptyChat and BotStatusBar components"
```

---

### Task 12: MessageBubble component

**Files:**
- Create: `src/components/whatsapp/MessageBubble.tsx`

- [ ] **Step 1: Create MessageBubble**

Props: `{ message: WhatsAppMessage }`

Renders a single message bubble:
- `sender_type === 'client'`: white background, left-aligned, rounded with flat top-left
- `sender_type === 'bot'`: blue (#dbeafe) background, right-aligned, labeled "Kini" in blue
- `sender_type === 'admin'`: green (#d9fdd3) background, right-aligned, labeled "Admin" in teal
- `sender_type === 'system'`: yellow centered pill, smaller text
- Failed messages (`status === 'failed'`): red border/outline
- Timestamp in bottom-right corner
- Delivery ticks for outgoing messages: single check (sent), double check (delivered), blue double check (read)
- Media rendering: `<img>` for images, `<video>` for video, `<audio>` for audio, download link for documents

- [ ] **Step 2: Commit**

```bash
git add src/components/whatsapp/MessageBubble.tsx
git commit -m "feat(whatsapp): add MessageBubble component with sender-type styling"
```

---

### Task 13: MessageInput component

**Files:**
- Create: `src/components/whatsapp/MessageInput.tsx`

- [ ] **Step 1: Create MessageInput**

Props: `{ onSend: (content: string) => void, disabled?: boolean }`

Features:
- Auto-growing textarea (min 1 row, max 5 rows)
- Attach button (placeholder for Phase 1 — file upload)
- Send button (teal circle with arrow icon)
- Submit on Enter (Shift+Enter for newline)
- Disabled state when sending

- [ ] **Step 2: Commit**

```bash
git add src/components/whatsapp/MessageInput.tsx
git commit -m "feat(whatsapp): add MessageInput component with auto-grow textarea"
```

---

### Task 14: PausePopup and ResumePopup components

**Files:**
- Create: `src/components/whatsapp/PausePopup.tsx`
- Create: `src/components/whatsapp/ResumePopup.tsx`

- [ ] **Step 1: Create PausePopup**

Modal with backdrop blur. Props: `{ isOpen: boolean, onClose: () => void, onPause: (sendTransition: boolean, message: string) => void, defaultMessage: string }`

UI: Title, description, editable textarea with default transition message, three buttons (Cancelar, Pausar sin mensaje, Pausar y enviar).

- [ ] **Step 2: Create ResumePopup**

Same pattern. Props: `{ isOpen: boolean, onClose: () => void, onResume: (sendTransition: boolean, message: string) => void, defaultMessage: string }`

UI: Title, editable textarea with default return message, two buttons (Reactivar sin mensaje, Reactivar y enviar).

- [ ] **Step 3: Commit**

```bash
git add src/components/whatsapp/PausePopup.tsx src/components/whatsapp/ResumePopup.tsx
git commit -m "feat(whatsapp): add PausePopup and ResumePopup modal components"
```

---

### Task 15: ConversationItem component

**Files:**
- Create: `src/components/whatsapp/ConversationItem.tsx`

- [ ] **Step 1: Create ConversationItem**

Props: `{ conversation: WhatsAppConversation, isSelected: boolean, onClick: () => void }`

Renders one row in the conversation list:
- Avatar circle with initials (first letter of first name + first letter of last name, or first 2 letters)
- Contact name with bot status indicator badge (green robot emoji if active, red pause if paused)
- Last message preview (truncated, single line)
- Timestamp (relative: "14:02", "Ayer", "12 mar")
- Unread badge (teal circle with count) if `unread_count > 0`
- Selected state: teal-light background
- Hover state: slate-50 background

- [ ] **Step 2: Commit**

```bash
git add src/components/whatsapp/ConversationItem.tsx
git commit -m "feat(whatsapp): add ConversationItem component"
```

---

### Task 16: ConversationList component

**Files:**
- Create: `src/components/whatsapp/ConversationList.tsx`

- [ ] **Step 1: Create ConversationList**

Props: `{ conversations: WhatsAppConversation[], selectedId: string | null, onSelect: (id: string) => void, botSettings: WhatsAppBotSettings, userRole: string, onGlobalToggle: () => void }`

Layout:
- Header with title "WhatsApp" and global bot toggle button (admin only)
- Search input that filters conversations by `contact_name` or `phone_number` client-side
- Scrollable list of `ConversationItem` components
- Sorted by `last_message_at` DESC

- [ ] **Step 2: Commit**

```bash
git add src/components/whatsapp/ConversationList.tsx
git commit -m "feat(whatsapp): add ConversationList component with search and global toggle"
```

---

### Task 17: ChatPanel component

**Files:**
- Create: `src/components/whatsapp/ChatPanel.tsx`

- [ ] **Step 1: Create ChatPanel**

Props: `{ conversation: WhatsAppConversation, messages: WhatsAppMessage[], botSettings: WhatsAppBotSettings, userRole: string, onSendMessage: (content: string) => void, onBotPause: (sendTransition: boolean, message: string) => void, onBotResume: (sendTransition: boolean, message: string) => void, onLoadMore: () => void, hasMore: boolean }`

Layout:
- **Header**: avatar, name, phone, pause/resume button
- **BotStatusBar**: shows current bot state
- **Messages area**: scrollable div with `MessageBubble` components, date dividers between days, scroll-to-bottom on new messages, lazy loading on scroll to top (calls `onLoadMore`)
- **MessageInput**: at bottom
- **PausePopup/ResumePopup**: controlled by local state, triggered by header button

Date dividers: group messages by date, insert a centered date label between groups.

- [ ] **Step 2: Commit**

```bash
git add src/components/whatsapp/ChatPanel.tsx
git commit -m "feat(whatsapp): add ChatPanel component with messages, input, and bot controls"
```

---

## Chunk 4: Main Page with Realtime Integration

### Task 18: WhatsApp admin page

**Files:**
- Create: `src/app/admin/whatsapp/page.tsx`

- [ ] **Step 1: Create the main page**

`"use client"` component that orchestrates everything:

1. **State**: `conversations`, `selectedConversation`, `messages`, `botSettings`, `userRole`, `loading`, `hasMore`, `realtimeConnected`
2. **Auth**: Get session and fetch user role from `profiles` table
3. **Initial load**: Fetch conversations from `/api/whatsapp/conversations`, fetch bot settings from Supabase directly
4. **Conversation selection**: When selecting a conversation, fetch messages from `/api/whatsapp/messages/[id]`, call `/api/whatsapp/mark-read`
5. **Realtime subscriptions**:
   - Subscribe to `whatsapp_messages` INSERT events: when a new message arrives for the selected conversation, append to messages array. If for a different conversation, update that conversation's `last_message` and `unread_count` in the list.
   - Subscribe to `whatsapp_conversations` UPDATE events: update conversation in list (bot state changes, last message updates)
   - Handle channel error: show "Reconectando..." banner, attempt resubscribe
6. **Send message**: POST to `/api/whatsapp/send`, optimistically add message to UI
7. **Bot control**: POST to `/api/whatsapp/bot-control`, update local state
8. **Global toggle**: POST to `/api/whatsapp/bot-control` with `global_pause`/`global_resume`
9. **Lazy loading**: When scrolling to top of messages, fetch older messages with `?before=` cursor
10. **Layout**: Flex container with `ConversationList` (380px) and either `ChatPanel` or `EmptyChat`

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/whatsapp/page.tsx
git commit -m "feat(whatsapp): add WhatsApp admin page with Realtime integration"
```

---

## Chunk 5: N8N Workflow Simplification and Evolution API Webhook Setup

### Task 19: Simplify N8N workflow

**Files:**
- N8N workflow `chatbot innovakine whatsapp` (modified via N8N API)

- [ ] **Step 1: Update N8N workflow to request-response pattern**

Simplify the workflow to:
1. **Webhook** node: receives POST with `{ content, sessionId, senderPhone, senderName }`
2. **AI Agent** node: processes with Gemini + Postgres Chat Memory + Gmail tool
3. **Respond to Webhook** node: returns `{ output: "response text" }`

Remove all other nodes (Router, Route, Check Bot State, Pause Bot, Unpause Bot, Send WhatsApp, Mark as Read, Save Client During Handoff, Save Agent to Memory). All that logic now lives in the Next.js API routes.

- [ ] **Step 2: Test N8N webhook responds correctly**

```bash
curl -X POST "https://n8n-n8n.wfrhms.easypanel.host/webhook/whatsapp-kini" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hola, quiero info","sessionId":"wa_test","senderPhone":"+56992533044","senderName":"Test"}'
```

Expected: JSON response with `{ output: "..." }` containing Kini's response.

- [ ] **Step 3: Commit a note about the N8N change**

```bash
echo "N8N workflow simplified to request-response on $(date)" >> docs/changelog.md
git add docs/changelog.md
git commit -m "docs: record N8N workflow simplification for WhatsApp panel"
```

---

### Task 20: Configure Evolution API webhook

- [ ] **Step 1: Set Evolution API webhook to point to Next.js**

```bash
curl -X POST -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
  -d '{"webhook":{"enabled":true,"url":"https://YOUR_VERCEL_URL/api/whatsapp/webhook?secret=YOUR_SECRET","events":["MESSAGES_UPSERT","MESSAGES_UPDATE"],"webhookByEvents":false,"webhookBase64":false}}' \
  "$EVOLUTION_API_URL/webhook/set/$EVOLUTION_INSTANCE_NAME"
```

- [ ] **Step 2: Remove Chatwoot webhook to N8N**

Delete the Chatwoot account-level webhook that pointed to `whatsapp-kini`:

```bash
curl -X DELETE -H "api_access_token: CHATWOOT_TOKEN" \
  "https://n8n-chatwoot.wfrhms.easypanel.host/api/v1/accounts/1/webhooks/1"
```

- [ ] **Step 3: Verify webhook fires**

Send a test WhatsApp message to the clinic number and check:
1. Message appears in `whatsapp_messages` table
2. Conversation created/updated in `whatsapp_conversations`
3. If bot active and number in testing list: N8N called, bot response sent

---

## Chunk 6: Integration Testing and Cleanup

### Task 21: End-to-end testing

- [ ] **Step 1: Test full flow — client sends message, bot responds**

Send WhatsApp message from test number → verify in Supabase → verify bot response → verify in admin panel.

- [ ] **Step 2: Test pause/resume flow**

From panel: pause bot → send admin message → verify client receives → resume bot → send client message → verify bot responds.

- [ ] **Step 3: Test global pause**

Toggle global pause → send client message → verify bot does NOT respond → toggle global resume → send client message → verify bot responds.

- [ ] **Step 4: Test admin responds from WhatsApp Web**

Send message from WhatsApp Web → verify auto-pause → verify message appears in panel as admin message.

- [ ] **Step 5: Test Realtime updates**

Open panel in browser → send WhatsApp message from phone → verify message appears in panel without refresh.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(whatsapp): complete WhatsApp admin panel with bot controls and Realtime"
```
