import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Meta Threads deauthorize callback.
 * Called when a user removes the app — acknowledge and optionally purge tokens.
 */
export async function POST(request: NextRequest) {
  try {
    // Meta may send signed_request; we acknowledge without exposing secrets
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      await request.json().catch(() => null);
    } else {
      await request.formData().catch(() => null);
    }

    // Best-effort: clear all stored tokens if service role available
    try {
      const { createServiceClient } = await import('@/lib/supabase/admin');
      const supabase = createServiceClient();
      await supabase.from('threads_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch {
      /* env may not be ready */
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'threads/deauthorize' });
}
