'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { triggerEvent, getOrCreateGuestId } from '@/lib/progress-client';
import { useTranslations } from '@/hooks/useTranslations';
import type { Problem } from '@/lib/types';

export default function Home() {
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';
  const t = useTranslations();
  const { user } = useAuth();
  const [todayProblem, setTodayProblem] = useState<Problem | null>(null);
  const [isLoadingProblem, setIsLoadingProblem] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);

  useEffect(() => {
    loadTodayProblem();
    checkTodayCheckIn();
  }, [user]);

  const loadTodayProblem = async () => {
    try {
      // 모든 문제 가져오기
      const { data: problems, error } = await supabase
        .from('problems')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!problems || problems.length === 0) {
        setIsLoadingProblem(false);
        return;
      }

      // 오늘 날짜를 기반으로 해시 생성하여 일관된 문제 선택
      const today = new Date();
      const dateString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      
      // 간단한 해시 함수
      let hash = 0;
      for (let i = 0; i < dateString.length; i++) {
        const char = dateString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32bit 정수로 변환
      }
      
      // 양수로 변환하고 문제 인덱스 선택
      const index = Math.abs(hash) % problems.length;
      setTodayProblem(problems[index]);
    } catch (error) {
      console.error('오늘의 문제 로드 오류:', error);
    } finally {
      setIsLoadingProblem(false);
    }
  };

  const checkTodayCheckIn = async () => {
    try {
      const supabaseClient = createClient();
      let userId: string | null = null;

      if (user) {
        // 로그인한 유저: game_users에서 찾기
        const { data: gameUser } = await supabaseClient
          .from('game_users')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (gameUser) {
          userId = gameUser.id;
        }
      } else {
        // 게스트: guest_id로 찾기
        const guestId = getOrCreateGuestId();
        const { data: gameUser } = await supabaseClient
          .from('game_users')
          .select('id')
          .eq('guest_id', guestId)
          .maybeSingle();

        if (gameUser) {
          userId = gameUser.id;
        }
      }

      if (!userId) {
        setIsCheckedIn(false);
        return;
      }

      // 오늘 출석했는지 확인
      const { data: progress } = await supabaseClient
        .from('user_progress')
        .select('last_participation_date')
        .eq('user_id', userId)
        .single();

      if (progress) {
        const today = new Date().toISOString().split('T')[0];
        setIsCheckedIn(progress.last_participation_date === today);
      }
    } catch (error) {
      console.error('출석 확인 오류:', error);
    }
  };

  const handleCheckIn = async () => {
    if (isCheckedIn || isCheckingIn) return;

    setIsCheckingIn(true);
    setCheckInMessage(null);

    try {
      const supabaseClient = createClient();
      let userId: string | null = null;
      let authUserId: string | null = null;
      let guestId: string | null = null;

      if (user) {
        authUserId = user.id;
        const { data: gameUser } = await supabaseClient
          .from('game_users')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (gameUser) {
          userId = gameUser.id;
        } else {
          // game_users에 없으면 생성
          const { data: newGameUser } = await supabaseClient
            .from('game_users')
            .insert({
              auth_user_id: user.id,
              nickname: user.user_metadata?.full_name || user.email?.split('@')[0] || (lang === 'ko' ? `사용자${user.id.substring(0, 8)}` : `User${user.id.substring(0, 8)}`),
            })
            .select()
            .single();

          if (newGameUser) {
            userId = newGameUser.id;
            // 초기 progress 생성
            await supabaseClient
              .from('user_progress')
              .insert({
                user_id: newGameUser.id,
                level: 1,
                xp: 0,
                points: 0,
              });
          }
        }
      } else {
        guestId = getOrCreateGuestId();
        const { data: gameUser } = await supabaseClient
          .from('game_users')
          .select('id')
          .eq('guest_id', guestId)
          .maybeSingle();

        if (gameUser) {
          userId = gameUser.id;
        } else {
          // game_users에 없으면 생성
          const { data: newGameUser } = await supabaseClient
            .from('game_users')
            .insert({
              guest_id: guestId,
              nickname: lang === 'ko' ? `게스트${guestId.substring(0, 6)}` : `Guest${guestId.substring(0, 6)}`,
            })
            .select()
            .single();

          if (newGameUser) {
            userId = newGameUser.id;
            // 초기 progress 생성
            await supabaseClient
              .from('user_progress')
              .insert({
                user_id: newGameUser.id,
                level: 1,
                xp: 0,
                points: 0,
              });
          }
        }
      }

      if (!userId) {
        throw new Error(lang === 'ko' ? '유저를 찾거나 생성할 수 없습니다.' : 'Unable to find or create user.');
      }

      // 출석 이벤트 트리거
      const result = await triggerEvent(userId, guestId, authUserId, 'daily_participate', {});

      if (result && result.success) {
        setIsCheckedIn(true);
        setCheckInMessage(`${lang === 'ko' ? '출석 완료!' : 'Check-in complete!'} +${result.gainedXP} XP, +${result.gainedPoints} P ${lang === 'ko' ? '획득!' : 'earned!'}`);
        
        // 레벨업/업적/칭호 알림 (간단한 alert)
        if (result.leveledUp) {
          setTimeout(() => {
            alert(lang === 'ko' ? `🎉 레벨업! 레벨 ${result.newLevel} 달성!` : `🎉 Level Up! Reached Level ${result.newLevel}!`);
          }, 500);
        }
        if (result.unlockedAchievements.length > 0) {
          setTimeout(() => {
            alert(lang === 'ko' ? `🏆 업적 달성: ${result.unlockedAchievements.map(a => a.name).join(', ')}` : `🏆 Achievement Unlocked: ${result.unlockedAchievements.map(a => a.name).join(', ')}`);
          }, 1000);
        }
        if (result.unlockedTitles.length > 0) {
          setTimeout(() => {
            alert(lang === 'ko' ? `👑 칭호 획득: ${result.unlockedTitles.map(t => t.name).join(', ')}` : `👑 Title Unlocked: ${result.unlockedTitles.map(t => t.name).join(', ')}`);
          }, 1500);
        }
      } else {
        throw new Error(lang === 'ko' ? '출석 처리에 실패했습니다.' : 'Check-in failed.');
      }
    } catch (error: any) {
      console.error('출석 오류:', error);
      setCheckInMessage(lang === 'ko' ? '출석 처리 중 오류가 발생했습니다.' : 'An error occurred during check-in.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const getLocalizedPath = (path: string) => {
    return `/${lang}${path === '/' ? '' : path}`;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
      {/* 배경 장식 요소 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-md lg:max-w-5xl relative z-10">
        <header className="text-center mb-8 sm:mb-12 pt-4 sm:pt-6 lg:pt-8 animate-fade-in">
          <div className="inline-block mb-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-3 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
              {t.home.title}
            </h1>
            <div className="h-1 w-24 mx-auto bg-gradient-to-r from-transparent via-teal-400 to-transparent rounded-full"></div>
          </div>
          <p className="text-slate-300 text-sm sm:text-base lg:text-lg font-light tracking-wide">
            {t.home.subtitle}
          </p>
        </header>

        <div className="flex flex-col lg:flex-row gap-5 sm:gap-6 animate-fade-in-up">
          {/* 멀티플레이어 섹션 */}
          <div className="group relative bg-slate-800/40 backdrop-blur-xl rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 hover:border-teal-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-teal-500/20 hover:-translate-y-1 flex-1">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                  <i className="ri-group-line text-teal-400 text-xl sm:text-2xl"></i>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-teal-400">{t.home.multiplayer}</h2>
              </div>
              <p className="text-sm sm:text-base text-slate-300 mb-5 leading-relaxed">{t.home.multiplayerDesc}</p>
              
              <Link href={getLocalizedPath('/rooms')}>
                <button className="w-full group/btn relative overflow-hidden bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-4 sm:py-5 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-teal-500/50 text-base sm:text-lg transform hover:scale-[1.02]">
                  <span className="relative z-10 flex items-center justify-center">
                    <i className="ri-group-line mr-2 text-lg"></i>
                    {t.nav.multiplayer}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-teal-500 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                </button>
              </Link>
            </div>
          </div>

          {/* 오프라인 섹션 */}
          <div className="group relative bg-slate-800/40 backdrop-blur-xl rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1 flex-1">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                  <i className="ri-user-line text-purple-400 text-xl sm:text-2xl"></i>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-purple-400">{t.home.offline}</h2>
              </div>
              <p className="text-sm sm:text-base text-slate-300 mb-5 leading-relaxed">{t.home.offlineDesc}</p>
              <Link href={getLocalizedPath('/problems')}>
                <button className="w-full group/btn relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 sm:py-5 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-purple-500/50 text-base sm:text-lg transform hover:scale-[1.02]">
                  <span className="relative z-10 flex items-center justify-center">
                    <i className="ri-question-answer-line mr-2 text-lg"></i>
                    {lang === 'ko' ? '게임 시작하기' : 'Start Game'}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                </button>
              </Link>
            </div>
          </div>
        </div>

        <section className="mt-8 sm:mt-12 lg:mt-16 space-y-6">
          {/* 출석체크 */}
          <div className="bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-red-500/10 backdrop-blur-xl rounded-2xl p-5 sm:p-6 lg:p-7 border border-yellow-500/30 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg">
                  <i className="ri-calendar-check-line text-yellow-400 text-xl sm:text-2xl"></i>
                </div>
                <h2 className="font-bold text-yellow-400 text-base sm:text-lg lg:text-xl">
                  {t.home.checkIn}
                </h2>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-300 mb-4">
              {t.home.checkInDesc}
            </p>
            {checkInMessage && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
                {checkInMessage}
              </div>
            )}
            <button
              onClick={handleCheckIn}
              disabled={isCheckedIn || isCheckingIn}
              className={`w-full py-3 sm:py-4 rounded-xl font-semibold transition-all duration-300 ${
                isCheckedIn
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl hover:shadow-yellow-500/50 transform hover:scale-[1.02]'
              }`}
            >
              {isCheckingIn ? (
                <span className="flex items-center justify-center">
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  {t.home.checkInProcessing}
                </span>
              ) : isCheckedIn ? (
                <span className="flex items-center justify-center">
                  <i className="ri-checkbox-circle-line mr-2"></i>
                  {t.home.checkInComplete}
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <i className="ri-calendar-check-line mr-2"></i>
                  {t.home.checkInButton}
                </span>
              )}
            </button>
          </div>

          {/* 오늘의 문제 */}
          {isLoadingProblem ? (
            <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 animate-pulse">
              <div className="h-6 bg-slate-700/50 rounded w-32 mb-4"></div>
              <div className="h-4 bg-slate-700/50 rounded w-full mb-2"></div>
              <div className="h-4 bg-slate-700/50 rounded w-3/4"></div>
            </div>
          ) : todayProblem ? (
            <Link href={getLocalizedPath(`/problem/${todayProblem.id}`)}>
              <div className="group bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-slate-800/60 backdrop-blur-xl rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 hover:border-teal-500/50 transition-all cursor-pointer animate-fade-in-up hover:shadow-2xl hover:shadow-teal-500/20 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                      <i className="ri-calendar-check-line text-teal-400 text-xl sm:text-2xl"></i>
                    </div>
                    <h2 className="font-bold text-teal-400 text-base sm:text-lg lg:text-xl">
                      {t.home.todayProblem}
                    </h2>
                  </div>
                  <i className="ri-arrow-right-line text-2xl text-teal-400 group-hover:translate-x-1 transition-transform"></i>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-teal-300 transition-colors">
                  {todayProblem.title}
                </h3>
                <p className="text-sm sm:text-base text-slate-300 mb-4 line-clamp-3 leading-relaxed">
                  {todayProblem.content}
                </p>
                <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <i className="ri-eye-line"></i>
                    {todayProblem.view_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-heart-line"></i>
                    {todayProblem.like_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-chat-3-line"></i>
                    {todayProblem.comment_count || 0}
                  </span>
                  {todayProblem.author && (
                    <span className="flex items-center gap-1">
                      <i className="ri-user-line"></i>
                      {todayProblem.author}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ) : (
            <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-lg">
                  <i className="ri-calendar-check-line text-teal-400 text-xl sm:text-2xl"></i>
                </div>
                <h2 className="font-bold text-teal-400 text-base sm:text-lg lg:text-xl">
                  {t.home.todayProblem}
                </h2>
              </div>
              <div className="text-center py-8">
                <i className="ri-time-line text-4xl text-slate-500 mb-3"></i>
                <p className="text-slate-400 text-sm sm:text-base">{t.home.preparing}</p>
              </div>
            </div>
          )}

          <Link href={getLocalizedPath('/ranking')}>
            <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 hover:border-purple-500/50 transition-all cursor-pointer animate-fade-in-up delay-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold mb-2 text-purple-400 flex items-center text-base sm:text-lg lg:text-xl">
                    <div className="p-1.5 bg-purple-500/20 rounded-lg mr-3">
                      <i className="ri-trophy-line text-lg" aria-hidden="true"></i>
                    </div>
                    {t.ranking.title}
                  </h2>
                  <p className="text-slate-300 text-sm sm:text-base">{lang === 'ko' ? '정답 랭킹과 문제 좋아요 랭킹을 확인하세요' : 'Check problem solve rankings and received hearts'}</p>
                </div>
                <i className="ri-arrow-right-line text-2xl text-purple-400"></i>
              </div>
            </div>
          </Link>

          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 animate-fade-in-up delay-200">
            <h2 className="font-bold mb-5 text-teal-400 flex items-center text-base sm:text-lg lg:text-xl">
              <div className="p-1.5 bg-teal-500/20 rounded-lg mr-3">
                <i className="ri-information-line text-lg" aria-hidden="true"></i>
              </div>
              {t.home.gameRules}
            </h2>
            <ul className="space-y-3 text-sm sm:text-base lg:text-base text-slate-300">
              <li className="flex items-start group/item">
                <div className="p-1 bg-teal-500/20 rounded-full mr-3 mt-0.5 flex-shrink-0 group-hover/item:bg-teal-500/30 transition-colors">
                  <i className="ri-checkbox-circle-fill text-teal-400 text-sm" aria-hidden="true"></i>
                </div>
                <span className="leading-relaxed">{t.home.rule1}</span>
              </li>
              <li className="flex items-start group/item">
                <div className="p-1 bg-teal-500/20 rounded-full mr-3 mt-0.5 flex-shrink-0 group-hover/item:bg-teal-500/30 transition-colors">
                  <i className="ri-checkbox-circle-fill text-teal-400 text-sm" aria-hidden="true"></i>
                </div>
                <span className="leading-relaxed">{t.home.rule2}</span>
              </li>
              <li className="flex items-start group/item">
                <div className="p-1 bg-teal-500/20 rounded-full mr-3 mt-0.5 flex-shrink-0 group-hover/item:bg-teal-500/30 transition-colors">
                  <i className="ri-checkbox-circle-fill text-teal-400 text-sm" aria-hidden="true"></i>
                </div>
                <span className="leading-relaxed">{t.home.rule3}</span>
              </li>
              <li className="flex items-start group/item">
                <div className="p-1 bg-teal-500/20 rounded-full mr-3 mt-0.5 flex-shrink-0 group-hover/item:bg-teal-500/30 transition-colors">
                  <i className="ri-checkbox-circle-fill text-teal-400 text-sm" aria-hidden="true"></i>
                </div>
                <span className="leading-relaxed">{t.home.rule4}</span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

