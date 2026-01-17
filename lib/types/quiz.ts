/**
 * 퀴즈 플랫폼 타입 정의
 */

/**
 * 퀴즈 타입 enum
 */
export type QuizType =
  | 'soup'           // 바다거북스프 (싱글플레이 문제)
  | 'reasoning'      // 상황 추리 (싱글플레이 문제)
  | 'nonsense'       // 넌센스 퀴즈 (싱글플레이 문제)
  | 'mcq'            // 객관식 (4지선다) (싱글플레이 문제)
  | 'ox'             // OX 퀴즈 (싱글플레이 문제)
  | 'image'          // 이미지 기반 (싱글플레이 문제)
  | 'poll'           // 투표 (싱글플레이 문제)
  | 'balance'        // 밸런스 게임 (싱글플레이 문제)
  | 'logic'          // 논리 퍼즐 (두뇌 퀴즈) (싱글플레이 문제)
  | 'pattern'        // 수열/패턴 (두뇌 퀴즈) (싱글플레이 문제)
  | 'fill_blank'     // 빈칸 퀴즈 (단답형) (싱글플레이 문제)
  | 'order'          // 순서 맞추기 퀴즈 (싱글플레이 문제)
  | 'liar'           // 라이어 게임 (멀티플레이)
  | 'mafia'          // 마피아 (멀티플레이)
  | 'battle';        // 퀴즈 배틀 (싱글플레이 문제)

/**
 * 퀴즈 상태
 */
export type QuizStatus = 'draft' | 'published' | 'featured' | 'archived';

/**
 * 퀴즈 난이도
 */
export type QuizDifficulty = 1 | 2 | 3 | 4 | 5;

/**
 * 퀴즈 기본 정보
 */
export interface Quiz {
  id: string;
  type: QuizType;
  title: string;
  description?: string;
  creator_id?: string;
  status: QuizStatus;
  difficulty: QuizDifficulty;
  play_count: number;
  like_count: number;
  bookmark_count: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
  tags?: string[];
  estimated_time?: number; // 초 단위
  is_multiplayer: boolean;
  min_players: number;
  max_players: number;
}

/**
 * 퀴즈 콘텐츠 (타입별 구조화된 데이터)
 */

// 바다거북스프 (soup)
export interface SoupQuizContent {
  story: string;
  answer: string;
  hints?: string[];
}

// 객관식 (mcq, ox)
export interface MCQQuizContent {
  question: string;
  options: string[]; // 4개 (mcq) 또는 2개 (ox)
  correct: number; // 0-based index
  explanation?: string;
}

// 이미지 퀴즈 (image)
export interface ImageQuizContent {
  image_url: string;
  question?: string;
  answer: string;
  explanation?: string;
}

// 투표 (poll, balance)
export interface PollQuizContent {
  question: string;
  options: string[]; // 2개 이상
  show_stats: boolean;
  allow_multiple?: boolean;
}

// 통합 퀴즈 콘텐츠 타입
export type QuizContent = 
  | SoupQuizContent
  | MCQQuizContent
  | ImageQuizContent
  | PollQuizContent;

/**
 * 퀴즈 콘텐츠 (DB 저장용)
 */
export interface QuizContentRecord {
  id: string;
  quiz_id: string;
  content: QuizContent; // JSONB로 저장
  created_at: string;
  updated_at: string;
}

/**
 * 퀴즈 좋아요/싫어요
 */
export interface QuizVote {
  id: string;
  quiz_id: string;
  user_id: string;
  vote_type: 'like' | 'dislike';
  created_at: string;
}

/**
 * 퀴즈 북마크
 */
export interface QuizBookmark {
  id: string;
  quiz_id: string;
  user_id: string;
  created_at: string;
}

/**
 * 퀴즈 플레이 기록
 */
export interface QuizPlay {
  id: string;
  quiz_id: string;
  user_id: string;
  room_id?: string; // 멀티플레이 시
  result?: 'correct' | 'incorrect' | 'abandoned';
  score: number;
  time_spent: number; // 초 단위
  created_at: string;
}

/**
 * 크리에이터 팔로우
 */
export interface CreatorFollow {
  id: string;
  follower_id: string;
  creator_id: string;
  created_at: string;
}

/**
 * 퀴즈 타입별 메타데이터
 */
