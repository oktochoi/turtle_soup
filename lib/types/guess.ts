/**
 * 맞추기(Guess Set) 게임 타입 정의
 */

/**
 * GuessSet (맞추기 세트)
 */
export interface GuessSet {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  cover_image_url?: string; // 세트 소개 이미지
  default_time_per_card: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * GuessCard (맞추기 카드)
 */
export interface GuessCard {
  id: string;
  set_id: string;
  card_type: 'text' | 'ox' | 'media'; // 카드 타입
  question: string; // 질문 (필수)
  images: string[]; // image urls (선택사항)
  media_url?: string; // YouTube 링크 (media 타입용)
  answers: string[]; // 정답 및 동의어
  hint?: string; // deprecated
  time_limit_sec?: number; // deprecated
  order_index: number;
  created_at: string;
  updated_at: string;
}

/**
 * GuessSession (플레이 세션)
 */
export interface GuessSession {
  id: string;
  user_id: string;
  set_id: string;
  total_count: number;
  correct_count: number;
  pass_count: number;
  started_at: string;
  ended_at?: string;
  settings: {
    count: number;
    timeMode: 'individual' | 'common';
    timePerCardSec?: number;
    hintAllowed: boolean;
  };
  created_at: string;
}

/**
 * GuessSessionItem (세션 아이템)
 */
export interface GuessSessionItem {
  id: string;
  session_id: string;
  card_id: string;
  order_index: number;
  is_correct?: boolean;
  is_pass?: boolean;
  spent_sec?: number;
  created_at: string;
}

