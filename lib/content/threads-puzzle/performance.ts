import { createServiceClient } from '@/lib/supabase/admin';
import type { PerformanceSummary, PuzzleDifficulty } from './types';

/**
 * Summarize recent Threads insights for the next generation prompt.
 * Prefers replies ratio with a views floor (avoid tiny-sample noise).
 */
export async function buildPerformanceSummary(): Promise<PerformanceSummary> {
  const supabase = createServiceClient();

  const { data: posts } = await supabase
    .from('threads_posts')
    .select('id, problem_id, published_at')
    .order('published_at', { ascending: false })
    .limit(20);

  if (!posts?.length) {
    return {
      strongPatterns: [
        '익숙한 일상 장소에서 반복되는 이상한 행동',
        '숨겨진 개인적 사정이 행동을 설명하는 구조',
        '3~6문장 길이의 짧은 미스터리 장면',
      ],
      weakPatterns: ['말장난 반전', '꿈/촬영이었다 류의 편리한 결말'],
      highReplyStructures: ['행동이 명확하고 이유가 궁금한 구조'],
      highShareStructures: ['제목이 분위기를 만들되 정답을 드러내지 않는 경우'],
      repeatedThemes: [],
      avoidThemes: ['꿈이었다', '영화 촬영이었다', '사실 사람이 아니었다'],
      recommendedDifficulty: 'medium',
      sampleNotes: ['아직 Threads 성과 데이터가 없습니다. 기본 원칙으로 생성합니다.'],
    };
  }

  type Scored = {
    title: string;
    difficulty: string;
    views: number;
    replies: number;
    reposts: number;
    replyRate: number;
    contentLen: number;
  };

  const scored: Scored[] = [];
  const themes: string[] = [];

  for (const p of posts) {
    const { data: insights } = await supabase
      .from('threads_insights')
      .select('hours_since_publish, views, likes, replies, reposts, quotes, shares')
      .eq('threads_post_id', p.id);

    const list = insights || [];
    const snap =
      list.find((i) => i.hours_since_publish === 24) ||
      [...list].sort((a, b) => b.hours_since_publish - a.hours_since_publish)[0];
    if (!snap) continue;

    let title = '(untitled)';
    let difficulty = 'medium';
    let contentLen = 180;

    if (p.problem_id) {
      const { data: problem } = await supabase
        .from('problems')
        .select('title, content, difficulty')
        .eq('id', p.problem_id)
        .maybeSingle();
      if (problem) {
        title = problem.title || title;
        difficulty = problem.difficulty || difficulty;
        contentLen = (problem.content || '').length;
        themes.push(title);
      }
    }

    const views = snap.views ?? 0;
    const replies = snap.replies ?? 0;
    const reposts = snap.reposts ?? 0;
    const replyRate = views >= 30 ? replies / views : 0;

    scored.push({
      title,
      difficulty,
      views,
      replies,
      reposts,
      replyRate,
      contentLen,
    });
  }

  if (!scored.length) {
    return {
      strongPatterns: ['스토리형 미스터리 + 숨겨진 사정'],
      weakPatterns: ['말장난', '꿈/촬영 결말'],
      highReplyStructures: ['추리 댓글을 유도하는 열린 행동'],
      highShareStructures: [],
      repeatedThemes: themes.slice(0, 8),
      avoidThemes: themes.slice(0, 5),
      recommendedDifficulty: 'medium',
      sampleNotes: [`포스트 ${posts.length}개 있으나 insight 스냅샷이 아직 없습니다.`],
    };
  }

  const byReply = [...scored].sort((a, b) => b.replyRate - a.replyRate || b.views - a.views);
  const byViews = [...scored].sort((a, b) => b.views - a.views);
  const byShare = [...scored].sort((a, b) => b.reposts - a.reposts);
  const topReply = byReply.filter((s) => s.views >= 30).slice(0, 3);
  const bottom = [...scored].sort((a, b) => a.views - b.views).slice(0, 3);

  const diffCounts: Record<string, number> = {};
  for (const s of byViews.slice(0, 5)) {
    diffCounts[s.difficulty] = (diffCounts[s.difficulty] || 0) + 1;
  }
  const recommendedDifficulty = (Object.entries(diffCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    'medium') as PuzzleDifficulty;

  const avgLen =
    topReply.reduce((s, x) => s + x.contentLen, 0) / Math.max(1, topReply.length) || 180;

  return {
    strongPatterns: [
      topReply.length
        ? `댓글 비율이 높은 글: ${topReply.map((t) => t.title).join(', ')}`
        : '표본이 적어 기본 스토리형 원칙을 따릅니다',
      `반응이 좋은 본문 길이 근처: 약 ${Math.round(avgLen)}자`,
      '익숙한 장소 + 반복/이상한 행동 + 숨겨진 사정 구조가 유리',
    ],
    weakPatterns: bottom.map(
      (b) => `반응 약함: ${b.title} (views=${b.views}, replies=${b.replies})`
    ),
    highReplyStructures: [
      '행동이 구체적이고 이유가 한 가지로 수렴하는 구조',
      '정답을 몰라도 추측 댓글을 달기 쉬운 열린 여지',
    ],
    highShareStructures: byShare.slice(0, 2).map((s) => `공유 많음: ${s.title}`),
    repeatedThemes: themes.slice(0, 8),
    avoidThemes: themes.slice(0, 5),
    recommendedDifficulty,
    sampleNotes: [
      `최근 포스트 ${posts.length}개 · 성과 ${scored.length}개 분석`,
      `조회 상위: ${byViews
        .slice(0, 3)
        .map((v) => `${v.title}(${v.views})`)
        .join(', ')}`,
    ],
  };
}
