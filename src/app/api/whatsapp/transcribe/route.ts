/**
 * POST /api/whatsapp/transcribe
 *
 * Transcribes a WhatsApp audio message using OpenAI Whisper.
 * Reads the base64 audio from the database, sends it to Whisper,
 * and saves the transcription back to the message content field.
 *
 * Requires a valid Supabase Bearer token.
 * Allowed roles: admin, receptionist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ApiResponseBuilder } from '@/lib/api-response';
import { handleError } from '@/lib/error-handler';
import { AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const transcribeSchema = z.object({
  messageId: z.string().uuid(),
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
    const [authUser, body] = await Promise.all([
      getAuthUser(request),
      request.json(),
    ]);

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

    const { messageId } = transcribeSchema.parse(body);

    // Fetch the message
    const { data: message, error: msgError } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('id, media_type, media_url, content')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      throw new AppError('Message not found', 404, 'NOT_FOUND');
    }

    if (message.media_type !== 'audio') {
      throw new AppError('Message is not an audio', 400, 'INVALID_TYPE');
    }

    if (!message.media_url) {
      throw new AppError('Audio data not available', 400, 'NO_MEDIA');
    }

    // Already transcribed
    if (message.content) {
      return NextResponse.json(
        ApiResponseBuilder.success({ transcription: message.content }),
        { status: 200 }
      );
    }

    // Download audio from URL or extract from base64 data URI
    let audioBuffer: Buffer;
    if (message.media_url.startsWith('data:')) {
      const base64Match = message.media_url.match(/^data:[^;]+;base64,(.+)$/);
      if (!base64Match) {
        throw new AppError('Invalid audio format', 400, 'INVALID_FORMAT');
      }
      audioBuffer = Buffer.from(base64Match[1], 'base64');
    } else {
      const audioResponse = await fetch(message.media_url, { signal: AbortSignal.timeout(10000) });
      if (!audioResponse.ok) {
        throw new AppError('Failed to download audio', 500, 'DOWNLOAD_ERROR');
      }
      audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    }

    // Send to OpenAI Whisper
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AppError('OpenAI API key not configured', 500, 'CONFIG_ERROR');
    }

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' }), 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      throw new AppError(`Whisper API error: ${errorText}`, 500, 'WHISPER_ERROR');
    }

    const result = (await whisperResponse.json()) as { text: string };
    const transcription = result.text.trim();

    // Save transcription to message content
    await supabaseAdmin
      .from('whatsapp_messages')
      .update({ content: transcription })
      .eq('id', messageId);

    return NextResponse.json(
      ApiResponseBuilder.success({ transcription }),
      { status: 200 }
    );
  } catch (error) {
    return handleError(error);
  }
}
