import { createHmac, timingSafeEqual } from 'crypto';
import {
  THREADS_LONG_LIVED,
  THREADS_OAUTH_AUTHORIZE,
  THREADS_OAUTH_TOKEN,
  THREADS_SCOPES,
  getThreadsAppId,
  getThreadsAppSecret,
  getThreadsRedirectUri,
} from './config';

function stateSecret(): string {
  const s = process.env.THREADS_STATE_SECRET;
  if (!s) throw new Error('THREADS_STATE_SECRET is not configured');
  return s;
}

/** Signed OAuth state to prevent CSRF. */
export function createOAuthState(payload: Record<string, string> = {}): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, ts: Date.now() }),
    'utf8'
  ).toString('base64url');
  const sig = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyOAuthState(state: string, maxAgeMs = 15 * 60 * 1000): boolean {
  const [body, sig] = state.split('.');
  if (!body || !sig) return false;
  const expected = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      ts?: number;
    };
    if (!parsed.ts || Date.now() - parsed.ts > maxAgeMs) return false;
  } catch {
    return false;
  }
  return true;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getThreadsAppId(),
    redirect_uri: getThreadsRedirectUri(),
    scope: THREADS_SCOPES,
    response_type: 'code',
    state,
  });
  return `${THREADS_OAUTH_AUTHORIZE}?${params.toString()}`;
}

export type ThreadsTokenResponse = {
  access_token: string;
  user_id?: string | number;
  expires_in?: number;
  token_type?: string;
};

/** Exchange authorization code → short-lived user access token. */
export async function exchangeCodeForToken(code: string): Promise<ThreadsTokenResponse> {
  const body = new URLSearchParams({
    client_id: getThreadsAppId(),
    client_secret: getThreadsAppSecret(),
    grant_type: 'authorization_code',
    redirect_uri: getThreadsRedirectUri(),
    code,
  });

  const res = await fetch(THREADS_OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = (await res.json()) as ThreadsTokenResponse & { error_message?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_message || json.error || `Token exchange failed (${res.status})`);
  }
  return json;
}

/** Exchange short-lived → long-lived token (≈60 days). */
export async function exchangeLongLivedToken(
  shortLivedToken: string
): Promise<ThreadsTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: getThreadsAppSecret(),
    access_token: shortLivedToken,
  });
  const res = await fetch(`${THREADS_LONG_LIVED}?${params.toString()}`);
  const json = (await res.json()) as ThreadsTokenResponse & { error_message?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_message || `Long-lived exchange failed (${res.status})`);
  }
  return json;
}

/** Refresh long-lived token when near expiry. */
export async function refreshLongLivedToken(
  longLivedToken: string
): Promise<ThreadsTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'th_refresh_token',
    access_token: longLivedToken,
  });
  const res = await fetch(`${THREADS_LONG_LIVED}?${params.toString()}`);
  const json = (await res.json()) as ThreadsTokenResponse & { error_message?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_message || `Token refresh failed (${res.status})`);
  }
  return json;
}
