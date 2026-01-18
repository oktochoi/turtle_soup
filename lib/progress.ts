// 레벨/XP/포인트/업적 시스템 핵심 로직
import { supabase } from '@/lib/supabase';
import type { 
  UserProgress, 
  Title, 
  Achievement, 
  XPEventType, 
  EventPayload, 
  EventResult,
  GameUser 
} from '@/types/progress';

/**
 * 레벨업에 필요한 XP 계산
 * requiredXP(level) = 100 * level
 */
export function requiredXP(level: number): number {
  return 100 * level;
}

/**
 * 현재 레벨에서 다음 레벨까지 필요한 XP
 */
export function xpToNextLevel(currentXP: number, currentLevel: number): number {
  return requiredXP(currentLevel + 1) - currentXP;
}

/**
 * XP를 추가하고 레벨업 체크
 * requiredXP(level) = 100 * level
 * 레벨 1 → 2: 100 XP 필요
 * 레벨 2 → 3: 200 XP 필요 (총 300 XP)
 * 레벨 3 → 4: 300 XP 필요 (총 600 XP)
 */
export function calculateLevel(xp: number): number {
  let level = 1;
  let totalRequired = 0;
  
  while (true) {
    const nextRequired = requiredXP(level);
    if (totalRequired + nextRequired > xp) {
      break;
    }
    totalRequired += nextRequired;
    level++;
    
    // 무한 루프 방지
    if (level > 1000) break;
  }
  
  return level;
}

/**
 * 게스트 ID로 유저 가져오기 또는 생성
 */
export async function getOrCreateUserByGuestId(guestId: string, nickname?: string): Promise<GameUser | null> {
  try {
    // 기존 유저 찾기
    const { data: existingUser, error: findError } = await supabase
      .from('game_users')
      .select('*')
      .eq('guest_id', guestId)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      console.error('유저 찾기 오류:', findError);
    }

    if (existingUser) {
      return existingUser;
    }

    // 새 유저 생성
    const { data: newUser, error: createError } = await supabase
      .from('game_users')
      .insert({
        guest_id: guestId,
        nickname: nickname || `게스트${guestId.substring(0, 6)}`,
      })
      .select()
      .single();

    if (createError) {
      console.error('유저 생성 오류:', createError);
      return null;
    }

    // 초기 progress 생성
    await supabase
      .from('user_progress')
      .insert({
        user_id: newUser.id,
        level: 1,
        xp: 0,
        points: 0,
      });

    return newUser;
  } catch (error) {
    console.error('getOrCreateUserByGuestId 오류:', error);
    return null;
  }
}

/**
 * Auth User ID로 유저 가져오기 또는 생성
 */
export async function getOrCreateUserByAuthId(authUserId: string, nickname?: string): Promise<GameUser | null> {
  try {
    // 기존 유저 찾기
    const { data: existingUser, error: findError } = await supabase
      .from('game_users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      console.error('유저 찾기 오류:', findError);
    }

    if (existingUser) {
      return existingUser;
    }

    // 새 유저 생성
    const { data: newUser, error: createError } = await supabase
      .from('game_users')
      .insert({
        auth_user_id: authUserId,
        nickname: nickname || `사용자${authUserId.substring(0, 8)}`,
      })
      .select()
      .single();

    if (createError) {
      console.error('유저 생성 오류:', createError);
      return null;
    }

    // 초기 progress 생성
    await supabase
      .from('user_progress')
      .insert({
        user_id: newUser.id,
        level: 1,
        xp: 0,
        points: 0,
      });

    return newUser;
  } catch (error) {
    console.error('getOrCreateUserByAuthId 오류:', error);
    return null;
  }
}

/**
 * 일일 XP 리셋 체크 및 처리
 */
async function resetDailyXPIfNeeded(userId: string, progress: UserProgress): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  if (progress.daily_xp_reset_date !== today) {
    await supabase
      .from('user_progress')
      .update({
        daily_comment_xp: 0,
        daily_post_xp: 0,
        daily_xp_reset_date: today,
      })
      .eq('user_id', userId);
  }
}

/**
 * XP 이벤트별 획득량 계산
 */
