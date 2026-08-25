import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAuth } from '@/lib/auth/route-secrets';
import { buildAuthorizeUrl, createOAuthState } from '@/lib/threads/oauth';

export const runtime = 'nodejs';

/**
 * Start Threads OAuth. Authorization: Bearer ADMIN_SECRET
 * Returns { url } to open in browser.
 */
export async function POST(request: NextRequest) {
  const denied = assertAdminAuth(request);
  if (denied) return denied;

  try {
    const state = createOAuthState();
    const url = buildAuthorizeUrl(state);
    return NextResponse.json({ url, stateIssued: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
