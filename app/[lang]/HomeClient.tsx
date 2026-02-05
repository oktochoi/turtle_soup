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

export default function HomeClient() {
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';
  const t = useTranslations();
  const { user } = useAuth();
  const [todayProblem, setTodayProblem] = useState<Problem | null>(null);
  const [sampleProblems, setSampleProblems] = useState<Problem[]>([]);
  const [isLoadingProblem, setIsLoadingProblem] = useState(true);
  const [isLoadingSamples, setIsLoadingSamples] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Google OAuth 콜백 처리: code 파라미터가 있으면 콜백 라우트로 리다이렉트
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && !isRedirecting) {
      setIsRedirecting(true);
      const isProduction = window.location.hostname.includes('turtle-soup-rust.vercel.app') || window.location.hostname.includes('vercel.app');
      const baseUrl = isProduction ? 'https://turtle-soup-rust.vercel.app' : window.location.origin;
      window.location.replace(`${baseUrl}/${lang}/auth/callback?code=${encodeURIComponent(code)}`);
    }
  }, [lang, isRedirecting]);

  useEffect(() => {
    if (isRedirecting) return;
    loadTodayProblem();
    const t1 = setTimeout(() => loadSampleProblems(), 100);
    const t2 = setTimeout(() => checkTodayCheckIn(), 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [user, lang, isRedirecting]);

  const loadSampleProblems = async () => {
    try {
      setIsLoadingSamples(true);
      const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
      let data: any[] | null = null;
      let error: any = null;
      const result = await supabase
        .from('problems')
        .select('*')
        .eq('lang', currentLang)
        .order('created_at', { ascending: false })
        .limit(3);
      data = result.data;
      error = result.error;
      if (error && (error.code === '42703' || error.message?.includes('column') || error.message?.includes('lang'))) {
        const allResult = await supabase
          .from('problems')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        data = allResult.data;
        error = allResult.error;
      }
      if (error) throw error;
      if (data && data.length > 0) {
        const filtered = data.filter((problem: any) => {
          if (!problem.language) return currentLang === 'ko';
          return problem.language === currentLang;
        });
        setSampleProblems(filtered.slice(0, 3));
      }
    } catch (error) {
      console.error('샘플 문제 로드 오류:', error);
    } finally {
      setIsLoadingSamples(false);
    }
  };

  const loadTodayProblem = async () => {
    try {
      const { data: problems, error } = await supabase
        .from('problems')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!problems || problems.length === 0) {
        setIsLoadingProblem(false);
        return;
      }
      const filteredProblems = problems.filter((problem: any) => {
        if (!problem.language) return lang === 'ko';
        if (lang === 'en') return problem.language === 'en';
        return problem.language === 'ko';
      });
      if (filteredProblems.length === 0) {
        setIsLoadingProblem(false);
        return;
      }
      const today = new Date();
      const dateString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      let hash = 0;
      for (let i = 0; i < dateString.length; i++) {
        const char = dateString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const index = Math.abs(hash) % filteredProblems.length;
      setTodayProblem(filteredProblems[index]);
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
        const { data: gameUser } = await supabaseClient
          .from('game_users')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (gameUser) userId = gameUser.id;
      } else {
        const guestId = getOrCreateGuestId();
        const { data: gameUser } = await supabaseClient
          .from('game_users')
          .select('id')
          .eq('guest_id', guestId)
          .maybeSingle();
        if (gameUser) userId = gameUser.id;
      }
      if (!userId) {
        setIsCheckedIn(false);
        return;
      }
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
    if (!user) {
      setCheckInMessage(t.home.checkInLoginRequired);
      setTimeout(() => {
        window.location.href = `/${lang}/auth/login`;
      }, 1500);
      return;
    }
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
          const { data: userData } = await supabaseClient
            .from('users')
            .select('nickname')
            .eq('id', user.id)
            .maybeSingle();
          const { data: newGameUser } = await supabaseClient
            .from('game_users')
            .insert({
              auth_user_id: user.id,
              nickname: userData?.nickname || user.user_metadata?.full_name || (lang === 'ko' ? `사용자${user.id.substring(0, 8)}` : `User${user.id.substring(0, 8)}`),
            })
            .select()
            .single();
          if (newGameUser) {
            userId = newGameUser.id;
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
      const result = await triggerEvent(userId, guestId, authUserId, 'daily_participate', {});
      if (result && result.success) {
        setIsCheckedIn(true);
        setCheckInMessage(`${lang === 'ko' ? '출석 완료!' : 'Check-in complete!'} +${result.gainedXP} XP, +${result.gainedPoints} P ${lang === 'ko' ? '획득!' : 'earned!'}`);
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-md lg:max-w-5xl relative z-10">
        <header className="text-center mb-8 sm:mb-12 pt-4 sm:pt-6 lg:pt-8">
          <div className="inline-block mb-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-3 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
              {t.home.title}
            </h1>
            <div className="h-1 w-24 mx-auto bg-gradient-to-r from-transparent via-teal-400 to-transparent rounded-full"></div>
          </div>
          <p className="text-slate-300 text-sm sm:text-base lg:text-lg font-light tracking-wide">
            {t.home.subtitle}
          </p>
        </header>
        <div className="flex flex-col lg:flex-row gap-5 sm:gap-6">
          <div className="group relative bg-slate-800/60 rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 hover:border-teal-500/50 transition-colors duration-200 flex-1">
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-lg">
                  <i className="ri-group-line text-teal-400 text-xl sm:text-2xl"></i>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-teal-400">{t.home.multiplayer}</h2>
              </div>
              <p className="text-sm sm:text-base text-slate-300 mb-5 leading-relaxed">{t.home.multiplayerDesc}</p>
              <Link href={getLocalizedPath('/rooms')}>
                <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-4 sm:py-5 rounded-xl transition-colors duration-200 text-base sm:text-lg active:opacity-90">
                  <span className="flex items-center justify-center">
                    <i className="ri-group-line mr-2 text-lg"></i>
                    {t.nav.multiplayer}
                  </span>
                </button>
              </Link>
            </div>
          </div>

          <div className="group relative bg-slate-800/60 rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 hover:border-purple-500/50 transition-colors duration-200 flex-1">
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg">
                  <i className="ri-user-line text-purple-400 text-xl sm:text-2xl"></i>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-purple-400">{t.home.offline}</h2>
              </div>
              <p className="text-sm sm:text-base text-slate-300 mb-5 leading-relaxed">{t.home.offlineDesc}</p>
              <Link href={getLocalizedPath('/play')}>
                <button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 sm:py-5 rounded-xl transition-colors duration-200 text-base sm:text-lg active:opacity-90">
                  <span className="flex items-center justify-center">
                    <i className="ri-question-answer-line mr-2 text-lg"></i>
                    {lang === 'ko' ? '게임 시작하기' : 'Start Game'}
                  </span>
                </button>
              </Link>
            </div>
          </div>

          <div className="group relative bg-slate-800/60 rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 hover:border-orange-500/50 transition-colors duration-200 flex-1">
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-lg">
                  <i className="ri-add-circle-line text-orange-400 text-xl sm:text-2xl"></i>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-orange-400">{t.problem.createProblem}</h2>
              </div>
              <p className="text-sm sm:text-base text-slate-300 mb-5 leading-relaxed">{lang === 'ko' ? '나만의 문제를 만들어서 공유하세요' : 'Create and share your own problems'}</p>
              <Link href={getLocalizedPath('/create-problem')}>
                <button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-4 sm:py-5 rounded-xl transition-colors duration-200 text-base sm:text-lg active:opacity-90">
                  <span className="flex items-center justify-center">
                    <i className="ri-add-circle-line mr-2 text-lg"></i>
                    {t.problem.createProblem}
                  </span>
                </button>
              </Link>
            </div>
          </div>
        </div>

        <section className="mt-8 sm:mt-12 lg:mt-16 space-y-6">
          <div className="bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-red-500/10 rounded-2xl p-5 sm:p-6 lg:p-7 border border-yellow-500/30">
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
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white transition-colors duration-200 active:opacity-90'
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

          {isLoadingProblem ? (
            <div className="bg-slate-800/60 rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 animate-pulse">
              <div className="h-6 bg-slate-700/50 rounded w-32 mb-4"></div>
              <div className="h-4 bg-slate-700/50 rounded w-full mb-2"></div>
              <div className="h-4 bg-slate-700/50 rounded w-3/4"></div>
            </div>
          ) : todayProblem ? (
            <Link href={getLocalizedPath(`/problem/${todayProblem.id}`)}>
              <div className="group bg-slate-800/60 rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 hover:border-teal-500/50 transition-colors duration-200 cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-lg">
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
            <div className="bg-slate-800/60 rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50">
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

          <div className="bg-slate-800/60 rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50">
            <h2 className="font-bold mb-5 text-teal-400 flex items-center text-base sm:text-lg lg:text-xl">
              <div className="p-1.5 bg-teal-500/20 rounded-lg mr-3">
                <i className="ri-question-answer-line text-lg" aria-hidden="true"></i>
              </div>
              {lang === 'ko' ? '샘플 문제' : 'Sample Problems'}
            </h2>
            {isLoadingSamples ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-slate-900/50 rounded-lg p-4 animate-pulse">
                    <div className="h-4 bg-slate-700/50 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-700/50 rounded w-full mb-1"></div>
                    <div className="h-3 bg-slate-700/50 rounded w-5/6"></div>
                  </div>
                ))}
              </div>
            ) : sampleProblems.length > 0 ? (
              <div className="space-y-4">
                {sampleProblems.map((problem) => (
                  <Link
                    key={problem.id}
                    href={getLocalizedPath(`/problem/${problem.id}`)}
                    className="block bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900/70 transition-colors border border-slate-700/50 hover:border-teal-500/50"
                  >
                    <h3 className="font-semibold text-white mb-2 line-clamp-2">{problem.title}</h3>
                    <p className="text-slate-400 text-sm line-clamp-2 mb-2">{problem.content}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <i className="ri-eye-line"></i>
                        {problem.view_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-heart-line"></i>
                        {problem.like_count || 0}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">{lang === 'ko' ? '샘플 문제가 없습니다.' : 'No sample problems available.'}</p>
            )}
            <Link
              href={getLocalizedPath('/problems')}
              className="mt-4 inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors text-sm font-semibold"
            >
              <span>{lang === 'ko' ? '더 많은 문제 보기' : 'View More Problems'}</span>
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>

          {!user && (
            <div className="bg-gradient-to-br from-cyan-500/10 via-teal-500/10 to-cyan-500/10 rounded-2xl p-5 sm:p-6 lg:p-7 border border-cyan-500/30">
              <h2 className="font-bold mb-4 text-cyan-400 flex items-center text-base sm:text-lg lg:text-xl">
                <div className="p-1.5 bg-cyan-500/20 rounded-lg mr-3">
                  <i className="ri-login-box-line text-lg" aria-hidden="true"></i>
                </div>
                {lang === 'ko' ? '로그인하면 가능한 것' : 'What You Can Do When Logged In'}
              </h2>
              <ul className="space-y-3 text-sm sm:text-base text-slate-300 mb-6">
                <li className="flex items-start">
                  <i className="ri-checkbox-circle-fill text-cyan-400 mr-3 mt-0.5 flex-shrink-0"></i>
                  <span>{lang === 'ko' ? '멀티플레이어 방을 만들고 친구들과 함께 게임하기' : 'Create multiplayer rooms and play games with friends'}</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-checkbox-circle-fill text-cyan-400 mr-3 mt-0.5 flex-shrink-0"></i>
                  <span>{lang === 'ko' ? '나만의 추리 문제를 만들어서 공유하기' : 'Create and share your own deduction problems'}</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-checkbox-circle-fill text-cyan-400 mr-3 mt-0.5 flex-shrink-0"></i>
                  <span>{lang === 'ko' ? '문제에 댓글을 달고 다른 플레이어들과 소통하기' : 'Leave comments on problems and communicate with other players'}</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-checkbox-circle-fill text-cyan-400 mr-3 mt-0.5 flex-shrink-0"></i>
                  <span>{lang === 'ko' ? '랭킹 시스템에 참여하고 자신의 실력 확인하기' : 'Participate in the ranking system and check your skills'}</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-checkbox-circle-fill text-cyan-400 mr-3 mt-0.5 flex-shrink-0"></i>
                  <span>{lang === 'ko' ? '출석체크로 경험치와 포인트 획득하기' : 'Earn experience points and points through check-in'}</span>
                </li>
              </ul>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={getLocalizedPath('/auth/login')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-colors duration-200 active:opacity-90"
                >
                  <i className="ri-login-box-line"></i>
                  <span>{lang === 'ko' ? '로그인하기' : 'Log In'}</span>
                </Link>
                <Link
                  href={getLocalizedPath('/play')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all border border-slate-600"
                >
                  <i className="ri-play-line"></i>
                  <span>{lang === 'ko' ? '게임 시작하기' : 'Start Game'}</span>
                </Link>
              </div>
            </div>
          )}

          <Link href={getLocalizedPath('/ranking')}>
            <div className="bg-slate-800/60 rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 hover:border-purple-500/50 transition-colors duration-200 cursor-pointer">
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

          <div className="bg-slate-800/60 rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50">
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
