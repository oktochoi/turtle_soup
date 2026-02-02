export type Question = {
  id: string;
  room_code: string;
  nickname: string;
  text: string;
  answer: 'yes' | 'no' | 'irrelevant' | null;
  created_at: string;
};

export type Guess = {
  id: string;
  room_code: string;
  nickname: string;
  text: string;
  judged: boolean;
  correct: boolean;
  created_at: string;
};

export type Room = {
  id: string;
  code: string;
  story: string;
  truth: string;
  max_questions: number;
  host_nickname: string;
  game_ended: boolean;
  status: 'active' | 'done';
  created_at: string;
  hints?: string[] | null; // 최대 3개의 힌트
  quiz_type?: 'soup' | 'reasoning' | 'nonsense' | 'mcq' | 'ox' | 'image' | 'poll' | 'balance' | 'logic' | 'pattern' | 'liar' | 'mafia' | 'battle' | null; // 퀴즈 유형
};

export type Player = {
  id: string;
  room_code: string;
  nickname: string;
  is_host: boolean;
  joined_at: string;
};

export type Problem = {
  id: string;
  title: string;
  content: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard'; // 하위 호환성을 위해 유지, 실제로는 사용 안 함
  tags: string[];
  author?: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  user_id?: string;
  hints?: string[] | null; // 최대 3개의 힌트
  explanation?: string | null; // 해설/배경지식 (AdSense 품질 강화용)
  // 별점 관련 (계산된 값)
  average_rating?: number;
  rating_count?: number;
  user_rating?: number; // 현재 사용자의 별점
};

export type ProblemDifficultyRating = {
  id: string;
  problem_id: string;
  user_identifier: string;
  rating: number; // 1-5점
  created_at: string;
  updated_at: string;
};

export type ProblemQuestion = {
  id: string;
  problem_id: string;
  nickname: string;
  text: string;
  answer: 'yes' | 'no' | 'irrelevant' | 'decisive' | null;
  created_at: string;
};

export type ProblemComment = {
  id: string;
  problem_id: string;
  nickname: string;
  text: string;
  created_at: string;
  updated_at?: string;
  user_id?: string;
  is_spoiler?: boolean;
  parent_id?: string | null;
};

export type ProblemUserAnswer = {
  id: string;
  problem_id: string;
  user_id: string | null;
  nickname: string;
  answer_text: string;
  similarity_score: number | null;
  like_count: number;
  reply_count: number;
  created_at: string;
};

export type ProblemAnswerReply = {
  id: string;
  answer_id: string;
  parent_reply_id: string | null;
  user_id: string | null;
  nickname: string;
  text: string;
  created_at: string;
};

