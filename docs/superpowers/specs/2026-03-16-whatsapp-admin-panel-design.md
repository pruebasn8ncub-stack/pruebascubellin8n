# WhatsApp Admin Panel — Design Spec

## Overview

Panel de administración de WhatsApp integrado en InnovaKine (`/admin/whatsapp`) que reemplaza Chatwoot. Permite monitorear conversaciones, responder clientes, y controlar el chatbot Kini con pausas por conversación y globales.

These API routes are new functionality not covered by api-agenda-web, so Next.js API routes are the correct home per the project architecture.

## Architecture

### Data Flow

```
WhatsApp → Evolution API → POST /api/whatsapp/webhook → Supabase
                                    │
                                    ├─ Bot activo? → Llama N8N → Respuesta IA
                                    └─ Bot pausado? → Solo guarda

Panel Admin → Lee Supabase (Realtime)
            → Envía mensajes → POST /api/whatsapp/send → Evolution API
            → Controla bot → POST /api/whatsapp/bot-control → Supabase
```

### Principles

- **Supabase = única fuente de verdad** para mensajes, conversaciones y estado del bot
- **N8N = solo generador de respuestas IA** (Gemini + memoria + herramientas)
- **Evolution API = transporte** de mensajes WhatsApp
- **Next.js API routes = orquestador** que conecta todo
- **Server-side Supabase admin client** (`supabase-admin.ts`) using `SUPABASE_SERVICE_ROLE_KEY` for webhook operations that bypass RLS

## Data Model

### Table: `whatsapp_conversations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | ID único |
| `jid` | text UNIQUE | WhatsApp JID del contacto |
| `phone_number` | text | Número formateado (+569...) |
| `contact_name` | text | Nombre del contacto en WhatsApp |
| `contact_avatar_url` | text nullable | URL foto de perfil |
| `last_message` | text | Preview del último mensaje |
| `last_message_at` | timestamptz | Timestamp último mensaje |
| `unread_count` | integer default 0 | Mensajes sin leer |
| `is_bot_paused` | boolean default false | Bot pausado para esta conversación |
| `paused_by` | uuid nullable FK profiles | Quién pausó |
| `paused_at` | timestamptz nullable | Cuándo se pausó |
| `created_at` | timestamptz | Primera interacción |
| `updated_at` | timestamptz | Última actualización |

**Indexes:** `jid` (covered by UNIQUE), `last_message_at DESC` for sorted listing.

### Table: `whatsapp_messages`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | ID único |
| `conversation_id` | uuid FK whatsapp_conversations | Conversación |
| `wa_message_id` | text UNIQUE | ID del mensaje en WhatsApp |
| `sender_type` | text CHECK (client, bot, admin, system) | Tipo de remitente |
| `sender_id` | uuid nullable FK profiles | ID del admin si aplica (null for messages from WhatsApp Web/App — attributed to unknown admin) |
| `content` | text | Texto del mensaje |
| `media_type` | text nullable | image, video, audio, document |
| `media_url` | text nullable | URL del archivo (proxied through Supabase Storage for persistence — WhatsApp URLs expire) |
| `media_mime_type` | text nullable | MIME type |
| `message_type` | text | conversation, imageMessage, etc. |
| `status` | text default 'sent' | pending, sent, delivered, read, failed |
| `from_me` | boolean | Si es mensaje saliente |
| `created_at` | timestamptz | Timestamp del mensaje |

**Indexes:** `(conversation_id, created_at DESC)` for message loading, `wa_message_id` (covered by UNIQUE).

### Table: `whatsapp_bot_settings`

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer PK CHECK (id = 1) | Singleton row enforced by constraint |
| `global_pause` | boolean default false | Pausa global |
| `global_paused_by` | uuid nullable FK profiles | Quién pausó |
| `global_paused_at` | timestamptz nullable | Cuándo |
| `transition_message_on` | text | Mensaje cuando admin toma control |
| `transition_message_off` | text | Mensaje cuando bot vuelve |
| `updated_at` | timestamptz | Última actualización |

