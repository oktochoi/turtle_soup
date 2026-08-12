/**
 * Maps game CASE data → editorial / educational content (AdSense-friendly, no spoilers).
 */

import { caseNumberFromId, difficultyStars } from '@/lib/investigation/case-adapter';
import { CATEGORY_LABELS, type CaseCategory } from '@/lib/investigation/types';
import type { Problem } from '@/lib/types';

export interface CaseDossier {
  caseNumber: string;
  title: string;
  category: CaseCategory;
  categoryLabel: string;
  difficulty: 'easy' | 'medium' | 'hard';
  stars: string;
  estimatedMinutes: number;
  playCount: number;
  synopsis: string;
  strategy: string[];
  starterQuestions: string[];
  categoryGuide: { title: string; body: string };
  investigationMethod: string;
  learningPoints: string[];
  explanation?: string | null;
  tags: string[];
}

function detectCategory(tags: string[] = [], difficulty?: string): CaseCategory {
  const joined = tags.map((t) => t.toLowerCase()).join(' ');
  if (/공포|scary|horror|소름/.test(joined)) return 'horror';
  if (/반전|twist|레전드|legend/.test(joined)) return 'twist';
  if (/감동|emotional|슬픈/.test(joined)) return 'emotional';
  if (/극악|extreme|최상/.test(joined) || difficulty === 'hard') return 'extreme';
  if (/범죄|crime|살인|시체/.test(joined)) return 'crime';
  return 'mystery';
}

function estimatedMinutes(difficulty: string): number {
  if (difficulty === 'hard') return 15;
  if (difficulty === 'easy') return 8;
  return 12;
}

function buildSynopsis(content: string, title: string): string {
  const text = (content || '').trim();
  if (!text) return `${title} — AI와 함께 예/아니요 질문으로 진실을 좁혀 가는 바다거북스프 수사 사건입니다.`;
  const sentences = text.split(/(?<=[.!?。！？\n])\s+/).filter(Boolean);
  const head = sentences.slice(0, 2).join(' ');
  if (head.length >= 80) return head;
  return `${head} 이 사건은 표면적 설명만으로는 결말을 예측하기 어렵도록 설계된 전형적인 수평적 사고 퍼즐입니다.`;
}

const CATEGORY_GUIDE: Record<
  CaseCategory,
  { title: string; body: string; starters: string[]; learning: string[] }
