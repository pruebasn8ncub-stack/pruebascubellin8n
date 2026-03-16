/**
 * GET /api/whatsapp/messages/[id]
 *
 * Returns messages for a given conversation, newest-first with cursor-based
 * pagination via the `before` ISO timestamp parameter.
 * Requires a valid Supabase Bearer token.
 * Allowed roles: admin, receptionist.
 *
 * Route param:
 *   id     — conversation UUID
 *
 * Query params:
 *   before — ISO 8601 timestamp; return only messages older than this (optional)
 *   limit  — number of messages to return (default: 50, max: 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ApiResponseBuilder } from '@/lib/api-response';
import { handleError } from '@/lib/error-handler';

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
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

    const conversationId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const before = searchParams.get('before') ?? '';
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10))
    );

    let query = supabaseAdmin
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before.trim()) {
      query = query.lt('created_at', before.trim());
    }

    const { data: messages, error } = await query;

    if (error) {
      return NextResponse.json(
        ApiResponseBuilder.error('Failed to fetch messages', 'DATABASE_ERROR', 500),
        { status: 500 }
      );
    }

    // Reverse to return in ascending chronological order for the client
    const chronological = (messages ?? []).reverse();

    return NextResponse.json(
      ApiResponseBuilder.success({
        messages: chronological,
        hasMore: (messages ?? []).length === limit,
      }),
      { status: 200 }
    );
  } catch (error) {
    return handleError(error);
  }
}
