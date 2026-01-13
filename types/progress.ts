export type GameUser = {
  id: string;
  nickname: string;
  guest_id: string | null;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type UserProgress = {
  user_id: string;
  level: number;
  xp: number;
  points: number;
  current_streak: number;
  best_streak: number;
  last_participation_date: string | null;
  selected_title_id: number | null;
  total_solves: number;
  total_participations: number;
  total_comments: number;
  total_posts: number;
  nohint_solves: number;
  under3q_solves: number;
  daily_comment_xp: number;
  daily_post_xp: number;
  daily_xp_reset_date: string;
  created_at: string;
  updated_at: string;
};

export type Title = {
  id: number;
  name: string;
  description: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlock_type: 'level' | 'achievement' | 'streak' | 'solve_count' | 'manual';
  unlock_value: number | null;
  icon: string | null;
  created_at: string;
};

export type Achievement = {
  id: number;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  condition_type: 
    | 'streak_gte' 
    | 'daily_participation_count_gte' 
    | 'solve_count_gte'
    | 'nohint_solve_count_gte' 
    | 'under3q_solve_count_gte' 
    | 'level_gte'
    | 'total_comments_gte' 
    | 'total_posts_gte';
  condition_value: number;
  reward_xp: number;
  reward_points: number;
  reward_title_id: number | null;
  icon: string | null;
  created_at: string;
};

export type UserAchievement = {
  user_id: string;
  achievement_id: number;
  completed_at: string;
};

export type XPEventType = 
  | 'daily_participate'
  | 'solve_success'
  | 'solve_fail'
  | 'comment'
  | 'post'
  | 'nohint_solve_bonus'
  | 'under10q_bonus'
  | 'under3q_bonus';

export type EventPayload = {
  questionCount?: number;
  usedHint?: boolean;
  similarity?: number;
  [key: string]: any;
};

export type EventResult = {
  success: boolean;
  newLevel: number;
  gainedXP: number;
  gainedPoints: number;
  leveledUp: boolean;
  unlockedTitles: Title[];
  unlockedAchievements: Achievement[];
  error?: string;
};

