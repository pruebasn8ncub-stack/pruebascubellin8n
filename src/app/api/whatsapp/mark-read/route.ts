/**
 * POST /api/whatsapp/mark-read
 *
 * Resets the unread message counter for a conversation.
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

const markReadSchema = z.object({
  conversationId: z.string().uuid(),
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
    const { conversationId } = markReadSchema.parse(body);

    const { error } = await supabaseAdmin
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);

    if (error) {
      throw new AppError('Failed to mark conversation as read', 500, 'DATABASE_ERROR');
    }

    return NextResponse.json(
      ApiResponseBuilder.success({ success: true, conversationId }),
      { status: 200 }
    );
  } catch (error) {
    return handleError(error);
  }
}
