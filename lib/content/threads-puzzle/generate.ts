import { groqPuzzleCompletion, getGroqModel } from '@/lib/groq/client';
import { formatThreadsPost } from './format';
import type { PerformanceSummary, PuzzleCandidate, RecentProblemBrief } from './types';

const SYSTEM = `당신은 한국어 바다거북스프(상황 수수께끼/LTP) 출제자다.

표면(content): 2~5문장의 짧은 기묘한 사실. 소설체·수사체·감동사연 금지.
이면(answer): 독자의 「착각 하나」를 뒤집는 전말. 예/아니요로 재구성 가능해야 함.
금지: 꿈/촬영/사람이아니었다, 고전 복제, 말장난만, 클릭베이트 제목.
submit_turtle_soup 도구로만 제출. content 끝에 "왜 그랬을까?"를 넣지 마라.
난이도 difficulty는 easy, medium, hard 중 하나.`;

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

/** Hard bans only — soft length/style checks are for admin review, not reject. */
function hardBanReason(c: PuzzleCandidate): string | null {
  const blob = `${c.title}\n${c.content}\n${c.answer}`;
  const banned = [
    [/꿈이(었|였)다/, '꿈이었다 결말'],
    [/영화\s*촬영|연극이(었|였)다|게임\s*속이(었|였)다/, '촬영/게임 결말'],
    [/사실\s*.*사람이\s*아니/, '사람이 아니었다 결말'],
    [/99%\s*가?\s*못\s*맞|천재\s*테스트|충격적인\s*반전/, '클릭베이트'],
  ] as const;
  for (const [re, label] of banned) {
    if (re.test(blob)) return label;
  }
  if (!c.title.trim()) return '제목 없음';
  if (c.content.trim().length < 20) return '본문이 너무 짧음';
  if (c.answer.trim().length < 15) return '정답이 너무 짧음';
  return null;
}

function normalizeCandidate(
  raw: Record<string, unknown>,
  fallbackDifficulty: PuzzleCandidate['difficulty']
): { ok: true; candidate: PuzzleCandidate } | { ok: false; reason: string } {
  const difficultyRaw = asString(raw.difficulty).toLowerCase();
  const difficulty = (['easy', 'medium', 'hard'].includes(difficultyRaw)
    ? difficultyRaw
    : fallbackDifficulty) as PuzzleCandidate['difficulty'];

  let content = asString(raw.content).trim().replace(/\s*왜 그랬을까\??\s*$/u, '').trim();
  let title = asString(raw.title).trim();
  let answer = asString(raw.answer).trim();

  // Keep Threads body reasonably short without rejecting
  if (content.length > 380) content = content.slice(0, 380).trim();
  if (title.length > 40) title = title.slice(0, 40).trim();

  const c: PuzzleCandidate = {
    title,
    content,
    answer,
    explanation: asString(raw.explanation || raw.whyInteresting).trim() || answer.slice(0, 120),
    difficulty,
    coreTrick: asString(raw.coreTrick || raw.core_trick).trim() || '착각 반전',
    place: asString(raw.place).trim() || '일상',
    characterRelation:
      asString(raw.characterRelation || raw.character_relation).trim() || '인물',
    whyInteresting: asString(raw.whyInteresting || raw.why_interesting).trim() || '',
  };

  const ban = hardBanReason(c);
  if (ban) return { ok: false, reason: ban };

  // Ensure Threads format is buildable
  formatThreadsPost(c.title, c.content);
  return { ok: true, candidate: c };
}

function compactPerformance(p: PerformanceSummary): string {
  return `피함: ${[...p.repeatedThemes, ...p.avoidThemes].slice(0, 6).join(', ') || '-'} / 난이도:${p.recommendedDifficulty}`;
}

export async function generatePuzzleCandidates(args: {
  recent: RecentProblemBrief[];
  performance: PerformanceSummary;
  explore?: boolean;
}): Promise<PuzzleCandidate[]> {
  const recentBrief = args.recent
    .slice(0, 6)
    .map((r, i) => `${i + 1}. ${r.title}`)
    .join('\n');

  const mode = args.explore
    ? '실험: 덜 흔한 장소·물건.'
    : '표준: 일상 공간, 착각 하나.';

  let lastReason = '알 수 없음';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const user = `장르: 상황 수수께끼(LTP).

${compactPerformance(args.performance)}
최근제목(중복금지):
${recentBrief || '(없음)'}
${mode}
${attempt > 1 ? `이전 실패 사유: ${lastReason}. 다른 소재로 다시.` : ''}
도구로 문제 1개 제출.`;

    const raw = await groqPuzzleCompletion({
      model: getGroqModel(),
      system: SYSTEM,
      user,
      temperature: args.explore ? 0.9 : 0.75 + (attempt - 1) * 0.05,
      maxTokens: 1400,
    });

    const payload =
      (raw.candidate as Record<string, unknown>) ||
      (raw.puzzle as Record<string, unknown>) ||
      (raw.result as Record<string, unknown>) ||
      (raw.properties as Record<string, unknown>) ||
      raw;

    const result = normalizeCandidate(payload, args.performance.recommendedDifficulty);
    if (result.ok) return [result.candidate];
    lastReason = result.reason;
  }

  throw new Error(`생성 실패: ${lastReason}`);
}
