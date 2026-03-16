-- WhatsApp Admin Panel Schema
-- Tables: whatsapp_conversations, whatsapp_messages, whatsapp_bot_settings

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