export interface QuizTypeMetadata {
  type: QuizType;
  name: string; // 한국어 이름
  nameEn: string; // 영어 이름
  icon: string; // 아이콘 이름
  description: string;
  playMode: 'single' | 'multi' | 'both';
  avgTime: string; // "30초~1분"
  inputType: string[]; // ['text', 'button', 'yes/no', 'objective', 'image', 'poll']
  answerType: 'single' | 'multiple' | 'explanation' | 'poll';
  adSuitability: 'high' | 'medium' | 'low';
  shareSuitability: 'high' | 'medium' | 'low';
  engagementLevel: 'high' | 'medium' | 'low';
}

/**
 * 퀴즈 타입별 메타데이터 맵
 */
export const QUIZ_TYPE_METADATA: Record<QuizType, QuizTypeMetadata> = {
  soup: {
    type: 'soup',
    name: '바다거북스프',
    nameEn: 'Turtle Soup',
    icon: 'soup',
    description: 'Yes/No 질문으로 진실을 추리하는 게임',
    playMode: 'both',
    avgTime: '5~15분',
    inputType: ['text', 'yes/no'],
    answerType: 'explanation',
    adSuitability: 'medium',
    shareSuitability: 'medium',
    engagementLevel: 'high',
  },
  reasoning: {
    type: 'reasoning',
    name: '상황 추리',
    nameEn: 'Reasoning',
    icon: 'reasoning',
    description: '힌트를 단계적으로 공개하며 추리하는 게임',
    playMode: 'both',
    avgTime: '3~5분',
    inputType: ['text', 'button'],
    answerType: 'explanation',
    adSuitability: 'high',
    shareSuitability: 'medium',
    engagementLevel: 'medium',
  },
  nonsense: {
    type: 'nonsense',
    name: '아재개그',
    nameEn: 'Nonsense Quiz',
    icon: 'nonsense',
    description: '말장난과 발상의 전환으로 재미를 주는 퀴즈',
    playMode: 'single',
    avgTime: '30초~1분',
    inputType: ['text', 'objective'],
    answerType: 'single',
    adSuitability: 'high',
    shareSuitability: 'high',
    engagementLevel: 'medium',
  },
  mcq: {
    type: 'mcq',
    name: '객관식 퀴즈',
    nameEn: 'Multiple Choice',
    icon: 'mcq',
    description: '4지선다 일반상식 퀴즈',
    playMode: 'both',
    avgTime: '30초~1분',
    inputType: ['objective'],
    answerType: 'single',
    adSuitability: 'high',
    shareSuitability: 'medium',
    engagementLevel: 'medium',
  },
  ox: {
    type: 'ox',
    name: 'OX 퀴즈',
    nameEn: 'True/False',
    icon: 'ox',
    description: '참/거짓을 판단하는 빠른 퀴즈',
    playMode: 'single',
    avgTime: '10~30초',
    inputType: ['yes/no'],
    answerType: 'single',
    adSuitability: 'high',
    shareSuitability: 'medium',
    engagementLevel: 'low',
  },
  image: {
    type: 'image',
    name: '이미지 퀴즈',
    nameEn: 'Image Quiz',
    icon: 'image',
    description: '사진을 보고 맞히는 퀴즈',
    playMode: 'single',
    avgTime: '30초~1분',
    inputType: ['image', 'text'],
    answerType: 'single',
    adSuitability: 'high',
    shareSuitability: 'high',
    engagementLevel: 'medium',
  },
  poll: {
    type: 'poll',
    name: '투표',
    nameEn: 'Poll',
    icon: 'poll',
    description: 'A vs B 선택, 결과 통계 공개',
    playMode: 'single',
    avgTime: '10~30초',
    inputType: ['poll'],
    answerType: 'poll',
    adSuitability: 'high',
    shareSuitability: 'high',
    engagementLevel: 'low',
  },
  balance: {
    type: 'balance',
    name: '밸런스 게임',
    nameEn: 'Balance Game',
    icon: 'balance',
    description: '당신의 선택은? 친구들과 비교',
    playMode: 'single',
    avgTime: '1~2분',
    inputType: ['poll'],
    answerType: 'poll',
    adSuitability: 'high',
    shareSuitability: 'high',
    engagementLevel: 'medium',
  },
  logic: {
    type: 'logic',
    name: '논리 퍼즐',
    nameEn: 'Logic Puzzle',
    icon: 'logic',
    description: '조건을 조합하여 답을 도출',
    playMode: 'single',
    avgTime: '5~10분',
    inputType: ['text', 'button'],
    answerType: 'single',
    adSuitability: 'low',
    shareSuitability: 'low',
    engagementLevel: 'high',
  },
  pattern: {
    type: 'pattern',
    name: '수열/패턴',
    nameEn: 'Pattern',
    icon: 'pattern',
    description: '숫자나 도형의 패턴을 찾는 문제',
    playMode: 'single',
    avgTime: '2~5분',
    inputType: ['text', 'number'],
    answerType: 'single',
    adSuitability: 'low',
    shareSuitability: 'low',
    engagementLevel: 'high',
  },
  liar: {
    type: 'liar',
    name: '라이어 게임',
    nameEn: 'Liar Game',
    icon: 'liar',
    description: '거짓말쟁이를 찾는 멀티플레이 게임',
    playMode: 'multi',
    avgTime: '10~20분',
    inputType: ['text', 'poll'],
    answerType: 'poll',
    adSuitability: 'low',
    shareSuitability: 'high',
    engagementLevel: 'high',
  },
  mafia: {
    type: 'mafia',
    name: '마피아',
    nameEn: 'Mafia',
    icon: 'mafia',
    description: '역할 기반 추리 게임',
    playMode: 'multi',
    avgTime: '20~40분',
    inputType: ['text', 'poll'],
    answerType: 'poll',
    adSuitability: 'low',
    shareSuitability: 'high',
    engagementLevel: 'high',
  },
  battle: {
    type: 'battle',
    name: '퀴즈 배틀',
    nameEn: 'Quiz Battle',
    icon: 'battle',
    description: '실시간 객관식 대전',
    playMode: 'multi',
    avgTime: '3~5분',
    inputType: ['objective'],
    answerType: 'single',
    adSuitability: 'medium',
    shareSuitability: 'medium',
    engagementLevel: 'medium',
  },
  fill_blank: {
    type: 'fill_blank',
    name: '빈칸 퀴즈',
    nameEn: 'Fill in the Blank',
    icon: 'fill-blank',
    description: '빈칸을 채워 완성하는 단답형 퀴즈',
    playMode: 'single',
    avgTime: '30초~1분',
    inputType: ['text'],
    answerType: 'single',
    adSuitability: 'high',
    shareSuitability: 'medium',
    engagementLevel: 'medium',
  },
  order: {
    type: 'order',
    name: '순서 맞추기',
    nameEn: 'Order Quiz',
    icon: 'order',
    description: '항목들을 올바른 순서로 배열하는 퀴즈',
    playMode: 'single',
    avgTime: '1~2분',
    inputType: ['drag', 'button'],
    answerType: 'multiple',
    adSuitability: 'medium',
    shareSuitability: 'medium',
    engagementLevel: 'medium',
  },
};

/**
 * 퀴즈 타입 목록 (우선순위 순)
 */
export const QUIZ_TYPES_BY_PRIORITY: QuizType[] = [
  'soup',      // MVP (기존)
  'nonsense',  // MVP
  'mcq',       // MVP
  'ox',        // MVP
  'image',     // 2단계
  'poll',      // 2단계
  'balance',   // 2단계
  'reasoning', // 2단계
  'logic',     // 3단계
  'pattern',   // 3단계
  'liar',      // 3단계
  'mafia',     // 3단계
  'battle',    // 3단계
];

/**
 * 멀티플레이 퀴즈 타입
 */
export const MULTIPLAYER_QUIZ_TYPES: QuizType[] = ['soup', 'liar', 'mafia'];

/**
 * 싱글플레이 문제 생성 타입
 */
export const SINGLE_PLAYER_PROBLEM_TYPES: QuizType[] = [
  'soup',
  'nonsense',
  'mcq',
  'ox',
  'image',
  'balance',
  'logic',
  'fill_blank',
];

/**
 * MVP 퀴즈 타입 (기존 호환성)
 */
export const MVP_QUIZ_TYPES: QuizType[] = ['soup', 'nonsense', 'mcq', 'ox'];

