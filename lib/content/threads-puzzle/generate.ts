import { groqPuzzleCompletion, getGroqModel } from '@/lib/groq/client';
import { formatThreadsPost } from './format';
import { LTP_FEW_SHOTS } from './few-shot';
import type { PerformanceSummary, PuzzleCandidate, RecentProblemBrief } from './types';

const SYSTEM = `너는 한국어 「바다거북스프」(상황 수수께끼 / LTP) 출제자다.

아래 예1~예5의 질감만 배워라. 내용·정답은 절대 베끼지 마라.

${LTP_FEW_SHOTS}

# 반드시 지킬 형식
표면(content): 1~3문장의 건조한 사실. "왜?"만 남긴다. 퀴즈 설명문·문제 해설체 금지.
이면(answer): 착각 하나를 뒤집으면 표면이 전부 설명되는 전말 (2~4문장). 현대 기술·로봇·시스템으로 때우지 말 것.
title: 한국어 짧은 명사구만 (영어 제목 금지).
difficulty: easy | medium | hard 중 하나(영어만).
coreTrick: 착각 유형 한 줄.

# 금지
- 예시(직소/뷔페/세차/엘리베이터/하트쿠키) 및 원조 바다거북수프 복제
- 꿈/촬영/게임이었다, 사람이 아니었다
- 말장난·동음이의만으로 끝나는 문제
- "이 상황에서 ~이유는?" 같은 시험문제 말투
- 장황한 감성 소설

최종 출력은 JSON 객체 하나.`;

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function mapDifficulty(
  raw: string,
  fallback: PuzzleCandidate['difficulty']
): PuzzleCandidate['difficulty'] {
  const s = raw.toLowerCase().trim();
  if (['easy', '초급', '쉬움', '하'].includes(s)) return 'easy';
  if (['hard', '고급', '어려움', '상'].includes(s)) return 'hard';
  if (['medium', '중급', '보통', '중'].includes(s)) return 'medium';
  return fallback;
}

function hardBanReason(c: PuzzleCandidate): string | null {
  const blob = `${c.title}\n${c.content}\n${c.answer}`;
  const banned = [
    [/꿈이(었|였)다/, '꿈이었다'],
    [/영화\s*촬영|연극이(었|였)다|게임\s*속이(었|였)다/, '촬영/게임'],
    [/사실\s*.*사람이\s*아니/, '사람이 아니었다'],
    [/99%\s*가?\s*못\s*맞|천재\s*테스트/, '클릭베이트'],
    [/바다거북\s*수프/, '원조 복제'],
    [/직소|직쏘\s*퍼즐/, '하늘/직소 복제'],
    [/뷔페/, '뷔페 복제'],
    [/세차/, '세차 복제'],
    [/엘리베이터.*12\s*층|키가\s*작아/, '엘리베이터 복제'],
    [/하트\s*쿠키|발렌타인/, '하트쿠키 복제'],
  ] as const;
  for (const [re, label] of banned) {
    if (re.test(blob)) return label;
  }
  if (!c.title.trim()) return '제목 없음';
  if (!/[\uac00-\ud7a3]/.test(c.title)) return '제목이 한국어가 아님';
  if (c.content.trim().length < 18) return '표면 너무 짧음';
  if (c.answer.trim().length < 20) return '이면 너무 짧음';
  if (c.content.length > 320) return '표면이 너무 김';
  if (/로봇|자동\s*주차|AI|가상현실|나노/.test(blob)) return '과도한 기술 설정';
  // Exam-style prompts are not LTP surfaces
  if (/이유는\s*무엇|무엇인가요\s*\?|정답은\s*무엇/.test(c.content)) {
    return '시험문제 말투';
  }
  return null;
}

function normalizeCandidate(
  raw: Record<string, unknown>,
  fallbackDifficulty: PuzzleCandidate['difficulty']
): { ok: true; candidate: PuzzleCandidate } | { ok: false; reason: string } {
  let content = asString(raw.content).trim().replace(/\s*왜 그랬을까\??\s*$/u, '').trim();
  let title = asString(raw.title).trim();
  const answer = asString(raw.answer).trim();

  if (content.length > 300) content = content.slice(0, 300).trim();
  if (title.length > 24) title = title.slice(0, 24).trim();

  const c: PuzzleCandidate = {
    title,
    content,
    answer,
    explanation: asString(raw.explanation || raw.whyInteresting).trim() || answer.slice(0, 140),
    difficulty: mapDifficulty(asString(raw.difficulty), fallbackDifficulty),
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
    '세탁소',
    '도서관',
    '지하철',
    '주차장',
    '병원 대기실',
    '학교 급식실',
    '카페',
    '택배함',
    '헬스장',
    '노래방',
    '박물관',
    '버스 정류장',
    '편의점',
    '수영장 탈의실',
    '사무실 프린터',
  ][Math.floor(Math.random() * 15)];

  let lastReason = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const user = `예1~예5와 같은 「짧은 표면 + 착각 하나」로 새 문제 1개.
배경 힌트: ${seed}
최근 제목(피함): ${recentBrief || '없음'}
난이도: ${args.performance.recommendedDifficulty}
${lastReason ? `이전 실패 사유: ${lastReason}. 완전히 다른 착각으로.` : ''}
시험문제처럼 "이유는?"으로 묻지 말고, 상황만 서술하라.`;

    const raw = await groqPuzzleCompletion({
      model: getGroqModel(),
      system: SYSTEM,
      user,
      temperature: 0.75 + (attempt - 1) * 0.1,
      maxTokens: 2500,
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
