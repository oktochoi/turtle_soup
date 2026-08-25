import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCodeForToken,
  verifyOAuthState,
} from '@/lib/threads/oauth';
import { upgradeAndSaveToken } from '@/lib/threads/token-store';

export const runtime = 'nodejs';

/**
 * Meta Threads OAuth callback.
 * Exchanges authorization code → access token (never logs the token).
 */
export async function GET(request: NextRequest) {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      return NextResponse.redirect(
        `${site}/ko?threads_oauth=error&reason=${encodeURIComponent(errorDescription || error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(`${site}/ko?threads_oauth=missing_code`);
    }

    if (!verifyOAuthState(state)) {
      return NextResponse.redirect(`${site}/ko?threads_oauth=invalid_state`);
    }

    const token = await exchangeCodeForToken(code);
    const userId = String(token.user_id || '');
    if (!userId) {
      return NextResponse.redirect(`${site}/ko?threads_oauth=missing_user`);
    }

    await upgradeAndSaveToken({
      shortLivedToken: token.access_token,
      userId,
    });

    // Also helpful: remind to set env copies for Vercel
    return NextResponse.redirect(
      `${site}/ko?threads_oauth=ok&user_id=${encodeURIComponent(userId)}`
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'oauth_failed';
    return NextResponse.redirect(
      `${site}/ko?threads_oauth=error&reason=${encodeURIComponent(message)}`
    );
  }
}
