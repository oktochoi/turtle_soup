import { groqJsonCompletion, getGroqModel } from '@/lib/groq/client';
import { countSentences, formatThreadsPost, validateThreadsFormat } from './format';
import type { PerformanceSummary, PuzzleCandidate, RecentProblemBrief } from './types';

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

/**
 * Authentic 바다거북스프 = Situation / Lateral Thinking Puzzle
 * (우미가메노스프 / LTP): 표면(기묘한 짧은 상황) + 이면(가정의 착각을 깨는 전말)
 * NOT detective novel, NOT investigation dossier, NOT tearjerker short story.
 */
const SYSTEM = `당신은 한국어 「바다거북스프」(상황 수수께끼 / 수평사고 퍼즐 / LTP) 출제자다.

# 이 게임이 뭔가
출제자가 「표면(스프 표면)」만 제시한다. 참가자는 예/아니요/상관없음 질문으로 「이면(스프 바닥)」을 맞힌다.
핵심은 독자가 자연스럽게 하는 「착각」 하나를 뒤집는 것이다.
(공간 착각 / 대상·정체 착각 / 시간·순서 착각 / 목적·행동 의미 착각 / 상태·조건 착각)

# 좋은 표면 (content) — 반드시 이 톤
- 짧고 건조한 「사실」만: 누가, 어디서, 무엇을 했고, 이상한 결과/행동이 있었다.
- 2~5문장. 분위기 문장·감정 묘사·수사 보고서 말투 금지.
- 읽고 나면 「왜?」가 남고, 예/아니요 질문으로 파고들 여지가 있어야 한다.
- 정답을 직접 말하지 않는다.

# 좋은 이면 (answer)
- 표면의 모든 이상한 점을 「하나의 핵심 착각」으로 설명한다.
- 정답을 알면 "아, 그 가정을 잘못 했구나"가 된다. (감동 사연·장편 서사 X)
- 정답에만 새 인물/장소/직업을 갑자기 추가하지 않는다. 표면에 단서가 있거나 자연히 추론 가능해야 한다.
- 예/아니요로 재구성 가능해야 한다. (「A인가요?」「그 물건은 B인가요?」)

# 절대 만들지 말 것 (지금 자주 실패하는 유형)
- 추리소설·탐정 수사·사건파일·감성 단편 소설 톤
- "숨겨진 사연이 감동적" 류의 장황한 사생활 이야기
- 말장난·동음이의만으로 끝나는 문제
- 꿈이었다 / 영화·연극·게임이었다 / 사실 사람이 아니었다
- 유명 고전 복제(바다거북수프 원조, 엘리베이터 난쟁이, 성냥 사막, 바텐더 총 등)
- 지나친 잔혹·선정·전문지식 필수
- 클릭베이트 제목

# 제목
짧은 명사구. 분위기만. 정답 노출 금지.

# 출력 필드
- content = 표면만 (끝에 "왜 그랬을까?" 넣지 말 것)
- answer = 이면 전말 (구체적, 2~5문장)
- explanation = 출제 의도/착각 유형을 한두 문장
- coreTrick = 착각 유형 한 줄 (예: 목적 착각, 대상 착각)
- place / characterRelation = 짧게
- whyInteresting = "예/아니요로 어떤 가정을 깨는지" 한 줄

# 톤 예시 (구조만 참고, 내용 복제 금지)
표면: 남자는 식당에서 음식을 시켰는데 아무도 가져다주지 않았다. 나가려 하자 사장이 큰돈을 청구했다.
이면: 뷔페였다. (목적/규칙 착각)

표면: 여자는 구름 한 점 없는 하늘을 보고 한숨을 쉬었다.
이면: 직소 퍼즐 상자 그림을 본 것. 하늘 조각이 단색이라 어렵다고 느낀 것. (대상 착각)

이런 「짧은 기묘함 + 착각 반전」만 만들어라. 미스터리 소설처럼 쓰지 마라.`;

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
  // Soft mystery padding: long emotional content
  if (c.content.length > 420) return '표면이 너무 김 (상황 수수께끼는 짧게)';
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
    ? '실험: 덜 흔한 장소·직업·물건을 쓰되, 반드시 「착각 하나」로 닫히는 LTP로.'
    : '표준: 일상 공간에서 「한 가지 착각」이 깔끔히 뒤집히는 문제.';

  const user = `장르 재확인: 상황 수수께끼(LTP). 추리소설/감성단편 금지.

${compactPerformance(args.performance)}

최근 문제(같은 트릭·소재 금지):
${recentBrief || '(없음)'}

${mode}

바다거북스프 문제 1개만 JSON으로. content=짧은 표면, answer=이면(착각 반전).`;

  const raw = await groqJsonCompletion<PuzzleCandidate>({
    model: getGroqModel(),
    system: SYSTEM,
    user,
    schemaName: 'turtle_soup_candidate',
    schema: candidateSchema as unknown as Record<string, unknown>,
    temperature: args.explore ? 0.85 : 0.7,
    maxTokens: 1100,
  });

  const normalized = normalizeCandidate(raw, args.performance.recommendedDifficulty);
  if (!normalized) {
    throw new Error('Groq가 유효한 상황 수수께끼를 만들지 못했습니다');
  }
  return [normalized];
}