> = {
  mystery: {
    title: '미스터리 유형 수사란?',
    body:
      '미스터리 유형은 일상적 상황 속에 숨겨진 논리적 모순을 찾는 사건입니다. 초자연적 요소보다 인과·시간·대상의 정의를 재확인하는 질문이 효과적입니다. ' +
      '“왜 그런 행동을 했는가?”보다 “무엇이 실제로 일어났는가?”를 먼저 분리해 보세요.',
    starters: [
      '이 사건은 실내에서 일어났나요?',
      '등장인물은 혼자였나요?',
      '사건과 직접 관련된 물건이 있나요?',
      '시간 순서가 중요한 사건인가요?',
      '피해자와 가해자를 구분할 수 있나요?',
    ],
    learning: [
      '사실 관계와 해석을 분리하는 연습',
      '질문 하나로 여러 가설을 동시에 제거하는법',
      '모순된 전제를 찾는 논리적 추리',
    ],
  },
  crime: {
    title: '범죄·추리 유형 수사란?',
    body:
      '범죄 유형은 동기·수단·기회를 좁혀 가는 고전적 추리 구조를 따릅니다. 범인의 정체를 성급히 단정하기보다, ' +
      '“누가 물리적으로 가능했는가”, “알리바이가 성립하는가” 같은 검증 가능한 질문을 우선하세요.',
    starters: [
      '범행은 계획된 것이었나요?',
      '목격자가 있었나요?',
      '사건 현장은 폐쇄된 공간인가요?',
      '피해자는 사건을 예견할 수 있었나요?',
      '외부인의 개입 가능성이 있나요?',
    ],
    learning: ['동기·수단·기회 프레임워크', '알리바이 검증 질문 설계', '가설 하나씩 배제하는 수사'],
  },
  horror: {
    title: '공포·심리 유형 수사란?',
    body:
      '공포 유형은 종종 “공포 이미지” 자체가 착각을 유도합니다. 유령·저주보다 공간·지각·정체성 오류를 의심해 보세요. ' +
      '잔혹한 묘사보다 상황의 논리적 재구성에 집중하면 핵심에 빠르게 도달할 수 있습니다.',
    starters: [
      '초자연적 존재가 실제로 등장하나요?',
      '공포의 원인이 착각일 가능성이 있나요?',
      '사건은 밤에 일어났나요?',
      '목격자의 감각(시각·청각)을 믿을 수 있나요?',
      '공간 구조가 중요한 단서인가요?',
    ],
    learning: ['착각 기반 퍼즐 분해', '감각·지각 오류 가설', '공포 요소와 논리 단서 분리'],
  },
  twist: {
    title: '반전·트위스트 유형 수사란?',
    body:
      '반전 유형은 독자가 자연스럽게 가정하는 전제(주어·시점·시간·대상)를 뒤집습니다. ' +
      '“당연히 그렇겠지”라고 넘긴 문장 하나를 다시 질문으로 바꿔 보세요. 단어의 정의를 좁히는 질문이 특히 강력합니다.',
    starters: [
      '이야기의 주어가 사람인가요?',
      '시간 순서가 뒤바뀌어 있나요?',
      '비유적 표현이 실제를 숨기고 있나요?',
      '제목이나 첫 문장에 함정이 있나요?',
      '읽는 사람의 관점이 속고 있나요?',
    ],
    learning: ['전제 뒤집기 사고', '어휘·정의 재확인', '반전 설계 패턴 이해'],
  },
  emotional: {
    title: '감동·서사 유형 수사란?',
    body:
      '감동 유형은 사건의 “이유”와 “관계”가 핵심입니다. 감정선을 따라가되, 먼저 사실 타임라인을 고정하세요. ' +
      '왜 울었는지, 왜 선택했는지는 사실이 확인된 뒤에 묻는 것이 효율적입니다.',
    starters: [
      '가족 관계가 사건과 연결되나요?',
      '과거 사건이 현재에 영향을 주나요?',
      '희생이나 선택이 핵심인가요?',
      '오해가 사건의 원인인가요?',
      '사건의 결말은 비극적인가요?',
    ],
    learning: ['관계·동기 중심 추리', '타임라인 정리', '감정과 사실 분리'],
  },
  extreme: {
    title: '고난도·레전드 유형 수사란?',
    body:
      '고난도 사건은 여러 층의 함정과 이중 반전을 포함합니다. 질문 수를 아끼지 말고, 메모로 가설을 관리하세요. ' +
      '한 가설이 깨지면 다음 가설로 빠르게 전환하는 유연함이 필요합니다.',
    starters: [
      '사건에 두 개 이상의 해석 층이 있나요?',
      '핵심 단어의 의미가 일반적이지 않나요?',
      '시점(누가 말하는가)이 중요한가요?',
      '물리 법칙이 깨지는 요소가 있나요?',
      '결말을 알면 첫 문장의 의미가 바뀌나요?',
    ],
    learning: ['다층 가설 관리', '고난도 함정 패턴', '질문 효율 극대화'],
  },
  unknown: {
    title: '바다거북스프 수사란?',
    body: '예/아니요/상관없음 답변으로 진실을 좁혀 가는 추리 게임입니다.',
    starters: ['사건은 실내에서 일어났나요?', '시간이 중요한가요?'],
    learning: ['논리적 질문 설계'],
  },
};

