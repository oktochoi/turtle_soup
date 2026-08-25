import { createServiceClient } from '@/lib/supabase/admin';
import { THREADS_GRAPH } from './config';
import { getThreadsAccessCredentials } from './token-store';

export type ThreadsInsightMetrics = {
  views?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
  shares?: number;
  raw: Record<string, unknown>;
};

const METRIC_CANDIDATES = ['views', 'likes', 'replies', 'reposts', 'quotes', 'shares'] as const;

/**
 * Fetch post insights. Skips unsupported metrics instead of failing the whole call.
 */
export async function fetchThreadsInsights(
  mediaId: string
): Promise<ThreadsInsightMetrics> {
  const { accessToken } = await getThreadsAccessCredentials();
  const metrics: ThreadsInsightMetrics = { raw: {} };

  // Try batch first
  try {
    const url = `${THREADS_GRAPH}/${mediaId}/insights?metric=${METRIC_CANDIDATES.join(',')}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const json = (await res.json()) as {
      data?: Array<{ name: string; values?: Array<{ value: number }> }>;
      error?: { message?: string; code?: number };
    };

    if (res.ok && json.data) {
      for (const row of json.data) {
        const value = row.values?.[0]?.value;
        if (typeof value === 'number' && METRIC_CANDIDATES.includes(row.name as (typeof METRIC_CANDIDATES)[number])) {
          (metrics as Record<string, unknown>)[row.name] = value;
        }
      }
      metrics.raw = json as unknown as Record<string, unknown>;
      return metrics;
    }
  } catch {
    /* fall through to per-metric */
  }

  // Per-metric fallback
  for (const metric of METRIC_CANDIDATES) {
    try {
      const url = `${THREADS_GRAPH}/${mediaId}/insights?metric=${metric}&access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = (await res.json()) as {
        data?: Array<{ name: string; values?: Array<{ value: number }> }>;
      };
      const value = json.data?.[0]?.values?.[0]?.value;
      if (typeof value === 'number') {
        (metrics as Record<string, unknown>)[metric] = value;
        metrics.raw[metric] = value;
      }
    } catch {
      /* skip unsupported */
    }
  }

  return metrics;
}

export async function collectDueInsights(): Promise<{
  collected: number;
  errors: string[];
}> {
  const supabase = createServiceClient();
  const now = Date.now();
  const windows = [1, 6, 24, 72];

  const { data: posts, error } = await supabase
    .from('threads_posts')
    .select('id, threads_media_id, published_at')
    .order('published_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  let collected = 0;
  const errors: string[] = [];

  for (const post of posts || []) {
    const publishedAt = new Date(post.published_at).getTime();
    const hoursSince = Math.floor((now - publishedAt) / (60 * 60 * 1000));

    for (const window of windows) {
      // Collect when we've passed the window, within +3h slack, and not already collected for that window
      if (hoursSince < window || hoursSince > window + 3) continue;

      const { data: existing } = await supabase
        .from('threads_insights')
        .select('id')
        .eq('threads_post_id', post.id)
        .eq('hours_since_publish', window)
        .maybeSingle();

      if (existing) continue;

      try {
        const m = await fetchThreadsInsights(post.threads_media_id);
        const { error: insertError } = await supabase.from('threads_insights').insert({
          threads_post_id: post.id,
          hours_since_publish: window,
          views: m.views ?? null,
          likes: m.likes ?? null,
          replies: m.replies ?? null,
          reposts: m.reposts ?? null,
          quotes: m.quotes ?? null,
          shares: m.shares ?? null,
          raw: m.raw,
          collected_at: new Date().toISOString(),
        });
        if (insertError) {
          errors.push(`${post.threads_media_id}@${window}h: ${insertError.message}`);
        } else {
          collected++;
        }
      } catch (e) {
        errors.push(
          `${post.threads_media_id}@${window}h: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  return { collected, errors };
}
