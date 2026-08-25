import { createServiceClient } from '@/lib/supabase/admin';
import { fetchRecentProblems, isDuplicateCandidate } from './duplicate';
import { formatThreadsPost, validateThreadsFormat } from './format';
import { generatePuzzleCandidates } from './generate';
import { judgePuzzleCandidate } from './judge';
import type { BatchPipelineResult, PerformanceSummary, PuzzleCandidate } from './types';

const AI_AUTHOR = '바다거북스프 AI';
const AI_TAGS = ['바다거북 스프', 'Threads', 'AI', '검수대기'];

/** Static defaults — skip heavy Threads analytics on Hobby (10s limit). */
const FAST_PERFORMANCE: PerformanceSummary = {
  strongPatterns: ['짧은 표면 + 한 가지 착각 반전', '예/아니요로 파고들 수 있는 구조'],
  weakPatterns: ['추리소설 톤', '감동 사연', '꿈/촬영 결말'],
  highReplyStructures: ['왜?가 선명한 기묘한 행동'],
  highShareStructures: [],
  repeatedThemes: [],
  avoidThemes: ['꿈이었다', '영화 촬영', '사람이 아니었다'],
  recommendedDifficulty: 'medium',
  sampleNotes: ['fast path'],
};

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

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('problem insert returned no id');

  try {
    await supabase.from('puzzle_generation_logs').insert({
      status: 'pending_review',
      problem_id: data.id,
      judge_score: judgeScore,
      detail: {
        title: candidate.title,
        coreTrick: candidate.coreTrick,
        place: candidate.place,
        fastPath: true,
      },
    });
  } catch {
    /* optional */
  }

  return data.id;
}

/**
 * One Groq call + local checks. Optimized for Vercel Hobby ~10s timeout.
 * Optional second Groq judge only if GROQ_JUDGE_ENABLED=true (Pro / longer timeout).
 */
export async function runPuzzleGenerationPipeline(options?: {
  batchSize?: number;
  exploreChance?: number;
}): Promise<BatchPipelineResult> {
  const exploreChance = options?.exploreChance ?? 0.25;
  const useJudge = process.env.GROQ_JUDGE_ENABLED === 'true';

  const recent = await fetchRecentProblems(12);
  const performance = FAST_PERFORMANCE;
  const explore = Math.random() < exploreChance;

  try {
    const candidates = await generatePuzzleCandidates({
      recent,
      performance,
      explore,
    });
    const c = candidates[0];
    if (!c) {
      return { ok: false, saved: [], attempts: 1, error: '후보 없음' };
    }

    const dup = isDuplicateCandidate(c, recent);
    if (dup.duplicate) {
      return {
        ok: false,
        saved: [],
        attempts: 1,
        error: `중복: ${dup.reason || '유사 문제'}`,
      };
    }

    const threadsText = formatThreadsPost(c.title, c.content);
    const fmtErr = validateThreadsFormat(threadsText);
    if (fmtErr) {
      return { ok: false, saved: [], attempts: 1, error: fmtErr };
    }

    let judgeScore = 8;
    if (useJudge) {
      const judgment = await judgePuzzleCandidate({ candidate: c, recent });
      if (!judgment.pass) {
        return {
          ok: false,
          saved: [],
          attempts: 1,
          error: `심사 미통과 (score=${judgment.score})`,
        };
      }
      judgeScore = judgment.score;
    }

    const problemId = await savePendingProblem(c, judgeScore);
    return {
      ok: true,
      saved: [{ problemId, title: c.title, judgeScore }],
      attempts: 1,
      count: 1,
    };
  } catch (e) {
    const lastError = e instanceof Error ? e.message : String(e);
    try {
      const supabase = createServiceClient();
      await supabase.from('puzzle_generation_logs').insert({
        status: 'error',
        detail: { error: lastError },
      });
    } catch {
      /* ignore */
    }
    return { ok: false, saved: [], attempts: 1, error: lastError };
  }
}

export type PipelineResult = BatchPipelineResult;