const STRATEGY_BY_DIFFICULTY: Record<'easy' | 'medium' | 'hard', string[]> = {
  easy: [
    '넓은 범위 질문 5~8개로 사실 축(장소·인물·행동)을 먼저 고정하세요.',
    '가설 없이도 “예/아니요”로 제거할 수 있는 질문을 우선합니다.',
    '힌트 1회는 막혔을 때 방향 전환용으로 아껴 두세요.',
  ],
  medium: [
    '질문을 기록하며 중복·모순을 피하세요.',
    '“진실을 알 것 같아요”로 중간 점검 후 최종 추리로 넘어가세요.',
    '약 10~15회 질문 후 결론에 가까워지는 것이 일반적입니다.',
  ],
  hard: [
    '단어 하나(주어·장소·시간)의 정의를 의심해 보세요.',
    '가설 A/B를 번갈아 검증하는 방식이 효율적입니다.',
    '15회 이상 질문해도 정상입니다. 성급한 결론을 경계하세요.',
  ],
};

const INVESTIGATION_METHOD =
  '본 사건은 AI가 Case Knowledge(사건 지식)를 바탕으로 질문에 예/아니요/상관없음으로 답합니다. ' +
  '플레이어는 채팅형 수사를 통해 핵심 사실을 확인하고, 최종 추리 제출 시 정답과의 일치도(추리 정확도)로 채점됩니다. ' +
  '이 방식은 전통 바다거북스프의 “호스트 1인” 구조를 솔로·AI 환경으로 확장한 것입니다.';

export function buildCaseDossier(problem: Problem): CaseDossier {
  const difficulty = (problem.difficulty || 'medium') as 'easy' | 'medium' | 'hard';
  const raw = problem as Problem & { category?: string; explanation?: string | null };
  const category = (raw.category as CaseCategory) || detectCategory(problem.tags || [], difficulty);
  const guide = CATEGORY_GUIDE[category] || CATEGORY_GUIDE.mystery;

  return {
    caseNumber: caseNumberFromId(problem.id),
    title: problem.title,
    category,
    categoryLabel: CATEGORY_LABELS[category] || CATEGORY_LABELS.mystery,
    difficulty,
    stars: difficultyStars(difficulty),
    estimatedMinutes: estimatedMinutes(difficulty),
    playCount: problem.view_count || 0,
    synopsis: buildSynopsis(problem.content, problem.title),
    strategy: STRATEGY_BY_DIFFICULTY[difficulty],
    starterQuestions: guide.starters,
    categoryGuide: { title: guide.title, body: guide.body },
    investigationMethod: INVESTIGATION_METHOD,
    learningPoints: guide.learning,
    explanation: raw.explanation?.trim() || null,
    tags: problem.tags || [],
  };
}

/** Safe FAQ / schema text — never exposes raw answer. */
export function dossierFaqAnswer(dossier: CaseDossier): string {
  if (dossier.explanation) return dossier.explanation;
  const strategyHint = dossier.strategy[0] || '';
  return (
    `${dossier.title}은(는) ${dossier.categoryLabel} 유형의 바다거북스프 AI 수사 사건입니다. ` +
    `${dossier.synopsis} ` +
    `${dossier.categoryGuide.body.slice(0, 120)}… ` +
    `추천 전략: ${strategyHint} ` +
    `정답과 상세 해설은 직접 수사를 완료한 뒤 CASE CLOSED 화면에서 확인할 수 있습니다.`
  );
}

/** Editorial note when no author-written explanation exists. */
export function buildEditorialNote(dossier: CaseDossier): string {
  if (dossier.explanation) return dossier.explanation;
  return (
    `이 사건은 ${dossier.categoryLabel} 유형으로, 약 ${dossier.estimatedMinutes}분 분량의 AI 수사 퍼즐입니다. ` +
    `${dossier.categoryGuide.body} ` +
    `수사를 시작하기 전 ${dossier.starterQuestions.slice(0, 2).join(' ')} 같은 질문으로 방향을 잡아 보세요.`
  );
}