Default transition messages:
- `transition_message_on`: "Te comunicamos con un especialista de Innovakine. En breve te atenderemos."
- `transition_message_off`: "Estoy de vuelta! Hay algo mas en que pueda ayudarte?"

### RLS Policies

```sql
-- whatsapp_conversations and whatsapp_messages
CREATE POLICY whatsapp_access ON whatsapp_conversations
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'receptionist')
  )
);

-- whatsapp_bot_settings: SELECT for admin+receptionist, UPDATE for admin only
CREATE POLICY whatsapp_settings_read ON whatsapp_bot_settings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'receptionist')
  )
);

CREATE POLICY whatsapp_settings_update ON whatsapp_bot_settings
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

Webhook route uses server-side admin client (`SUPABASE_SERVICE_ROLE_KEY`) to bypass RLS since there is no authenticated user context.

No DELETE operations are permitted on WhatsApp tables. Messages are retained for audit and compliance purposes.

### Realtime

Enable Supabase Realtime on `whatsapp_messages` and `whatsapp_conversations` tables for live updates in the panel. Client components should handle Realtime subscription lifecycle (reconnect on channel error, show "reconectando..." banner on disconnect).

## API Routes

### POST `/api/whatsapp/webhook`

Receives Evolution API webhook events. Validated by secret token in URL path: `/api/whatsapp/webhook?secret={WHATSAPP_WEBHOOK_SECRET}`. The secret is configured in Evolution API's webhook URL and validated server-side. Requests without valid secret return 401.

Uses `supabase-admin` client (service role key) to write to RLS-protected tables.

**MESSAGES_UPSERT handler:**
1. Validate webhook secret from query parameter
2. Extract `key.fromMe`, `key.remoteJid`, `key.id`, `pushName`, `message`, `messageTimestamp`
3. Ignore group messages (`remoteJid` containing `@g.us`)
4. Find or create conversation by JID
5. If `fromMe = false` (client message):
   - Save message with `sender_type: 'client'`
   - Atomic increment: `unread_count = unread_count + 1` via Supabase RPC
   - Update conversation `last_message`, `last_message_at`
   - Check `global_pause` and `is_bot_paused`
   - If bot active: call N8N webhook, save response as `sender_type: 'bot'`
   - If N8N fails: save with `status: 'failed'`, do not send to client
6. If `fromMe = true` (outgoing message):
   - Check if message already exists in DB (sent by bot or panel)
   - If not exists: admin sent from WhatsApp Web/App
     - Save with `sender_type: 'admin'`, `sender_id: null` (unknown admin — documented limitation)
     - Auto-pause bot for this conversation

**MESSAGES_UPDATE handler:**
- Update message `status` (delivered, read) by `wa_message_id`

### POST `/api/whatsapp/send`

Admin sends message from panel. Requires auth (admin or receptionist).

**Body:** `{ conversationId: string, content: string, mediaUrl?: string, mediaType?: string }`

**Flow:**
1. Validate auth and role
2. Get conversation JID from Supabase
3. Send via Evolution API (`/message/sendText/{instance}` or `/message/sendMedia/{instance}`)
4. Save in Supabase with `sender_type: 'admin'`, `sender_id: user.id`
5. If bot was active, auto-pause (without transition message — admin chose to type directly)
6. Return message ID

### POST `/api/whatsapp/bot-control`

Controls bot state. Requires auth (admin only for global, admin+receptionist for per-conversation).

**Body:** `{ action: 'pause' | 'resume' | 'global_pause' | 'global_resume', conversationId?: string, sendTransition?: boolean, transitionMessage?: string }`

**Flow:**
- `pause`: Set `is_bot_paused = true` on conversation. If `sendTransition`, send message via Evolution API and save as `sender_type: 'system'`
- `resume`: Set `is_bot_paused = false`. If `sendTransition`, send return message and save as `sender_type: 'system'`
- `global_pause`: Set `global_pause = true` in `whatsapp_bot_settings`. Does NOT send transition messages to individual conversations.
- `global_resume`: Set `global_pause = false` in `whatsapp_bot_settings`. Does NOT send transition messages to individual conversations.

### POST `/api/whatsapp/mark-read`

Marks conversation as read (resets unread count). Requires auth.

**Body:** `{ conversationId: string }`

**Flow:**
1. Set `unread_count = 0` on conversation
2. Return success

### GET `/api/whatsapp/conversations`

List conversations with pagination and search. Requires auth (admin or receptionist).

**Query params:** `?search=text&page=1&limit=50`

### GET `/api/whatsapp/messages/[conversationId]`

Get messages for a conversation with cursor-based pagination (lazy loading). Requires auth.

**Query params:** `?before=timestamp&limit=50`

Cursor-based pagination is used for messages (better for lazy loading) while offset-based is used for conversations (simpler for a finite sorted list).

## UI Components

### Page: `/admin/whatsapp`

Full-height layout. Requires modification to `src/app/admin/layout.tsx` to detect `/admin/whatsapp` path and remove `p-4 md:p-8` padding for this route (similar to the existing `isDashboard` check). Sidebar remains visible.

Three-column design:
1. InnovaKine sidebar (inherited from admin layout)
2. Conversation list panel (380px)
3. Chat panel (flex: 1)

### Component: `ConversationList`

- Search input at top
- Global bot toggle button (ON/OFF) — admin only
- Scrollable list of conversation items
- Each item shows: avatar (initials), contact name, last message preview, time, unread badge, bot status indicator
- Failed bot indicator on conversations where bot failed to respond
- Selected state with teal highlight
- Sorted by `last_message_at` DESC
- Calls `/api/whatsapp/mark-read` when a conversation is selected

### Component: `ChatPanel`

- **Header:** Contact avatar, name, phone number, "Pausar/Reactivar Bot" button
- **Status bar:** Colored bar showing bot state (green=active, red=paused, yellow=global pause)
- **Messages area:** WhatsApp-style bubbles
  - White = client (incoming, left-aligned)
  - Blue = bot (outgoing, right-aligned, labeled "Kini")
  - Green = admin (outgoing, right-aligned, labeled "Admin")
  - Yellow centered = system messages (transitions, pause events)
  - Red outline = failed bot messages
  - Show delivery ticks (sent, delivered, read)
  - Date dividers between days
  - Lazy loading on scroll up
  - Media rendering: images inline, videos with player, audio with waveform, documents with download link
- **Input area:** Text input with attach button and send button. Textarea auto-grows.
- **Reconnection banner:** Shows "Reconectando..." if Supabase Realtime connection drops

### Component: `PausePopup`

Modal dialog when admin clicks "Pausar Bot":
- Title: "Pausar chatbot para esta conversacion"
- Editable textarea with default transition message
- Three buttons: "Cancelar", "Pausar sin mensaje", "Pausar y enviar"

### Component: `ResumePopup`

Modal dialog when admin clicks "Reactivar Bot":
- Title: "Reactivar chatbot"
- Option to send return message or not
- Editable textarea with default return message
- Two buttons: "Reactivar sin mensaje", "Reactivar y enviar"

### Component: `EmptyChat`

Shown when no conversation is selected. Centered icon and text.

## N8N Integration

### Simplified workflow

The N8N workflow becomes a simple request-response:

```
Webhook (POST, called by Next.js API route)
    |
    v
