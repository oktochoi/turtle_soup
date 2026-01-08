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