function calculateXPGain(
  eventType: XPEventType,
  payload: EventPayload,
  progress: UserProgress
): { xp: number; points: number } {
  let xp = 0;
  let points = 0;

  switch (eventType) {
    case 'daily_participate':
      xp = 15;
      points = 10;
      break;
    
    case 'solve_success':
      xp = 30;
      points = 20;
      
      // 힌트 없이 성공 보너스
      if (payload.usedHint === false) {
        xp += 20;
      }
      
      // 질문 수 보너스
      if (payload.questionCount !== undefined) {
        if (payload.questionCount <= 3) {
          xp += 40;
        } else if (payload.questionCount <= 10) {
          xp += 15;
        }
      }
      break;
    
    case 'solve_fail':
      xp = 10;
      break;
    
    case 'comment':
      // 하루 최대 40XP (댓글당 2XP)
      const remainingCommentXP = Math.max(0, 40 - progress.daily_comment_xp);
      xp = Math.min(2, remainingCommentXP);
      break;
    
    case 'post':
      // 하루 최대 50XP (게시글당 10XP)
      const remainingPostXP = Math.max(0, 50 - progress.daily_post_xp);
      xp = Math.min(10, remainingPostXP);
      break;
    
    default:
      xp = 0;
  }

  return { xp, points };
}

/**
 * 업적 달성 체크
 */
async function checkAchievements(
  userId: string,
  progress: UserProgress
): Promise<Achievement[]> {
  const unlocked: Achievement[] = [];

  try {
    // 모든 업적 가져오기
    const { data: allAchievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('*');

    if (achievementsError || !allAchievements) {
      return unlocked;
    }

    // 이미 달성한 업적 가져오기
    const { data: completedAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId);

    const completedIds = new Set(
      (completedAchievements || []).map(a => a.achievement_id)
    );

    // game_users에서 auth_user_id 가져오기 (실제 문제 해결 카운트를 위해)
    const { data: gameUser } = await supabase
      .from('game_users')
      .select('auth_user_id')
      .eq('id', userId)
      .maybeSingle();

    const authUserId = gameUser?.auth_user_id;

    // 실제 DB에서 문제 해결 카운트 가져오기
    let actualSolveCount = 0;
    if (authUserId) {
      const { count } = await supabase
        .from('user_problem_solves')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUserId);
      actualSolveCount = count || 0;
    }

    // 실제 댓글 수 가져오기
    let actualCommentCount = 0;
    if (authUserId) {
      const { count } = await supabase
        .from('problem_comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUserId);
      actualCommentCount = count || 0;
    }

    // 실제 게시글 수 가져오기
    let actualPostCount = 0;
    if (authUserId) {
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUserId);
      actualPostCount = count || 0;
    }

    // 각 업적 조건 체크 - 실제 DB 값 사용
    for (const achievement of allAchievements) {
      if (completedIds.has(achievement.id)) continue;

      let conditionMet = false;

      switch (achievement.condition_type) {
        case 'streak_gte':
          conditionMet = progress.current_streak >= achievement.condition_value;
          break;
        
        case 'daily_participation_count_gte':
          conditionMet = progress.total_participations >= achievement.condition_value;
          break;
        
        case 'solve_count_gte':
          // 실제 DB에서 카운트한 값 사용
          conditionMet = actualSolveCount >= achievement.condition_value;
          break;
        
        case 'nohint_solve_count_gte':
          // user_progress의 nohint_solves 사용 (이 값은 정확하게 업데이트되어야 함)
          conditionMet = progress.nohint_solves >= achievement.condition_value;
          break;
        
        case 'under3q_solve_count_gte':
          // user_progress의 under3q_solves 사용 (이 값은 정확하게 업데이트되어야 함)
          conditionMet = progress.under3q_solves >= achievement.condition_value;
          break;
        
        case 'level_gte':
          conditionMet = progress.level >= achievement.condition_value;
          break;
        
        case 'total_comments_gte':
          // 실제 DB에서 카운트한 값 사용
          conditionMet = actualCommentCount >= achievement.condition_value;
          break;
        
        case 'total_posts_gte':
          // 실제 DB에서 카운트한 값 사용
          conditionMet = actualPostCount >= achievement.condition_value;
          break;
      }

      if (conditionMet) {
        // 업적 달성 기록
        await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_id: achievement.id,
          });

        unlocked.push(achievement);
      }
    }
  } catch (error) {
    console.error('업적 체크 오류:', error);
  }

  return unlocked;
}

