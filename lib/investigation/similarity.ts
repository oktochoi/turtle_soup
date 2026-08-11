import { getEmbedding, cosineSimilarity } from '@/lib/ai-analyzer';

const cache = new Map<string, Float32Array>();

export async function embedCached(text: string): Promise<Float32Array> {
  const key = text.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const vec = await getEmbedding(text);
  if (cache.size > 400) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, vec);
  return vec;
}

export async function textSimilarity(a: string, b: string): Promise<number> {
  if (!a.trim() || !b.trim()) return 0;
  const [va, vb] = await Promise.all([embedCached(a), embedCached(b)]);
  return cosineSimilarity(va, vb);
}

export async function bestSimilarity(
  query: string,
  candidates: string[]
): Promise<{ index: number; score: number }> {
  if (!candidates.length) return { index: -1, score: 0 };
  const q = await embedCached(query);
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < candidates.length; i++) {
    const v = await embedCached(candidates[i]);
    const s = cosineSimilarity(q, v);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return { index: best, score: bestScore };
}
