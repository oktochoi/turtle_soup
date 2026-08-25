import { createServiceClient } from '@/lib/supabase/admin';
import { decryptSecret, encryptSecret } from './crypto';
import { exchangeLongLivedToken, refreshLongLivedToken } from './oauth';

export type StoredThreadsToken = {
  threadsUserId: string;
  accessToken: string;
  expiresAt: Date | null;
};

/**
 * Resolve access token: env THREADS_ACCESS_TOKEN, or encrypted DB row.
 * Attempts refresh when near expiry.
 */
export async function getThreadsAccessCredentials(): Promise<StoredThreadsToken> {
  const envToken = process.env.THREADS_ACCESS_TOKEN;
  const envUserId = process.env.THREADS_USER_ID;

  if (envToken && envUserId) {
    return {
      threadsUserId: envUserId,
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

  // Refresh if expiring within 7 days
  if (expiresAt && expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) {
    try {
      const refreshed = await refreshLongLivedToken(accessToken);
      accessToken = refreshed.access_token;
      const expiresIn = refreshed.expires_in ?? 60 * 24 * 60 * 60;
      expiresAt = new Date(Date.now() + expiresIn * 1000);
      await saveThreadsToken({
        threadsUserId: data.threads_user_id,
        accessToken,
        expiresAt,
      });
    } catch {
      // keep current token; publish may still work
    }
  }

  return {
    threadsUserId: data.threads_user_id,
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
  await saveThreadsToken({
    threadsUserId: String(args.userId),
    accessToken: token,
    expiresAt,
  });
}
