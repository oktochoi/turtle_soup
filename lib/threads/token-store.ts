import { createServiceClient } from '@/lib/supabase/admin';
import { THREADS_GRAPH } from './config';
import { decryptSecret, encryptSecret } from './crypto';
import { exchangeLongLivedToken, refreshLongLivedToken } from './oauth';

export type StoredThreadsToken = {
  threadsUserId: string;
  accessToken: string;
  expiresAt: Date | null;
};

function looksLikeNumericUserId(id: string): boolean {
  return /^\d{5,}$/.test(id.trim());
}

/**
 * Threads Graph needs a numeric user id, not @username (e.g. funzip.1.7).
 * Resolve via /me when env has a handle by mistake.
 */
export async function resolveThreadsUserId(
  accessToken: string,
  preferredId?: string | null
): Promise<string> {
  if (preferredId && looksLikeNumericUserId(preferredId)) {
    return preferredId.trim();
  }

  const res = await fetch(
    `${THREADS_GRAPH}/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`
  );
  const json = (await res.json()) as {
    id?: string | number;
    username?: string;
    error?: { message?: string };
  };

  if (!res.ok || json.id == null) {
    throw new Error(
      json.error?.message ||
        'Threads user id를 가져오지 못했습니다. OAuth를 다시 하거나 THREADS_USER_ID에 숫자 id를 넣으세요.'
    );
  }

  return String(json.id);
}

/**
 * Resolve access token: env THREADS_ACCESS_TOKEN, or encrypted DB row.
 * Attempts refresh when near expiry.
 */
export async function getThreadsAccessCredentials(): Promise<StoredThreadsToken> {
  const envToken = process.env.THREADS_ACCESS_TOKEN?.trim();
  const envUserId = process.env.THREADS_USER_ID?.trim();

  if (envToken) {
    const threadsUserId = await resolveThreadsUserId(envToken, envUserId);
    return {
      threadsUserId,
      accessToken: envToken,
      expiresAt: null,
    };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('threads_tokens')
    .select('threads_user_id, access_token_encrypted, expires_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      'No Threads credentials: set THREADS_ACCESS_TOKEN + THREADS_USER_ID, or complete OAuth'
    );
  }

  let accessToken = decryptSecret(data.access_token_encrypted);
  let expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  let threadsUserId = data.threads_user_id;

  // Refresh if expiring within 7 days
  if (expiresAt && expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) {
    try {
      const refreshed = await refreshLongLivedToken(accessToken);
      accessToken = refreshed.access_token;
      const expiresIn = refreshed.expires_in ?? 60 * 24 * 60 * 60;
      expiresAt = new Date(Date.now() + expiresIn * 1000);
      await saveThreadsToken({
        threadsUserId,
        accessToken,
        expiresAt,
      });
    } catch {
      // keep current token; publish may still work
    }
  }

  // Fix username stored as id
  if (!looksLikeNumericUserId(threadsUserId)) {
    threadsUserId = await resolveThreadsUserId(accessToken, null);
    try {
      await saveThreadsToken({
        threadsUserId,
        accessToken,
        expiresAt,
      });
    } catch {
      /* best effort */
    }
  }

  return {
    threadsUserId,
    accessToken,
    expiresAt,
  };
}

export async function saveThreadsToken(args: {
  threadsUserId: string;
  accessToken: string;
  expiresAt?: Date | null;
  scopes?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const encrypted = encryptSecret(args.accessToken);
  const { error } = await supabase.from('threads_tokens').upsert(
    {
      threads_user_id: args.threadsUserId,
      access_token_encrypted: encrypted,
      expires_at: args.expiresAt?.toISOString() ?? null,
      scopes: args.scopes ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'threads_user_id' }
  );
  if (error) throw new Error(`Failed to save Threads token: ${error.message}`);
}

export async function upgradeAndSaveToken(args: {
  shortLivedToken: string;
  userId: string;
}): Promise<void> {
  let token = args.shortLivedToken;
  let expiresAt: Date | null = null;
  try {
    const longLived = await exchangeLongLivedToken(args.shortLivedToken);
    token = longLived.access_token;
    const expiresIn = longLived.expires_in ?? 60 * 24 * 60 * 60;
    expiresAt = new Date(Date.now() + expiresIn * 1000);
  } catch {
    // short-lived still usable briefly
  }

  const numericId = await resolveThreadsUserId(token, args.userId);

  await saveThreadsToken({
    threadsUserId: numericId,
    accessToken: token,
    expiresAt,
  });
}
