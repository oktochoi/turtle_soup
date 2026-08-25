import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Meta Threads data deletion callback (GDPR-style).
 * Acknowledge deletion requests; purge stored Threads tokens.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      await request.json().catch(() => null);
    } else {
      await request.formData().catch(() => null);
    }

    try {
      const { createServiceClient } = await import('@/lib/supabase/admin');
      const supabase = createServiceClient();
      await supabase.from('threads_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // Optionally anonymize posts text
      await supabase
        .from('threads_posts')
        .update({ post_text: null })
        .not('id', 'is', null);
    } catch {
      /* ignore */
    }

    const confirmationCode = `threads_del_${Date.now()}`;
    const site =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';

    return NextResponse.json({
      url: `${site}/auth/threads/delete?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch {
    return NextResponse.json({
      url: 'https://turtle-soup-rust.vercel.app/auth/threads/delete',
      confirmation_code: `threads_del_${Date.now()}`,
    });
  }
}

export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('code');
  return NextResponse.json({
    status: 'ok',
    message: 'Threads data deletion endpoint',
    confirmation_code: code,
  });
}
