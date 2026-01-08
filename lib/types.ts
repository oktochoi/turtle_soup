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
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  author: string;
  admin_password: string;
  like_count: number;
  comment_count: number;
  view_count: number;
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
};

