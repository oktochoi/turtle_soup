'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import LevelBadge from '@/components/LevelBadge';
import type { UserProgress, Title, Achievement } from '@/types/progress';
import { requiredXP, xpToNextLevel } from '@/lib/progress';
import { useTranslations } from '@/hooks/useTranslations';

export default function ProfilePage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const userId = resolvedParams.id;
  const router = useRouter();
  const t = useTranslations();

  const [user, setUser] = useState<any>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [titles, setTitles] = useState<Title[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userTitles, setUserTitles] = useState<number[]>([]);
  const [userAchievements, setUserAchievements] = useState<number[]>([]);
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actualSolveCount, setActualSolveCount] = useState<number>(0);
  const [receivedHearts, setReceivedHearts] = useState<number>(0);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      // 유저 정보
      const { data: userData } = await supabase
        .from('game_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!userData) {
        router.push(`/${lang}`);
        return;
      }

      setUser(userData);

      // Progress
      const { data: progressData } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (progressData) {
        setProgress(progressData);
        setSelectedTitleId(progressData.selected_title_id);
      }

      // 모든 칭호
      const { data: allTitles } = await supabase
        .from('titles')
        .select('*')
        .order('id');

      if (allTitles) {
        setTitles(allTitles);
      }

      // 사용자 칭호
      const { data: userTitlesData } = await supabase
        .from('user_titles')
        .select('title_id')
        .eq('user_id', userId);

      if (userTitlesData) {
        setUserTitles(userTitlesData.map(t => t.title_id));
      }

      // 모든 업적
      const { data: allAchievements } = await supabase
        .from('achievements')
        .select('*')
        .order('id');

      if (allAchievements) {
        setAchievements(allAchievements);
      }

      // 사용자 업적
      const { data: userAchievementsData } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId);

      if (userAchievementsData) {
        setUserAchievements(userAchievementsData.map(a => a.achievement_id));
      }

      // 실제 해결한 문제 수 가져오기 (user_problem_solves에서)
      if (userData.auth_user_id) {
        const { count: solveCount } = await supabase
          .from('user_problem_solves')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userData.auth_user_id);

        setActualSolveCount(solveCount || 0);
      }

      // 받은 하트 수 계산 (작성한 문제들의 like_count 합계)
      // game_users의 auth_user_id로 problems 테이블에서 찾기
      if (userData.auth_user_id) {
        const { data: userProblems } = await supabase
          .from('problems')
          .select('like_count')
          .eq('user_id', userData.auth_user_id);

        if (userProblems) {
          const totalHearts = userProblems.reduce((sum, p) => sum + (p.like_count || 0), 0);
          setReceivedHearts(totalHearts);
        }
      }
    } catch (error) {
      console.error('프로필 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTitle = async (titleId: number) => {
    if (!progress) return;

    try {
      const { error } = await supabase
        .from('user_progress')
        .update({ selected_title_id: titleId })
        .eq('user_id', userId);

      if (error) throw error;

      setSelectedTitleId(titleId);
      setProgress({ ...progress, selected_title_id: titleId });
    } catch (error) {
      console.error('칭호 선택 오류:', error);
      alert(t.profile.selectTitleFail);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 to-amber-500 border-yellow-400';
      case 'epic': return 'from-purple-500 to-pink-500 border-purple-400';
      case 'rare': return 'from-blue-500 to-cyan-500 border-blue-400';
      default: return 'from-slate-500 to-slate-600 border-slate-400';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{t.profile.loadingProfile}</p>
        </div>
      </div>
    );
  }

  if (!user || !progress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{t.profile.profileNotFound}</p>
          <Link href={`/${lang}`}>
            <button className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg">
              {t.common.home}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // 현재 레벨에서의 XP 계산
  let totalRequiredForCurrentLevel = 0;
  for (let i = 1; i < progress.level; i++) {
    totalRequiredForCurrentLevel += requiredXP(i);
  }
  
  const currentLevelXP = progress.xp - totalRequiredForCurrentLevel;
  const nextLevelXP = requiredXP(progress.level);
  const xpProgress = Math.min(100, Math.max(0, (currentLevelXP / nextLevelXP) * 100));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
        <div className="mb-6">
          <Link href={`/${lang}`}>
            <button className="text-slate-400 hover:text-white transition-colors text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>

        {/* 프로필 헤더 */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 sm:p-8 border border-slate-700/50 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center text-2xl sm:text-3xl font-bold">
              {user.nickname.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">{user.nickname}</h1>
              <LevelBadge level={progress.level} size="lg" />
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
              <span>{t.profile.xp}</span>
              <span>{currentLevelXP} / {nextLevelXP} XP</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {t.profile.nextLevel} {xpToNextLevel(progress.xp, progress.level)} {t.profile.xpNeeded}
            </p>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-400">{progress.points}</div>
              <div className="text-xs text-slate-400">{t.profile.points}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{progress.current_streak}</div>
              <div className="text-xs text-slate-400">{t.profile.streak}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{actualSolveCount}</div>
              <div className="text-xs text-slate-400">{t.profile.solved}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-400">{receivedHearts}</div>
              <div className="text-xs text-slate-400">{t.profile.hearts}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{userTitles.length}</div>
              <div className="text-xs text-slate-400">{t.profile.titles}</div>
            </div>
          </div>
        </div>

        {/* 대표 칭호 선택 */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50 mb-6">
          <h2 className="text-xl font-bold mb-4">{t.profile.selectedTitle}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {titles
              .filter(t => userTitles.includes(t.id))
              .map((title) => (
                <button
                  key={title.id}
                  onClick={() => handleSelectTitle(title.id)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    selectedTitleId === title.id
                      ? `bg-gradient-to-r ${getRarityColor(title.rarity)} text-white border-transparent`
                      : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {title.icon && <span>{title.icon}</span>}
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {lang === 'en' && (title as any).name_en ? (title as any).name_en : title.name}
                      </div>
                      {((lang === 'en' && (title as any).description_en) || title.description) && (
                        <div className="text-xs opacity-75 mt-1">
                          {lang === 'en' && (title as any).description_en ? (title as any).description_en : title.description}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
          </div>
          {titles.filter(t => userTitles.includes(t.id)).length === 0 && (
            <p className="text-slate-400 text-center py-4">{t.profile.noTitles}</p>
          )}
        </div>

        {/* 업적 */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-bold mb-4">{t.profile.achievements}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {achievements.map((achievement) => {
              const isUnlocked = userAchievements.includes(achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isUnlocked
                      ? `bg-gradient-to-r ${getRarityColor(achievement.rarity)} text-white border-transparent`
                      : 'bg-slate-700/30 text-slate-400 border-slate-600 opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {achievement.icon && (
                      <span className="text-2xl">{achievement.icon}</span>
                    )}
                    <div className="flex-1">
                      <div className="font-semibold mb-1">
                        {lang === 'en' && (achievement as any).name_en ? (achievement as any).name_en : achievement.name}
                      </div>
                      <div className="text-xs opacity-75">
                        {lang === 'en' && (achievement as any).description_en ? (achievement as any).description_en : achievement.description}
                      </div>
                      {isUnlocked && (
                        <div className="text-xs mt-2 opacity-75">
                          {t.common.reward}: +{achievement.reward_xp} XP, +{achievement.reward_points} P
                        </div>
                      )}
                    </div>
                    {!isUnlocked && (
                      <i className="ri-lock-line text-lg"></i>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {achievements.length === 0 && (
            <p className="text-slate-400 text-center py-4">{t.profile.noAchievements}</p>
          )}
        </div>
      </div>
    </div>
  );
}

