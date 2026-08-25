import { groqJsonCompletion, getGroqModel } from '@/lib/groq/client';
import { countSentences, formatThreadsPost, validateThreadsFormat } from './format';
import type { PerformanceSummary, PuzzleCandidate, RecentProblemBrief } from './types';

/** Single candidate — free-tier models often fail minItems:3 */
const candidateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    content: { type: 'string' },
    answer: { type: 'string' },
    explanation: { type: 'string' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    coreTrick: { type: 'string' },
    place: { type: 'string' },
    characterRelation: { type: 'string' },
    whyInteresting: { type: 'string' },
  },
  required: [
    'title',
    'content',
    'answer',
    'explanation',
    'difficulty',
    'coreTrick',
    'place',
    'characterRelation',
    'whyInteresting',
  ],
} as const;

const SYSTEM = `한국어 바다거북스프 미스터리 작가.
구조: 평범한 상황→이상한 행동→궁금증→숨겨진 사정→정답 시 "아 그래서".
본문 3~7문장. 제목은 짧고 분위기만(정답·클릭베이트 금지).
금지: 말장난, 꿈/촬영/사람이 아니었다, 고전 복제, 잔혹·선정, 정답에서만 새 설정.
정답은 구체적 사정으로 쓸 것("아 그래서"만 쓰지 마라).
본문 끝에 "왜 그랬을까?" 넣지 마라.`;

function bannedContent(c: PuzzleCandidate): string | null {
  const blob = `${c.title}\n${c.content}\n${c.answer}`;
  const banned = [
    [/꿈이(었|였)/, '꿈이었다 결말'],
    [/영화\s*촬영|연극이(었|였)|게임\s*속이(었|였)/, '촬영/게임 결말'],
    [/사실\s*.*사람이\s*아니/, '사람이 아니었다 결말'],
    [/99%\s*가?\s*못|천재\s*테스트|충격적인\s*반전|소름\s*돋는/, '클릭베이트'],
  ] as const;
  for (const [re, label] of banned) {
    if (re.test(blob)) return label;
  }
  if (/^아\s*그래서\.?$/u.test(c.answer.trim())) return '정답이 너무 짧음';
  const sentences = countSentences(c.content);
  if (sentences < 3 || sentences > 8) return `문장 수 ${sentences} (3~7 권장)`;
  const threads = formatThreadsPost(c.title, c.content);
  const fmt = validateThreadsFormat(threads);
  if (fmt) return fmt;
  return null;
}

function compactPerformance(p: PerformanceSummary): string {
  return [
    `강점: ${p.strongPatterns.slice(0, 3).join(' / ')}`,
    `약점: ${p.weakPatterns.slice(0, 2).join(' / ')}`,
    `반복소재(피함): ${[...p.repeatedThemes, ...p.avoidThemes].slice(0, 6).join(', ') || '-'}`,
    `권장난이도: ${p.recommendedDifficulty}`,
  ].join('\n');
}

function normalizeCandidate(
  c: PuzzleCandidate,
  fallbackDifficulty: PuzzleCandidate['difficulty']
): PuzzleCandidate | null {
  const ban = bannedContent(c);
  if (ban) return null;
  return {
    ...c,
    title: c.title.trim(),
    content: c.content.trim().replace(/\s*왜 그랬을까\??\s*$/u, '').trim(),
    answer: c.answer.trim(),
    explanation: (c.explanation || c.whyInteresting || '').trim(),
    difficulty: (['easy', 'medium', 'hard'].includes(c.difficulty)
      ? c.difficulty
      : fallbackDifficulty) as PuzzleCandidate['difficulty'],
  };
}

/**
 * Generate exactly one puzzle candidate (array of length 0 or 1 for pipeline compat).
 */
export async function generatePuzzleCandidates(args: {
  recent: RecentProblemBrief[];
  performance: PerformanceSummary;
  explore?: boolean;
}): Promise<PuzzleCandidate[]> {
  const recentBrief = args.recent
    .slice(0, 8)
    .map((r, i) => `${i + 1}. ${r.title} | ${(r.coreTrick || r.answer).slice(0, 60)}`)
    .join('\n');

  const mode = args.explore
    ? '실험모드: 새 장소·관계·사건을 시도하되 품질 규칙은 유지.'
    : '성과원칙 활용: 잘 된 구조를 새 이야기로. 소재 복제 금지.';

  const user = `${compactPerformance(args.performance)}

최근(중복금지):
${recentBrief || '(없음)'}

${mode}

후보 문제 1개만 JSON으로 생성.`;

  const raw = await groqJsonCompletion<PuzzleCandidate>({
    model: getGroqModel(),
    system: SYSTEM,
    user,
    schemaName: 'turtle_soup_candidate',
    schema: candidateSchema as unknown as Record<string, unknown>,
    temperature: args.explore ? 0.9 : 0.75,
    maxTokens: 1200,
  });

  const normalized = normalizeCandidate(raw, args.performance.recommendedDifficulty);
  if (!normalized) {
    throw new Error('Groq가 유효한 후보를 생성하지 못했습니다');
  }
  return [normalized];
}
