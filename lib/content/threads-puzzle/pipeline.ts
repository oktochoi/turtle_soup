import { createServiceClient } from '@/lib/supabase/admin';
import { fetchRecentProblems, isDuplicateCandidate } from './duplicate';
import { formatThreadsPost, validateThreadsFormat } from './format';
import { generatePuzzleCandidates } from './generate';
import { judgePuzzleCandidate } from './judge';
import { buildPerformanceSummary } from './performance';
import type { BatchPipelineResult, PuzzleCandidate } from './types';

const MAX_ATTEMPTS = 3;
const AI_AUTHOR = '바다거북스프 AI';
const AI_TAGS = ['바다거북 스프', 'Threads', 'AI', '검수대기'];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function savePendingProblem(
  candidate: PuzzleCandidate,
  judgeScore: number
): Promise<string> {
  const supabase = createServiceClient();

  const row = {
    title: candidate.title,
    content: candidate.content,
    answer: candidate.answer,
    explanation: candidate.explanation || candidate.whyInteresting || null,
    difficulty: candidate.difficulty,
    tags: AI_TAGS,
    lang: 'ko',
    type: 'soup',
    status: 'pending',
    author: AI_AUTHOR,
  };

  const { data, error } = await supabase.from('problems').insert(row).select('id').single();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id) throw new Error('problem insert returned no id');

  await logGeneration({
    status: 'pending_review',
    problemId: data.id,
    score: judgeScore,
    detail: {
      title: candidate.title,
      coreTrick: candidate.coreTrick,
      place: candidate.place,
    },
  });

  return data.id;
}

async function logGeneration(args: {
  status: string;
  problemId?: string;
  score?: number;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('puzzle_generation_logs').insert({
      status: args.status,
      problem_id: args.problemId ?? null,
      judge_score: args.score ?? null,
      detail: args.detail ?? {},
    });
  } catch {
    /* optional */
  }
}

/**
 * Generate one pending puzzle for admin review.
 * `batchSize` is ignored (always 1) — kept for API compat.
 */
export async function runPuzzleGenerationPipeline(options?: {
  batchSize?: number;
  exploreChance?: number;
}): Promise<BatchPipelineResult> {
  const exploreChance = options?.exploreChance ?? 0.25;
  const recent = await fetchRecentProblems(20);
  const performance = await buildPerformanceSummary();
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(5000);
    const explore = Math.random() < exploreChance;

    try {
      const candidates = await generatePuzzleCandidates({
        recent,
        performance,
        explore,
      });
      const c = candidates[0];
      if (!c) {
        lastError = '후보 없음';
        continue;
      }

      const dup = isDuplicateCandidate(c, recent);
      if (dup.duplicate) {
        lastError = `중복: ${dup.reason || ''}`;
        continue;
      }

      const threadsText = formatThreadsPost(c.title, c.content);
      const fmtErr = validateThreadsFormat(threadsText);
      if (fmtErr) {
        lastError = fmtErr;
        continue;
      }

      await sleep(1500);
      const judgment = await judgePuzzleCandidate({ candidate: c, recent });
      if (!judgment.pass) {
        lastError = `심사 미통과 (score=${judgment.score})`;
        continue;
      }

      const problemId = await savePendingProblem(c, judgment.score);
      return {
        ok: true,
        saved: [{ problemId, title: c.title, judgeScore: judgment.score }],
        attempts: attempt,
        count: 1,
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      await logGeneration({
        status: 'error',
        detail: { attempt, error: lastError },
      });
      if (/rate_limit|TPM|Request too large|413|429/i.test(lastError)) {
        await sleep(12_000);
      }
    }
  }

  return {
    ok: false,
    saved: [],
    attempts: MAX_ATTEMPTS,
    error: lastError || '문제 1개 생성 실패',
  };
}

export type PipelineResult = BatchPipelineResult;
