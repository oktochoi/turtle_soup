import { createServiceClient } from '@/lib/supabase/admin';
import { formatThreadsPost, validateThreadsFormat } from '@/lib/content/threads-puzzle/format';
import { publishThreadsText } from '@/lib/threads/publish';

export const AI_PUZZLE_AUTHOR = '바다거북스프 AI';

export type AiPuzzleEdits = {
  title?: string;
  content?: string;
  answer?: string;
  explanation?: string | null;
  difficulty?: string;
};

async function loadPendingAiProblem(problemId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('problems')
    .select('id, title, content, answer, explanation, difficulty, status, author, tags')
    .eq('id', problemId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('문제를 찾을 수 없습니다');
  return data;
}

function isAiPuzzle(row: { author?: string | null; tags?: string[] | null }): boolean {
  if (row.author === AI_PUZZLE_AUTHOR) return true;
  const tags = row.tags || [];
  return tags.includes('AI') || tags.includes('Threads');
}

export async function updateAiPuzzleDraft(problemId: string, edits: AiPuzzleEdits) {
  const row = await loadPendingAiProblem(problemId);
  if (!isAiPuzzle(row)) throw new Error('AI 생성 문제가 아닙니다');
  if (row.status !== 'pending') throw new Error('검수 대기(pending) 상태만 수정할 수 있습니다');

  const patch: Record<string, unknown> = {};
  if (edits.title !== undefined) patch.title = edits.title.trim();
  if (edits.content !== undefined) patch.content = edits.content.trim();
  if (edits.answer !== undefined) patch.answer = edits.answer.trim();
  if (edits.explanation !== undefined) patch.explanation = edits.explanation;
  if (edits.difficulty !== undefined) patch.difficulty = edits.difficulty;

  if (!Object.keys(patch).length) return row;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('problems')
    .update(patch)
    .eq('id', problemId)
    .select('id, title, content, answer, explanation, difficulty, status')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function rejectAiPuzzle(problemId: string) {
  const row = await loadPendingAiProblem(problemId);
  if (!isAiPuzzle(row)) throw new Error('AI 생성 문제가 아닙니다');
  if (row.status !== 'pending') throw new Error('검수 대기 상태만 거절할 수 있습니다');

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('problems')
    .update({ status: 'archived' })
    .eq('id', problemId);

  if (error) throw new Error(error.message);
  return { problemId, status: 'archived' as const };
}

/**
 * Accept = site publish + optional Threads post.
 */
export async function approveAiPuzzle(
  problemId: string,
  options?: {
    edits?: AiPuzzleEdits;
    publishThreads?: boolean;
  }
) {
  if (options?.edits) {
    await updateAiPuzzleDraft(problemId, options.edits);
  }

  const row = await loadPendingAiProblem(problemId);
  if (!isAiPuzzle(row)) throw new Error('AI 생성 문제가 아닙니다');
  if (row.status !== 'pending') throw new Error('검수 대기 상태만 승인할 수 있습니다');

  const title = row.title as string;
  const content = row.content as string;
  const threadsText = formatThreadsPost(title, content);
  const fmtErr = validateThreadsFormat(threadsText);
  if (fmtErr) throw new Error(`Threads 형식 오류: ${fmtErr}`);

  const supabase = createServiceClient();
  const publishPatch: Record<string, unknown> = {
    status: 'published',
  };

  let updated;
  {
    const withDate = { ...publishPatch, published_at: new Date().toISOString() };
    const first = await supabase
      .from('problems')
      .update(withDate)
      .eq('id', problemId)
      .select('id, title, status')
      .single();

    if (first.error && /published_at|column/i.test(first.error.message)) {
      const second = await supabase
        .from('problems')
        .update(publishPatch)
        .eq('id', problemId)
        .select('id, title, status')
        .single();
      if (second.error) throw new Error(second.error.message);
      updated = second.data;
    } else if (first.error) {
      throw new Error(first.error.message);
    } else {
      updated = first.data;
    }
  }

  let threadsMediaId: string | undefined;
  let permalink: string | null | undefined;
  let threadsError: string | undefined;
  const publishThreads = options?.publishThreads !== false;

  if (publishThreads) {
    try {
      const published = await publishThreadsText(threadsText);
      threadsMediaId = published.mediaId;
      permalink = published.permalink;

      const { error: tpErr } = await supabase.from('threads_posts').insert({
        problem_id: problemId,
        threads_media_id: published.mediaId,
        post_text: threadsText,
        permalink: published.permalink ?? null,
        published_at: new Date().toISOString(),
      });
      if (tpErr) {
        threadsError = `threads_posts 저장 실패: ${tpErr.message}`;
      }
    } catch (e) {
      // Site is already published — don't roll back on Threads failure
      threadsError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    problemId,
    title: updated?.title || title,
    status: 'published' as const,
    threadsMediaId,
    permalink,
    threadsText,
    threadsError,
  };
}