/**
 * 칭호 해금 체크
 */
async function checkTitles(
  userId: string,
  progress: UserProgress
): Promise<Title[]> {
  const unlocked: Title[] = [];

  try {
    // 모든 칭호 가져오기
    const { data: allTitles, error: titlesError } = await supabase
      .from('titles')
      .select('*');

    if (titlesError || !allTitles) {
      return unlocked;
    }

    // 이미 획득한 칭호 가져오기
    const { data: userTitles } = await supabase
      .from('user_titles')
      .select('title_id')
      .eq('user_id', userId);

    const ownedIds = new Set(
      (userTitles || []).map(t => t.title_id)
    );

    // 각 칭호 조건 체크
    for (const title of allTitles) {
      if (ownedIds.has(title.id)) continue;

      let conditionMet = false;

      switch (title.unlock_type) {
        case 'level':
          conditionMet = progress.level >= (title.unlock_value || 0);
          break;
        
        case 'streak':
          conditionMet = progress.current_streak >= (title.unlock_value || 0);
          break;
        
        case 'solve_count':
          if (title.name === '완벽주의자') {
            conditionMet = progress.nohint_solves >= (title.unlock_value || 0);
          } else if (title.name === '천재 탐정') {
            conditionMet = progress.under3q_solves >= (title.unlock_value || 0);
          }
          break;
        
        case 'achievement':
          // 업적 기반 칭호는 업적 달성 시 자동 해금
          break;
        
        case 'manual':
          // 수동 해금만 가능
          break;
      }

      if (conditionMet) {
        // 칭호 획득 기록
        await supabase
          .from('user_titles')
          .insert({
            user_id: userId,
            title_id: title.id,
          });

        unlocked.push(title);
      }
    }
  } catch (error) {
    console.error('칭호 체크 오류:', error);
  }

  return unlocked;
}

/**
 * 스트릭 업데이트
 */
async function updateStreak(userId: string, progress: UserProgress): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const lastDate = progress.last_participation_date;

  let newStreak = progress.current_streak;
  let newBestStreak = progress.best_streak;

  if (!lastDate) {
    // 첫 참여
    newStreak = 1;
  } else {
    const lastDateObj = new Date(lastDate);
    const todayObj = new Date(today);
    const diffDays = Math.floor((todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // 연속 참여
      newStreak = progress.current_streak + 1;
    } else if (diffDays > 1) {
      // 연속이 끊김
      newStreak = 1;
    }
    // diffDays === 0이면 오늘 이미 참여함 (스트릭 유지)
  }

  if (newStreak > newBestStreak) {
    newBestStreak = newStreak;
  }

  await supabase
    .from('user_progress')
    .update({
      current_streak: newStreak,
      best_streak: newBestStreak,
      last_participation_date: today,
    })
    .eq('user_id', userId);
}

/**
 * 메인 이벤트 처리 함수
 */
