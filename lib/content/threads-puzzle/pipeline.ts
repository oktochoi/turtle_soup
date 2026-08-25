import { createServiceClient } from '@/lib/supabase/admin';
import { fetchRecentProblems, isDuplicateCandidate } from './duplicate';
import { formatThreadsPost, validateThreadsFormat } from './format';
import { generatePuzzleCandidates } from './generate';
import { judgePuzzleCandidate } from './judge';
import { buildPerformanceSummary } from './performance';
import type { BatchPipelineResult, PuzzleCandidate } from './types';

const MAX_ROUNDS = 6;
const DEFAULT_BATCH = 5;
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
    /* logging table optional */
  }
}

/**
 * Generate multiple story puzzles → save as pending (not published).
 * Threads publish happens only after admin Accept.
 */
export async function runPuzzleGenerationPipeline(options?: {
  /** How many pending candidates to save (default 5) */
  batchSize?: number;
  exploreChance?: number;
}): Promise<BatchPipelineResult> {
  const target = Math.max(1, Math.min(options?.batchSize ?? DEFAULT_BATCH, 15));
  const exploreChance = options?.exploreChance ?? 0.25;

  // Fewer recent rows → smaller Groq prompts (free tier ~8k TPM)
  const recent = await fetchRecentProblems(20);
  const performance = await buildPerformanceSummary();
  const saved: BatchPipelineResult['saved'] = [];
  const seenTitles = new Set(recent.map((r) => r.title.trim().toLowerCase()));

  let rounds = 0;
  let lastError = '';

  while (saved.length < target && rounds < MAX_ROUNDS) {
    rounds++;
    const explore = Math.random() < exploreChance;

    try {
      if (rounds > 1) await sleep(8000);

      const candidates = await generatePuzzleCandidates({
        recent: [
          ...recent,
          ...saved.map((s) => ({
            title: s.title,
            content: '',
            answer: '',
          })),
        ],
        performance,
        explore,
      });

      for (const c of candidates) {
        if (saved.length >= target) break;

        const titleKey = c.title.trim().toLowerCase();
        if (seenTitles.has(titleKey)) continue;

        const dup = isDuplicateCandidate(c, recent);
        if (dup.duplicate) continue;

        const threadsText = formatThreadsPost(c.title, c.content);
        const fmtErr = validateThreadsFormat(threadsText);
        if (fmtErr) continue;

        await sleep(2500);
        const judgment = await judgePuzzleCandidate({ candidate: c, recent });
        if (!judgment.pass) continue;

        try {
          const problemId = await savePendingProblem(c, judgment.score);
          seenTitles.add(titleKey);
          saved.push({
            problemId,
            title: c.title,
            judgeScore: judgment.score,
          });
          recent.push({
            title: c.title,
            content: c.content,
            answer: c.answer,
            coreTrick: c.coreTrick,
          });
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      await logGeneration({
        status: 'error',
        detail: { rounds, error: lastError },
      });
      // TPM cooldown then retry next round
      if (/rate_limit|TPM|Request too large|413|429/i.test(lastError)) {
        await sleep(15_000);
      }
    }
  }

  if (!saved.length) {
    return {
      ok: false,
      saved: [],
      attempts: rounds,
      error: lastError || '검수 대기용 후보를 하나도 저장하지 못함',
    };
  }

  return {
    ok: true,
    saved,
    attempts: rounds,
    count: saved.length,
  };
}

/** @deprecated use runPuzzleGenerationPipeline — kept for type compat */
export type PipelineResult = BatchPipelineResult;
