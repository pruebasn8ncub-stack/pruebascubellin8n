/**
 * GET /api/whatsapp/conversations
 *
 * Returns paginated WhatsApp conversations ordered by most recent message,
 * along with global bot settings.
 * Requires a valid Supabase Bearer token.
 * Allowed roles: admin, receptionist.
 *
 * Query params:
 *   search  — filter by contact_name or phone_number (optional)
 *   page    — 1-based page number (default: 1)
 *   limit   — items per page (default: 50)
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

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10))
    );
    const offset = (page - 1) * limit;

    // Build conversations query
    let query = supabaseAdmin
      .from('whatsapp_conversations')
      .select('*', { count: 'exact' })
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search.trim()) {
      // Sanitize search: remove characters that could manipulate PostgREST filters
      const sanitized = search.trim().replace(/[%_(),."'\\]/g, '');
      if (sanitized) {
        query = query.or(
          `contact_name.ilike.%${sanitized}%,phone_number.ilike.%${sanitized}%`
        );
      }
    }

    const [conversationsResult, botSettingsResult] = await Promise.all([
      query,
      supabaseAdmin
        .from('whatsapp_bot_settings')
        .select('*')
        .limit(1)
        .single(),
    ]);

    const { data: conversations, error: convError, count } = conversationsResult;
    const { data: botSettings } = botSettingsResult;

    if (convError) {
      return NextResponse.json(
        ApiResponseBuilder.error('Failed to fetch conversations', 'DATABASE_ERROR', 500),
        { status: 500 }
      );
    }

    return NextResponse.json(
      ApiResponseBuilder.success(
        {
          conversations: conversations ?? [],
          botSettings: botSettings ?? null,
          total: count ?? 0,
        },
        { page, total: count ?? 0 }
      ),
      { status: 200 }
    );
  } catch (error) {
    return handleError(error);
  }
}
