/**
 * POST /api/whatsapp/send
 *
 * Sends a WhatsApp message from the admin panel.
 * Requires a valid Supabase Bearer token in the Authorization header.
 * Allowed roles: admin, receptionist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendTextMessage, sendMediaMessage } from '@/lib/evolution-api';
import { ApiResponseBuilder } from '@/lib/api-response';
import { handleError } from '@/lib/error-handler';
import { AppError } from '@/lib/errors';
import type { WhatsAppConversation } from '@/types/whatsapp';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video', 'audio', 'document']).optional(),
});

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAuthUser(
  request: NextRequest
): Promise<{ id: string; role: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return { id: user.id, role: profile.role as string };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        ApiResponseBuilder.error('Unauthorized', 'UNAUTHORIZED', 401),
        { status: 401 }
      );
    }

    if (authUser.role !== 'admin' && authUser.role !== 'receptionist') {
      return NextResponse.json(
        ApiResponseBuilder.error('Forbidden', 'FORBIDDEN', 403),
        { status: 403 }
      );
    }

    const body = await request.json();
    const { conversationId, content, mediaUrl, mediaType } = sendSchema.parse(body);

    // Fetch conversation (bypass RLS with admin client)
    const { data: conv, error: convError } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conv) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    const conversation = conv as WhatsAppConversation;

    // Send via Evolution API
    let sendResult: { messageId: string };
    if (mediaUrl && mediaType) {
      sendResult = await sendMediaMessage(
        conversation.phone_number,
        mediaUrl,
        mediaType,
        content
      );
    } else {
      sendResult = await sendTextMessage(conversation.phone_number, content);
    }

    // Persist the message
    const { data: savedMsg, error: msgError } = await supabaseAdmin
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        wa_message_id: sendResult.messageId,
        sender_type: 'admin',
        sender_id: authUser.id,
        content,
        media_type: mediaType ?? null,
        media_url: mediaUrl ?? null,
        media_mime_type: null,
        message_type: mediaType ? `${mediaType}Message` : 'conversation',
        status: 'sent',
        from_me: true,
      })
      .select('id')
      .single();

    if (msgError) {
      throw new AppError('Failed to save message', 500, 'DATABASE_ERROR');
    }

    // Sync to N8N chat memory
    await supabaseAdmin.from('n8n_chat_histories').insert({
      session_id: `wa_${conversationId}`,
      message: {
        type: 'human',
        data: { content: `[Agente Humano]: ${content}` },
      },
    });

    // Auto-pause bot and cancel any pending debounce
    if (!conversation.is_bot_paused) {
      await supabaseAdmin
        .from('whatsapp_conversations')
        .update({
          is_bot_paused: true,
          paused_by: authUser.id,
          paused_at: new Date().toISOString(),
          bot_pending_since: null,
        })
        .eq('id', conversationId);
    }

    // Update conversation summary
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({
        last_message: content,
        last_message_at: new Date().toISOString(),
        last_message_from_me: true,
        last_message_sender_type: 'admin',
      })
      .eq('id', conversationId);

    return NextResponse.json(
      ApiResponseBuilder.success({ success: true, messageId: savedMsg?.id }),
      { status: 200 }
    );
  } catch (error) {
    return handleError(error);
  }
}
