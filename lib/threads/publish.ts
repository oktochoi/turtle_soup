import { THREADS_GRAPH } from './config';
import { getThreadsAccessCredentials } from './token-store';

const MAX_THREADS_CHARS = 500;

export function truncateThreadsText(text: string): string {
  if (text.length <= MAX_THREADS_CHARS) return text;
  // Keep ending "왜 그랬을까?" if present
  const ending = '왜 그랬을까?';
  if (text.trimEnd().endsWith(ending)) {
    const bodyBudget = MAX_THREADS_CHARS - ending.length - 2;
    const head = text.slice(0, bodyBudget).replace(/\s+\S*$/, '').trimEnd();
    return `${head}\n\n${ending}`;
  }
  return text.slice(0, MAX_THREADS_CHARS - 1) + '…';
}

export async function publishThreadsText(text: string): Promise<{
  mediaId: string;
  permalink?: string | null;
}> {
  const { accessToken, threadsUserId } = await getThreadsAccessCredentials();
  const body = truncateThreadsText(text.trim());

  // 1) Create TEXT container
  const createParams = new URLSearchParams({
    media_type: 'TEXT',
    text: body,
    access_token: accessToken,
  });
  const createRes = await fetch(`${THREADS_GRAPH}/${threadsUserId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: createParams,
  });
  const createJson = (await createRes.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!createRes.ok || !createJson.id) {
    throw new Error(createJson.error?.message || `Threads container create failed (${createRes.status})`);
  }

  // 2) Publish
  const publishParams = new URLSearchParams({
    creation_id: createJson.id,
    access_token: accessToken,
  });
  const publishRes = await fetch(`${THREADS_GRAPH}/${threadsUserId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: publishParams,
  });
  const publishJson = (await publishRes.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!publishRes.ok || !publishJson.id) {
    throw new Error(publishJson.error?.message || `Threads publish failed (${publishRes.status})`);
  }

  // Optional permalink
  let permalink: string | null = null;
  try {
    const fieldsRes = await fetch(
      `${THREADS_GRAPH}/${publishJson.id}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`
    );
    if (fieldsRes.ok) {
      const fieldsJson = (await fieldsRes.json()) as { permalink?: string };
      permalink = fieldsJson.permalink ?? null;
    }
  } catch {
    /* optional */
  }

  return { mediaId: publishJson.id, permalink };
}
