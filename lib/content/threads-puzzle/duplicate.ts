import { createServiceClient } from '@/lib/supabase/admin';
import type { PuzzleCandidate, RecentProblemBrief } from './types';

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\uac00-\ud7a3a-z0-9]/gi, '');
}

function tokenSet(s: string): Set<string> {
  const n = normalize(s);
  const set = new Set<string>();
  for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export async function fetchRecentProblems(limit = 40): Promise<RecentProblemBrief[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('problems')
    .select('title, content, answer, explanation, tags')
    .eq('type', 'soup')
    .in('status', ['published', 'featured', 'pending'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load recent problems: ${error.message}`);

  return (data || []).map((p) => ({
    title: p.title,
    content: p.content,
    answer: p.answer,
    coreTrick: (p.explanation || '').slice(0, 120) || null,
  }));
}

export function isDuplicateCandidate(
  candidate: PuzzleCandidate,
  recent: RecentProblemBrief[]
): { duplicate: boolean; reason?: string } {
  const cTitle = tokenSet(candidate.title);
  const cContent = tokenSet(candidate.content);
  const cAnswer = tokenSet(candidate.answer);
  const cTrick = normalize(candidate.coreTrick);

  for (const r of recent) {
    const titleSim = jaccard(cTitle, tokenSet(r.title));
    const contentSim = jaccard(cContent, tokenSet(r.content));
    const answerSim = jaccard(cAnswer, tokenSet(r.answer));
    const trickHit =
      cTrick.length >= 8 &&
      cTrick !== '착각반전' &&
      (normalize(r.answer).includes(cTrick.slice(0, 12)) ||
        (r.coreTrick &&
          normalize(r.coreTrick).length >= 8 &&
          normalize(r.coreTrick).includes(cTrick.slice(0, 10))));

    if (titleSim >= 0.72) {
      return { duplicate: true, reason: `제목이 기존 문제와 유사: ${r.title}` };
    }
    if (contentSim >= 0.55 && answerSim >= 0.45) {
      return { duplicate: true, reason: `본문·정답 구조가 기존 문제와 유사: ${r.title}` };
    }
    if (answerSim >= 0.7) {
      return { duplicate: true, reason: `정답이 기존 문제와 거의 동일: ${r.title}` };
    }
    if (trickHit && contentSim >= 0.35) {
      return { duplicate: true, reason: `핵심 트릭이 기존 문제와 겹침: ${r.title}` };
    }
  }

  return { duplicate: false };
}
