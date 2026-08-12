import { getEmbedding, cosineSimilarity } from '@/lib/ai-analyzer';
import { lexicalOverlap } from './normalize';
import type { CaseKnowledge, RetrievedItem } from './types';

const embCache = new Map<string, Float32Array>();

async function embed(text: string): Promise<Float32Array | null> {
  const key = text.trim().toLowerCase();
  if (!key) return null;
  const hit = embCache.get(key);
  if (hit) return hit;
  try {
    const v = await getEmbedding(text);
    if (embCache.size > 500) {
      const first = embCache.keys().next().value;
      if (first) embCache.delete(first);
    }
    embCache.set(key, v);
    return v;
  } catch {
    return null;
  }
}

export async function similarity(a: string, b: string): Promise<number> {
  if (!a.trim() || !b.trim()) return 0;
  const lex = lexicalOverlap(a, b);
  const [va, vb] = await Promise.all([embed(a), embed(b)]);
  if (!va || !vb) return lex;
  const cos = cosineSimilarity(va, vb);
  // Blend so paraphrases don't collapse to 0 when embeddings are weak
  return Math.max(cos, lex * 0.92, cos * 0.7 + lex * 0.3);
}

/**
 * Embedding = retrieval only. Returns top knowledge snippets for the question.
 */
export async function retrieveKnowledge(
  question: string,
  knowledge: CaseKnowledge,
  topK = 5
): Promise<RetrievedItem[]> {
  const candidates: { kind: RetrievedItem['kind']; id: string; text: string }[] = [];

  for (const f of knowledge.facts) {
    candidates.push({ kind: 'fact', id: f.id, text: f.text });
  }
  for (const e of knowledge.entities) {
    candidates.push({ kind: 'entity', id: e.id, text: `${e.name}${e.role ? ` (${e.role})` : ''}` });
  }
  for (const r of knowledge.relations) {
    candidates.push({ kind: 'relation', id: r.id, text: r.text });
  }
  for (const b of knowledge.beliefs) {
    candidates.push({ kind: 'belief', id: b.id, text: b.text });
  }
  for (const c of knowledge.causes) {
    candidates.push({ kind: 'cause', id: c.id, text: c.text });
  }
  for (const ev of knowledge.events) {
    candidates.push({ kind: 'event', id: ev.id, text: ev.text });
  }
  for (const s of knowledge.states) {
    candidates.push({ kind: 'state', id: s.id, text: s.text });
  }

  // Always include raw answer chunks
  if (knowledge.answer.trim()) {
    candidates.push({ kind: 'fact', id: 'answer_full', text: knowledge.answer });
  }

  const scored: RetrievedItem[] = [];
  for (const c of candidates) {
    const score = await similarity(question, c.text);
    scored.push({ ...c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export async function bestChunkSimilarity(query: string, document: string): Promise<number> {
  const chunks = document
    .split(/(?<=[.!?。！？\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
  if (!chunks.length) return similarity(query, document);
  let best = 0;
  // Also compare against full text
  best = Math.max(best, await similarity(query, document));
  for (const ch of chunks) {
    best = Math.max(best, await similarity(query, ch));
  }
  // Sliding windows of ~40 chars for long solutions
  if (document.length > 60) {
    const step = 30;
    for (let i = 0; i < document.length; i += step) {
      const win = document.slice(i, i + 50);
      if (win.trim().length < 8) continue;
      best = Math.max(best, await similarity(query, win));
    }
  }
  return best;
}
