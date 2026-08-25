import { groqJsonCompletion, getGroqModel } from '@/lib/groq/client';
import { countSentences, formatThreadsPost, validateThreadsFormat } from './format';
import type { PerformanceSummary, PuzzleCandidate, RecentProblemBrief } from './types';

/**
 * Authentic 바다거북스프 = Situation / Lateral Thinking Puzzle
 */
const SYSTEM = `당신은 한국어 바다거북스프(상황 수수께끼/LTP) 출제자다.

표면(content): 2~5문장의 짧은 기묘한 사실. 소설체·수사체·감동사연 금지.
이면(answer): 독자의 「착각 하나」를 뒤집는 전말. 예/아니요로 재구성 가능해야 함.
금지: 꿈/촬영/사람이아니었다, 고전 복제, 말장난만, 클릭베이트 제목, 정답에서만 새 설정.

반드시 아래 키를 가진 JSON 객체 하나만 출력:
title, content, answer, explanation, difficulty, coreTrick, place, characterRelation, whyInteresting
difficulty는 easy|medium|hard 중 하나.
content 끝에 "왜 그랬을까?"를 넣지 마라.`;

function bannedContent(c: PuzzleCandidate): string | null {
  const blob = `${c.title}\n${c.content}\n${c.answer}`;
  const banned = [
    [/꿈이(었|였)/, '꿈이었다 결말'],
    [/영화\s*촬영|연극이(었|였)|게임\s*속이(었|였)|VR|가상\s*현실/, '촬영/게임 결말'],
    [/사실\s*.*사람이\s*아니/, '사람이 아니었다 결말'],
    [/99%\s*가?\s*못|천재\s*테스트|충격적인\s*반전|소름\s*돋는/, '클릭베이트'],
    [/수사\s*일지|탐정|범인을\s*찾|수사관/, '추리수사 톤'],
  ] as const;
  for (const [re, label] of banned) {
    if (re.test(blob)) return label;
  }
  if (/^아\s*그래서\.?$/u.test(c.answer.trim())) return '정답이 너무 짧음';
  if (c.answer.trim().length < 40) return '정답이 너무 짧음';
  const sentences = countSentences(c.content);
  if (sentences < 2 || sentences > 6) return `문장 수 ${sentences} (2~5 권장)`;
  if (c.content.length > 420) return '표면이 너무 김';
  const threads = formatThreadsPost(c.title, c.content);
  const fmt = validateThreadsFormat(threads);
  if (fmt) return fmt;
  return null;
}

function compactPerformance(p: PerformanceSummary): string {
  return [
    `피할수재: ${[...p.repeatedThemes, ...p.avoidThemes].slice(0, 8).join(', ') || '-'}`,
    `권장난이도: ${p.recommendedDifficulty}`,
  ].join('\n');
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function normalizeCandidate(
  raw: Record<string, unknown>,
  fallbackDifficulty: PuzzleCandidate['difficulty']
): PuzzleCandidate | null {
  const difficultyRaw = asString(raw.difficulty).toLowerCase();
  const difficulty = (['easy', 'medium', 'hard'].includes(difficultyRaw)
    ? difficultyRaw
    : fallbackDifficulty) as PuzzleCandidate['difficulty'];

  const c: PuzzleCandidate = {
    title: asString(raw.title).trim(),
    content: asString(raw.content).trim().replace(/\s*왜 그랬을까\??\s*$/u, '').trim(),
    answer: asString(raw.answer).trim(),
    explanation: asString(raw.explanation || raw.whyInteresting).trim(),
    difficulty,
    coreTrick: asString(raw.coreTrick || raw.core_trick).trim() || '착각 반전',
    place: asString(raw.place).trim() || '일상',
    characterRelation: asString(raw.characterRelation || raw.character_relation).trim() || '인물',
    whyInteresting: asString(raw.whyInteresting || raw.why_interesting).trim() || '',
  };

  if (!c.title || !c.content || !c.answer) return null;
  if (bannedContent(c)) return null;
  return c;
}

export async function generatePuzzleCandidates(args: {
  recent: RecentProblemBrief[];
  performance: PerformanceSummary;
  explore?: boolean;
}): Promise<PuzzleCandidate[]> {
  const recentBrief = args.recent
    .slice(0, 8)
    .map((r, i) => `${i + 1}. ${r.title} | ${(r.coreTrick || r.answer).slice(0, 50)}`)
    .join('\n');

  const mode = args.explore
    ? '실험: 덜 흔한 장소·물건, 착각 하나로 닫히는 LTP.'
    : '표준: 일상 공간, 착각 하나.';

  const user = `장르: 상황 수수께끼(LTP). 추리소설 금지.

${compactPerformance(args.performance)}

최근(중복금지):
${recentBrief || '(없음)'}

${mode}

JSON 한 개만 생성.`;

  const raw = await groqJsonCompletion<Record<string, unknown>>({
    model: getGroqModel(),
    system: SYSTEM,
    user,
    temperature: args.explore ? 0.85 : 0.7,
    maxTokens: 1400,
    retries: 2,
  });

  // Some models wrap as { candidate: {...} } or { puzzle: {...} }
  const payload =
    (raw.candidate as Record<string, unknown>) ||
    (raw.puzzle as Record<string, unknown>) ||
    (raw.result as Record<string, unknown>) ||
    raw;

  const normalized = normalizeCandidate(payload, args.performance.recommendedDifficulty);
  if (!normalized) {
    throw new Error('Groq가 유효한 상황 수수께끼 JSON을 만들지 못했습니다');
  }
  return [normalized];
}
