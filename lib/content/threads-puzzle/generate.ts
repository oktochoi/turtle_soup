import { groqPuzzleCompletion, getGroqModel } from '@/lib/groq/client';
import { formatThreadsPost } from './format';
import { LTP_FEW_SHOTS } from './few-shot';
import type { PerformanceSummary, PuzzleCandidate, RecentProblemBrief } from './types';

const SYSTEM = `너는 한국어 「바다거북스프」 출제자다. 장르는 상황 수수께끼(LTP/수평사고)다.

목표: 예1~예5와 같은 「짧은 표면 + 착각 하나 이면」을 NEW로 만든다.
복제 금지: 예시에 나온 직소/뷔페/세차/엘리베이터/하트쿠키/원조 바다거북수프/성냥사막/바텐더 총 등 유명작.

표면(content):
- 1~3문장. 누가·어디서·무엇을 했고 이상한 결과만.
- 감정 묘사·수사 보고서·장황한 배경 금지.
- 끝에 "왜 그랬을까?" 넣지 말 것.

이면(answer):
- 2~4문장. 핵심 착각을 깨는 전말.
- 표면의 이상한 점을 모두 설명.
- 정답에만 새 인물/직업을 갑자기 넣지 말 것.

착각 유형(coreTrick) 예: 대상 착각, 목적 착각, 규칙 착각, 신체 조건, 시간 착각, 관계 착각

금지: 꿈/촬영/게임이었다, 사람이 아니었다, 말장난만, 클릭베이트 제목, 지나친 잔혹.

submit_turtle_soup 도구로만 제출.
difficulty는 easy|medium|hard.

${LTP_FEW_SHOTS}`;

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function hardBanReason(c: PuzzleCandidate): string | null {
  const blob = `${c.title}\n${c.content}\n${c.answer}`;
  const banned = [
    [/꿈이(었|였)다/, '꿈이었다'],
    [/영화\s*촬영|연극이(었|였)다|게임\s*속이(었|였)다/, '촬영/게임'],
    [/사실\s*.*사람이\s*아니/, '사람이 아니었다'],
    [/99%\s*가?\s*못\s*맞|천재\s*테스트|충격적인\s*반전/, '클릭베이트'],
    // Classic clones (surface keywords)
    [/바다거북\s*수프/, '원조 복제'],
    [/직소|직쏘|퍼즐\s*상자/, '하늘/직소 복제'],
    [/뷔페/, '식당/뷔페 복제'],
    [/세차/, '5분/세차 복제'],
    [/엘리베이터.*12\s*층|12\s*층.*엘리베이터|키가\s*작/, '엘리베이터 복제'],
    [/하트\s*쿠키|발렌타인/, '하트쿠키 복제'],
  ] as const;
  for (const [re, label] of banned) {
    if (re.test(blob)) return label;
  }
  if (!c.title.trim()) return '제목 없음';
  if (c.content.trim().length < 18) return '표면 너무 짧음';
  if (c.answer.trim().length < 20) return '이면 너무 짧음';
  // Too novel-like
  if (c.content.length > 280) return '표면이 너무 김(1~3문장으로)';
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
  const answer = asString(raw.answer).trim();

  if (content.length > 280) content = content.slice(0, 280).trim();
  if (title.length > 24) title = title.slice(0, 24).trim();

  const c: PuzzleCandidate = {
    title,
    content,
    answer,
    explanation: asString(raw.explanation || raw.whyInteresting).trim() || answer.slice(0, 140),
    difficulty,
    coreTrick: asString(raw.coreTrick || raw.core_trick).trim() || '착각 반전',
    place: asString(raw.place).trim() || '일상',
    characterRelation:
      asString(raw.characterRelation || raw.character_relation).trim() || '인물',
    whyInteresting: asString(raw.whyInteresting || raw.why_interesting).trim() || '',
  };

  const ban = hardBanReason(c);
  if (ban) return { ok: false, reason: ban };
  formatThreadsPost(c.title, c.content);
  return { ok: true, candidate: c };
}

export async function generatePuzzleCandidates(args: {
  recent: RecentProblemBrief[];
  performance: PerformanceSummary;
  explore?: boolean;
}): Promise<PuzzleCandidate[]> {
  const recentBrief = args.recent
    .slice(0, 8)
    .map((r, i) => `${i + 1}. ${r.title}`)
    .join('\n');

  const seed = [
    '편의점',
    '도서관',
    '지하철',
    '주차장',
    '세탁소',
    '병원 대기실',
    '학교 급식',
    '놀이공원',
    '카페 와이파이',
    '택배 상자',
    '헬스장',
    '노래방',
    '박물관',
    '야구장',
    '버스 정류장',
  ][Math.floor(Math.random() * 15)];

  const mode = args.explore
    ? `실험: 「${seed}」를 배경으로, 예1~5와 같은 짧은 LTP를 새로.`
    : `표준: 「${seed}」근처 일상에서, 예1~5 톤의 새 LTP.`;

  let lastReason = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const user = `위 예1~5와 같은 질감으로 새 문제 1개.
유명작·예시 복제 금지.
${mode}
최근 제목(피함): ${recentBrief || '없음'}
권장 난이도: ${args.performance.recommendedDifficulty}
${lastReason ? `이전 실패: ${lastReason}. 다른 착각으로.` : ''}
도구로 제출.`;

    const raw = await groqPuzzleCompletion({
      model: getGroqModel(),
      system: SYSTEM,
      user,
      temperature: 0.8 + (attempt - 1) * 0.08,
      maxTokens: 1200,
    });

    const payload =
      (raw.candidate as Record<string, unknown>) ||
      (raw.puzzle as Record<string, unknown>) ||
      (raw.result as Record<string, unknown>) ||
      raw;

    const result = normalizeCandidate(payload, args.performance.recommendedDifficulty);
    if (result.ok) return [result.candidate];
    lastReason = result.reason;
  }

  throw new Error(`생성 실패: ${lastReason || '품질 미달'}`);
}
