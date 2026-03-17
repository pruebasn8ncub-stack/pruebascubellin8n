export type SenderType = 'client' | 'bot' | 'admin' | 'system';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

export interface WhatsAppConversation {
  id: string;
  jid: string;
  phone_number: string;
  contact_name: string;
  contact_avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  last_message_from_me: boolean;
  last_message_sender_type: SenderType;
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
