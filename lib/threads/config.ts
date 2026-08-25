export const THREADS_GRAPH = 'https://graph.threads.net/v1.0';
export const THREADS_OAUTH_AUTHORIZE = 'https://threads.net/oauth/authorize';
export const THREADS_OAUTH_TOKEN = 'https://graph.threads.net/oauth/access_token';
export const THREADS_LONG_LIVED =
  'https://graph.threads.net/access_token';

export const THREADS_SCOPES = [
  'threads_basic',
  'threads_content_publish',
  'threads_manage_insights',
].join(',');

export function getThreadsRedirectUri(): string {
  return (
    process.env.THREADS_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app'}/auth/threads/callback`
  );
}

export function getThreadsAppId(): string {
  const id = process.env.THREADS_APP_ID;
  if (!id) throw new Error('THREADS_APP_ID is not configured');
  return id;
}

export function getThreadsAppSecret(): string {
  const s = process.env.THREADS_APP_SECRET;
  if (!s) throw new Error('THREADS_APP_SECRET is not configured');
  return s;
}