export async function applyEvent(
  userId: string,
  eventType: XPEventType,
  payload: EventPayload = {}
): Promise<EventResult> {
  try {
    // Progress 가져오기
    const { data: progress, error: progressError } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (progressError || !progress) {
      return {
        success: false,
        newLevel: 1,
        gainedXP: 0,
        gainedPoints: 0,
        leveledUp: false,
        unlockedTitles: [],
        unlockedAchievements: [],
        error: 'Progress를 찾을 수 없습니다.',
      };
    }

    // 일일 XP 리셋 체크
    await resetDailyXPIfNeeded(userId, progress);

    // 최신 progress 다시 가져오기
    const { data: freshProgress } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!freshProgress) {
      throw new Error('Progress를 가져올 수 없습니다.');
    }

    // XP/포인트 계산
    const { xp: gainedXP, points: gainedPoints } = calculateXPGain(
      eventType,
      payload,
      freshProgress
    );

    if (gainedXP === 0 && gainedPoints === 0) {
      // 일일 한도 도달 등으로 획득량이 0인 경우
      return {
        success: true,
        newLevel: freshProgress.level,
        gainedXP: 0,
        gainedPoints: 0,
        leveledUp: false,
        unlockedTitles: [],
        unlockedAchievements: [],
      };
    }

    // 새 XP 계산
    const newXP = freshProgress.xp + gainedXP;
    const newLevel = calculateLevel(newXP);
    const leveledUp = newLevel > freshProgress.level;

    // Progress 업데이트
    const updateData: any = {
      xp: newXP,
      level: newLevel,
      points: freshProgress.points + gainedPoints,
    };

    // 이벤트별 통계 업데이트
    switch (eventType) {
      case 'daily_participate':
        updateData.total_participations = freshProgress.total_participations + 1;
        break;
      
      case 'solve_success':
        updateData.total_solves = freshProgress.total_solves + 1;
        if (payload.usedHint === false) {
          updateData.nohint_solves = freshProgress.nohint_solves + 1;
        }
        if (payload.questionCount !== undefined && payload.questionCount <= 3) {
          updateData.under3q_solves = freshProgress.under3q_solves + 1;
        }
        break;
      
      case 'comment':
        updateData.total_comments = freshProgress.total_comments + 1;
        updateData.daily_comment_xp = freshProgress.daily_comment_xp + gainedXP;
        break;
      
      case 'post':
        updateData.total_posts = freshProgress.total_posts + 1;
        updateData.daily_post_xp = freshProgress.daily_post_xp + gainedXP;
        break;
    }

    // 스트릭 업데이트 (daily_participate 이벤트인 경우)
    if (eventType === 'daily_participate') {
      await updateStreak(userId, freshProgress);
    }

    // Progress 업데이트
    const { error: updateError } = await supabase
      .from('user_progress')
      .update(updateData)
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    // XP 이벤트 기록
    await supabase
      .from('xp_events')
      .insert({
        user_id: userId,
        event_type: eventType,
        xp_gained: gainedXP,
        points_gained: gainedPoints,
        metadata: payload,
      });

    // 업적 체크
    const { data: updatedProgress } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!updatedProgress) {
      throw new Error('업데이트된 Progress를 가져올 수 없습니다.');
    }

    const unlockedAchievements = await checkAchievements(userId, updatedProgress);
    
    // 업적 보상 적용
    if (unlockedAchievements.length > 0) {
      let bonusXP = 0;
      let bonusPoints = 0;
      const rewardTitleIds: number[] = [];

      for (const achievement of unlockedAchievements) {
        bonusXP += achievement.reward_xp;
        bonusPoints += achievement.reward_points;
        if (achievement.reward_title_id) {
          rewardTitleIds.push(achievement.reward_title_id);
        }
      }

      if (bonusXP > 0 || bonusPoints > 0) {
        const finalXP = updatedProgress.xp + bonusXP;
        const finalLevel = calculateLevel(finalXP);

        await supabase
          .from('user_progress')
          .update({
            xp: finalXP,
            level: finalLevel,
            points: updatedProgress.points + bonusPoints,
          })
          .eq('user_id', userId);

        // 업적 보상 칭호 해금
        for (const titleId of rewardTitleIds) {
          await supabase
            .from('user_titles')
            .insert({
              user_id: userId,
              title_id: titleId,
            })
            .then(() => {
              // 중복 무시
            });
        }
      }
    }

    // 칭호 체크
    const { data: finalProgress } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!finalProgress) {
      throw new Error('최종 Progress를 가져올 수 없습니다.');
    }

    const unlockedTitles = await checkTitles(userId, finalProgress);

    // 칭호 언락 후 업적도 다시 체크 (칭호 조건 달성으로 업적도 달성될 수 있음)
    const additionalAchievements = await checkAchievements(userId, finalProgress);
    const allUnlockedAchievements = [...unlockedAchievements, ...additionalAchievements];

    return {
      success: true,
      newLevel: finalProgress.level,
      gainedXP: gainedXP + allUnlockedAchievements.reduce((sum, a) => sum + a.reward_xp, 0),
      gainedPoints: gainedPoints + allUnlockedAchievements.reduce((sum, a) => sum + a.reward_points, 0),
      leveledUp: leveledUp,
      unlockedTitles,
      unlockedAchievements: allUnlockedAchievements,
    };
  } catch (error: any) {
    console.error('applyEvent 오류:', error);
    return {
      success: false,
      newLevel: 1,
      gainedXP: 0,
      gainedPoints: 0,
      leveledUp: false,
      unlockedTitles: [],
      unlockedAchievements: [],
      error: error.message || '알 수 없는 오류',
    };
  }
}

