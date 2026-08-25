import { groqJsonCompletion, getGroqModel } from '@/lib/groq/client';
import { countSentences, formatThreadsPost, validateThreadsFormat } from './format';
import type { PerformanceSummary, PuzzleCandidate, RecentProblemBrief } from './types';

const candidateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    candidates: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
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
      },
    },
  },
  required: ['candidates'],
} as const;

const SYSTEM = `당신은 한국어 바다거북스프(수평적 사고) 미스터리 작가다.
목표: Threads에 올릴 짧은 미스터리 스토리형 문제를 만든다.

좋은 문제:
- 평범한 상황 → 이상한 행동/사건 → 이유가 궁금 → 숨겨진 사정 → 정답을 보면 "아 그래서 그랬구나"
- 인물, 장소, 상황, 행동, 이상한 사건, 숨겨진 사정이 자연스럽게 들어간다
- 본문 3~7문장, 짧은 영화 한 장면처럼
- 제목은 짧고 분위기만 (정답 노출·클릭베이트 금지)

금지:
- 단순 말장난/중의성
- 아무 단서 없이 정답에서만 새 설정 추가
- "사실 사람이 아니었다", "꿈이었다", "게임/영화/연극 촬영이었다" 남발
- 유명 고전 퍼즐 복제
- 지나친 잔혹·선정적·전문지식 필수
- 논리적으로 설명되지 않는 정답
- 클릭베이트 제목 (99%가 못 맞히는, 천재 테스트, 충격적인 반전 등)

정답은 본문에 나온 핵심 행동을 모두 설명해야 한다.
본문 끝에 "왜 그랬을까?"를 넣지 마라 (게시 포맷터에서 붙인다).`;

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
  const sentences = countSentences(c.content);
  if (sentences < 3 || sentences > 8) return `문장 수 ${sentences} (3~7 권장)`;
  const threads = formatThreadsPost(c.title, c.content);
  const fmt = validateThreadsFormat(threads);
  if (fmt) return fmt;
  return null;
}

export async function generatePuzzleCandidates(args: {
  recent: RecentProblemBrief[];
  performance: PerformanceSummary;
  explore?: boolean;
}): Promise<PuzzleCandidate[]> {
  const recentBrief = args.recent
    .slice(0, 15)
    .map(
      (r, i) =>
        `${i + 1}. 제목: ${r.title}\n본문: ${r.content.slice(0, 180)}\n정답요약: ${r.answer.slice(0, 120)}\n트릭: ${r.coreTrick || '-'}`
    )
    .join('\n\n');

  const mode = args.explore
    ? '이번 생성은 실험 모드(약 25%): 새로운 장소·관계·직업·사건을 시도하되 품질 규칙은 지켜라.'
    : '이번 생성은 성과 원칙 활용 모드(약 75%): 잘 된 구조를 새 이야기로 재해석하되, 소재를 복제하지 마라.';

  const user = `최근 성과 요약:
${JSON.stringify(args.performance, null, 2)}

최근 문제 (중복 금지):
${recentBrief || '(없음)'}

${mode}

권장 난이도: ${args.performance.recommendedDifficulty}

서로 다른 핵심 트릭을 가진 후보 3~5개를 JSON으로 생성하라.
각 후보는 제목/본문/정답/해설/난이도/coreTrick/place/characterRelation/whyInteresting를 포함한다.`;

  const result = await groqJsonCompletion<{ candidates: PuzzleCandidate[] }>({
    model: getGroqModel(),
    system: SYSTEM,
    user,
    schemaName: 'turtle_soup_candidates',
    schema: candidateSchema as unknown as Record<string, unknown>,
    temperature: args.explore ? 0.9 : 0.75,
    maxTokens: 5000,
  });

  const cleaned: PuzzleCandidate[] = [];
  for (const c of result.candidates || []) {
    const ban = bannedContent(c);
    if (ban) continue;
    cleaned.push({
      ...c,
      title: c.title.trim(),
      content: c.content.trim().replace(/\s*왜 그랬을까\??\s*$/u, '').trim(),
      answer: c.answer.trim(),
      explanation: (c.explanation || c.whyInteresting || '').trim(),
      difficulty: (['easy', 'medium', 'hard'].includes(c.difficulty)
        ? c.difficulty
        : args.performance.recommendedDifficulty) as PuzzleCandidate['difficulty'],
    });
  }

  if (cleaned.length < 1) {
    throw new Error('Groq가 유효한 후보를 생성하지 못했습니다');
  }
  return cleaned;
}