AI Agent (Gemini 3.1 Pro + Postgres Chat Memory + Gmail tool)
    |
    v
Respond to Webhook (returns { output: "response text" })
```

**Webhook receives:**
```json
{
  "content": "message text",
  "sessionId": "wa_{conversationId}",
  "senderPhone": "+56992533044",
  "senderName": "Maria Lopez"
}
```

**Webhook returns:**
```json
{
  "output": "bot response text"
}
```

### Memory continuity

The Postgres Chat Memory node continues using `n8n_chat_histories` table with `session_id = wa_{conversationId}`. The Next.js API route saves admin messages to this same table with `[Agente Humano]:` prefix so Kini has full context.

### Testing filter

The `TESTING_NUMBERS` filter is in the Next.js API route webhook handler (not N8N). Configurable via environment variable `WHATSAPP_TESTING_NUMBERS` (comma-separated). When empty, all numbers are processed.

## Evolution API Configuration

### Webhook setup

```
POST /webhook/set/Innovakine
{
  "webhook": {
    "enabled": true,
    "url": "{NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook?secret={WHATSAPP_WEBHOOK_SECRET}",
    "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE"],
    "webhookByEvents": false,
    "webhookBase64": false
  }
}
```

### Chatwoot integration

Keep Chatwoot integration enabled as read-only backup monitor. Remove Chatwoot webhook to N8N (the `whatsapp-kini` account webhook).

## Media Handling

Phase 1 focuses on text messages. Media support is included but simplified:

- **Incoming media:** Evolution API provides a temporary URL. The webhook handler downloads and uploads to Supabase Storage for persistence (WhatsApp URLs expire). `media_url` stores the Supabase Storage URL.
- **Outgoing media:** Admin uploads file through the panel. File goes to Supabase Storage, then the URL is sent via Evolution API's sendMedia endpoint.
- **Display:** Images render inline with lightbox on click. Videos show thumbnail with play button. Audio shows a simple player. Documents show icon with download link.
- **Size limits:** Max 16MB per file (WhatsApp limit).

## Access Control

| Role | View conversations | Send messages | Pause/Resume per conversation | Global pause |
|------|-------------------|---------------|-------------------------------|-------------|
| admin | Yes | Yes | Yes | Yes |
| receptionist | Yes | Yes | Yes | No |
| professional | No | No | No | No |

## File Structure

```
src/
├── app/
│   ├── admin/
│   │   └── whatsapp/
│   │       └── page.tsx                    # Main page (client component)
│   └── api/
│       └── whatsapp/
│           ├── webhook/route.ts            # Evolution API webhook handler
│           ├── send/route.ts               # Send message endpoint
│           ├── bot-control/route.ts        # Bot pause/resume endpoint
│           ├── mark-read/route.ts          # Mark conversation as read
│           ├── conversations/route.ts      # List conversations
│           └── messages/[id]/route.ts      # Get messages by conversation
├── components/
│   └── whatsapp/
│       ├── ConversationList.tsx
│       ├── ConversationItem.tsx
│       ├── ChatPanel.tsx
│       ├── MessageBubble.tsx
│       ├── MessageInput.tsx
│       ├── BotStatusBar.tsx
│       ├── PausePopup.tsx
│       ├── ResumePopup.tsx
│       └── EmptyChat.tsx
├── lib/
│   ├── supabase-admin.ts                  # Server-side admin client (service role key)
│   └── evolution-api.ts                   # Evolution API client helper
└── types/
    └── whatsapp.ts                        # WhatsApp-specific types
```

## Environment Variables

Add to `.env.local` and `.env.example` (values only in .env.local, names only in .env.example):

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

## Error Handling

- **Evolution API errors:** log and retry once, then save message as `status: 'failed'`
- **N8N errors:** save bot message with `status: 'failed'`, show red indicator in ConversationList and MessageBubble, do not send to client
- **Supabase errors:** return 500, log error (never log message content with PII)
- **Webhook validation:** check secret from query parameter, reject with 401 if invalid
- **Realtime disconnection:** show "Reconectando..." banner, auto-reconnect

## Testing Strategy

- Unit tests (Vitest): API route handlers, message parsing, bot state logic
- Manual testing: Use `WHATSAPP_TESTING_NUMBERS` filter to limit bot to test number only
- Integration: Test full flow webhook -> Supabase -> panel -> Evolution API
