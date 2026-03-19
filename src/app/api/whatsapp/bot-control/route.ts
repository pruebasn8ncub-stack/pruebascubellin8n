/**
 * POST /api/whatsapp/bot-control
 *
 * Pause/resume the WhatsApp bot at conversation or global scope.
 * Requires a valid Supabase Bearer token.
 * global_pause / global_resume require role = 'admin'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthUser } from '@/lib/auth';
import { sendTextMessage } from '@/lib/evolution-api';
import { ApiResponseBuilder } from '@/lib/api-response';
import { handleError } from '@/lib/error-handler';
import { AppError } from '@/lib/errors';
import type { WhatsAppConversation, WhatsAppBotSettings } from '@/types/whatsapp';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const botControlSchema = z.object({
  action: z.enum(['pause', 'resume', 'global_pause', 'global_resume']),
  conversationId: z.string().uuid().optional(),
  sendTransition: z.boolean().optional().default(false),
  transitionMessage: z.string().optional(),
});

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
    const {
      action,
      conversationId,
      sendTransition,
      transitionMessage,
    } = botControlSchema.parse(body);

    // ── Global actions (admin only) ─────────────────────────────────────────
    if (action === 'global_pause' || action === 'global_resume') {
      if (authUser.role !== 'admin') {
        return NextResponse.json(
          ApiResponseBuilder.error(
            'Only admins can control global bot state',
            'FORBIDDEN',
            403
          ),
          { status: 403 }
        );
      }

      if (action === 'global_pause') {
        await supabaseAdmin
          .from('whatsapp_bot_settings')
          .update({
            global_pause: true,
            global_paused_by: authUser.id,
            global_paused_at: new Date().toISOString(),
          })
          .not('id', 'is', null); // update all rows (singleton table)
      } else {
        await supabaseAdmin
          .from('whatsapp_bot_settings')
          .update({
            global_pause: false,
            global_paused_by: null,
            global_paused_at: null,
          })
          .not('id', 'is', null);
      }

      return NextResponse.json(
        ApiResponseBuilder.success({ success: true, action }),
        { status: 200 }
      );
    }

    // ── Per-conversation actions ────────────────────────────────────────────
    if (!conversationId) {
      throw new AppError(
        'conversationId is required for pause/resume actions',
        400,
        'VALIDATION_ERROR'
      );
    }

    const { data: conv, error: convError } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conv) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    const conversation = conv as WhatsAppConversation;

    if (action === 'pause') {
      await supabaseAdmin
        .from('whatsapp_conversations')
        .update({
          is_bot_paused: true,
          paused_by: authUser.id,
          paused_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      if (sendTransition) {
        let message = transitionMessage;

        if (!message) {
          // Fetch default transition-on message from settings
          const { data: settingsRow } = await supabaseAdmin
            .from('whatsapp_bot_settings')
            .select('transition_message_on')
            .limit(1)
            .single();

          const settings = settingsRow as Pick<WhatsAppBotSettings, 'transition_message_on'> | null;
          message = settings?.transition_message_on ?? '';
        }

        if (message) {
          await sendTextMessage(conversation.phone_number, message);

          await supabaseAdmin.from('whatsapp_messages').insert({
            conversation_id: conversationId,
            wa_message_id: `sys_pause_${Date.now()}`,
            sender_type: 'system',
            sender_id: null,
            content: message,
            media_type: null,
            media_url: null,
            media_mime_type: null,
            message_type: 'conversation',
            status: 'sent',
            from_me: true,
          });
        }
      }
    } else {
      // action === 'resume'
      await supabaseAdmin
        .from('whatsapp_conversations')
        .update({
          is_bot_paused: false,
          paused_by: null,
          paused_at: null,
        })
        .eq('id', conversationId);

      if (sendTransition) {
        let message = transitionMessage;

        if (!message) {
          const { data: settingsRow } = await supabaseAdmin
            .from('whatsapp_bot_settings')
            .select('transition_message_off')
            .limit(1)
            .single();

          const settings = settingsRow as Pick<WhatsAppBotSettings, 'transition_message_off'> | null;
          message = settings?.transition_message_off ?? '';
        }

        if (message) {
          await sendTextMessage(conversation.phone_number, message);

          await supabaseAdmin.from('whatsapp_messages').insert({
            conversation_id: conversationId,
            wa_message_id: `sys_resume_${Date.now()}`,
            sender_type: 'system',
            sender_id: null,
            content: message,
            media_type: null,
            media_url: null,
            media_mime_type: null,
            message_type: 'conversation',
            status: 'sent',
            from_me: true,
          });
        }
      }
    }

    return NextResponse.json(
      ApiResponseBuilder.success({ success: true, action, conversationId }),
      { status: 200 }
    );
  } catch (error) {
    return handleError(error);
  }
}
