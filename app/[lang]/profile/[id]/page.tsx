'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import LevelBadge from '@/components/LevelBadge';
import type { UserProgress, Title, Achievement } from '@/types/progress';
import { requiredXP, xpToNextLevel } from '@/lib/progress';
import { useTranslations } from '@/hooks/useTranslations';
import { useAuth } from '@/lib/hooks/useAuth';
import { handleError } from '@/lib/error-handler';

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
  const { user: currentUser } = useAuth();
  
  // 신고 관련 state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<'spam' | 'harassment' | 'inappropriate_content' | 'fake_account' | 'other'>('spam');
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  
  // 닉네임 수정 관련 state
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);

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

  // Toast 헬퍼 함수
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    if (typeof window !== 'undefined' && (window as any)[`toast${type.charAt(0).toUpperCase() + type.slice(1)}`]) {
      (window as any)[`toast${type.charAt(0).toUpperCase() + type.slice(1)}`](message);
    } else {
      alert(message);
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
      showToast(lang === 'ko' ? '칭호가 변경되었습니다.' : 'Title has been changed.', 'success');
    } catch (error) {
      console.error('칭호 선택 오류:', error);
      showToast(t.profile.selectTitleFail, 'error');
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

  const handleSubmitReport = async () => {
    if (!reportReason.trim()) {
      if (typeof window !== 'undefined' && (window as any).toastWarning) {
        (window as any).toastWarning(lang === 'ko' ? '신고 사유를 입력해주세요.' : 'Please enter a report reason.');
      }
      return;
    }

    // 자기 자신을 신고하는 것 방지
    if (user?.auth_user_id && currentUser?.id === user.auth_user_id) {
      if (typeof window !== 'undefined' && (window as any).toastWarning) {
        (window as any).toastWarning(lang === 'ko' ? '자기 자신을 신고할 수 없습니다.' : 'You cannot report yourself.');
      }
      return;
    }

    setIsSubmittingReport(true);
    try {
      // 게스트 사용자 식별자 가져오기
      let userIdentifier: string | null = null;
      if (!currentUser) {
        if (typeof window !== 'undefined') {
          userIdentifier = localStorage.getItem('guest_id') || `guest_${Date.now()}`;
          if (!localStorage.getItem('guest_id')) {
            localStorage.setItem('guest_id', userIdentifier);
          }
        }
      }

      const reportData = {
        reported_user_id: userId, // game_users의 id
        reporter_user_id: currentUser?.id || null,
        reporter_identifier: userIdentifier,
        report_type: reportType,
        reason: reportReason.trim(),
        description: reportDescription.trim() || null,
        status: 'pending',
      };

      const { error } = await supabase
        .from('user_reports')
        .insert(reportData);

      if (error) {
        // 중복 신고 에러 처리
        if (error.message?.includes('already reported') || error.message?.includes('24 hours')) {
          if (typeof window !== 'undefined' && (window as any).toastWarning) {
            (window as any).toastWarning(lang === 'ko' ? '24시간 이내에 같은 사유로 이미 신고하셨습니다.' : 'You have already reported this user for the same reason within the last 24 hours.');
          }
          return;
        }
        throw error;
      }

      if (typeof window !== 'undefined' && (window as any).toastSuccess) {
        (window as any).toastSuccess(lang === 'ko' ? '신고가 접수되었습니다. 검토 후 조치하겠습니다.' : 'Report submitted. We will review and take action.');
      }

      // 모달 닫기 및 상태 초기화
      setShowReportModal(false);
      setReportType('spam');
      setReportReason('');
      setReportDescription('');
    } catch (error) {
      handleError(error, '유저 신고', true);
    } finally {
      setIsSubmittingReport(false);
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
              {(isEditingNickname ? newNickname : user.nickname).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              {isEditingNickname ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    className="text-2xl sm:text-3xl font-bold bg-slate-700 border border-slate-600 rounded-lg px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    maxLength={20}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveNickname();
                      } else if (e.key === 'Escape') {
                        handleCancelEditNickname();
                      }
                    }}
                  />
                  <button
                    onClick={handleSaveNickname}
                    disabled={isSavingNickname}
                    className="px-3 py-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingNickname ? (lang === 'ko' ? '저장 중...' : 'Saving...') : (lang === 'ko' ? '저장' : 'Save')}
                  </button>
                  <button
                    onClick={handleCancelEditNickname}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm font-semibold"
                  >
                    {lang === 'ko' ? '취소' : 'Cancel'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold">{user.nickname}</h1>
                  {/* 자기 자신의 프로필일 때만 수정 버튼 표시 */}
                  {((user.auth_user_id && currentUser?.id === user.auth_user_id) || (!user.auth_user_id && !currentUser)) && (
                    <button
                      onClick={handleEditNickname}
                      className="p-1.5 text-slate-400 hover:text-teal-400 transition-colors"
                      title={lang === 'ko' ? '닉네임 수정' : 'Edit nickname'}
                    >
                      <i className="ri-edit-line text-lg"></i>
                    </button>
                  )}
                </div>
              )}
              <LevelBadge level={progress.level} size="lg" />
            </div>
            {/* 신고하기 버튼 (자기 자신이 아닐 때만 표시) */}
            {user?.auth_user_id && currentUser?.id !== user.auth_user_id && (
              <button
                onClick={() => setShowReportModal(true)}
                className="px-3 sm:px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg transition-all text-sm font-semibold flex items-center gap-2"
              >
                <i className="ri-flag-line"></i>
                <span className="hidden sm:inline">{lang === 'ko' ? '신고하기' : 'Report'}</span>
              </button>
            )}
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

      {/* 신고 모달 */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl p-6 sm:p-8 border border-slate-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {lang === 'ko' ? '유저 신고하기' : 'Report User'}
              </h2>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportType('spam');
                  setReportReason('');
                  setReportDescription('');
                }}
                className="text-slate-400 hover:text-white transition-colors text-2xl"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              {/* 신고 유형 선택 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {lang === 'ko' ? '신고 유형' : 'Report Type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'spam', label: lang === 'ko' ? '스팸' : 'Spam', icon: 'ri-spam-line' },
                    { value: 'harassment', label: lang === 'ko' ? '괴롭힘' : 'Harassment', icon: 'ri-user-forbid-line' },
                    { value: 'inappropriate_content', label: lang === 'ko' ? '부적절한 내용' : 'Inappropriate', icon: 'ri-prohibited-line' },
                    { value: 'fake_account', label: lang === 'ko' ? '가짜 계정' : 'Fake Account', icon: 'ri-user-unfollow-line' },
                    { value: 'other', label: lang === 'ko' ? '기타' : 'Other', icon: 'ri-more-line' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setReportType(type.value as any)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        reportType === type.value
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <i className={type.icon}></i>
                      <span>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 신고 사유 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {lang === 'ko' ? '신고 사유 *' : 'Reason *'}
                </label>
                <input
                  type="text"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder={lang === 'ko' ? '신고 사유를 입력하세요' : 'Enter report reason'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  maxLength={200}
                />
              </div>

              {/* 상세 설명 (선택사항) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {lang === 'ko' ? '상세 설명 (선택사항)' : 'Description (Optional)'}
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder={lang === 'ko' ? '추가 설명을 입력하세요' : 'Enter additional details'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {reportDescription.length} / 500
                </p>
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setReportType('spam');
                    setReportReason('');
                    setReportDescription('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all font-semibold"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleSubmitReport}
                  disabled={!reportReason.trim() || isSubmittingReport}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-semibold"
                >
                  {isSubmittingReport 
                    ? (lang === 'ko' ? '제출 중...' : 'Submitting...')
                    : (lang === 'ko' ? '신고하기' : 'Submit Report')
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

