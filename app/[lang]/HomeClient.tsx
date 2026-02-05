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

  // Google OAuth 콜백 처리
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && !isRedirecting) {
      setIsRedirecting(true);
      const isProduction =
        window.location.hostname.includes('turtle-soup-rust.vercel.app') ||
        window.location.hostname.includes('vercel.app');
      const baseUrl = isProduction ? 'https://turtle-soup-rust.vercel.app' : window.location.origin;
      window.location.replace(
        `${baseUrl}/${lang}/auth/callback?code=${encodeURIComponent(code)}`
      );
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

  /** ko → 한글 문제만, en → 영어 문제만 (메인 페이지 언어 필터) */
  const currentLang = lang === 'en' ? 'en' : 'ko';

  const loadSampleProblems = async () => {
    try {
      setIsLoadingSamples(true);

      let data: any[] | null = null;
      let error: any = null;

      const result = await supabase
        .from('problems')
        .select('*')
        .eq('lang', currentLang)
        .order('created_at', { ascending: false })
        .limit(6);

      data = result.data;
      error = result.error;

      if (
        error &&
        (error.code === '42703' ||
          error.message?.includes('column') ||
          error.message?.includes('lang'))
      ) {
        const allResult = await supabase
          .from('problems')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        data = allResult.data;
        error = allResult.error;
        if (data && data.length > 0) {
          const filtered = data.filter((p: any) => (p.lang ?? p.language ?? 'ko') === currentLang);
          setSampleProblems(filtered.slice(0, 6));
        }
        setIsLoadingSamples(false);
        return;
      }

      if (error) throw error;

      if (data && data.length > 0) {
        setSampleProblems(data.slice(0, 6));
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

      // ko → 한글 문제만, en → 영어 문제만
      const filteredProblems = problems.filter((problem: any) => (problem.lang ?? problem.language ?? 'ko') === currentLang);

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
              nickname:
                userData?.nickname ||
                user.user_metadata?.full_name ||
                (lang === 'ko'
                  ? `사용자${user.id.substring(0, 8)}`
                  : `User${user.id.substring(0, 8)}`),
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
              nickname:
                lang === 'ko'
                  ? `게스트${guestId.substring(0, 6)}`
                  : `Guest${guestId.substring(0, 6)}`,
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
        throw new Error(
          lang === 'ko'
            ? '유저를 찾거나 생성할 수 없습니다.'
            : 'Unable to find or create user.'
        );
      }

      const result = await triggerEvent(userId, guestId, authUserId, 'daily_participate', {});

      if (result && result.success) {
        setIsCheckedIn(true);
        setCheckInMessage(
          `${lang === 'ko' ? '출석 완료!' : 'Check-in complete!'} +${result.gainedXP} XP, +${
            result.gainedPoints
          } P ${lang === 'ko' ? '획득!' : 'earned!'}`
        );
      } else {
        throw new Error(
          lang === 'ko' ? '출석 처리에 실패했습니다.' : 'Check-in failed.'
        );
      }
    } catch (error: any) {
      console.error('출석 오류:', error);
      setCheckInMessage(
        lang === 'ko'
          ? '출석 처리 중 오류가 발생했습니다.'
          : 'An error occurred during check-in.'
      );
    } finally {
      setIsCheckingIn(false);
    }
  };

  const getLocalizedPath = (path: string) => {
    return `/${lang}${path === '/' ? '' : path}`;
  };

  const heroTitle = lang === 'ko' ? '오늘의 미스터리' : "Today's Mystery";
  const heroCta = lang === 'ko' ? '추리 시작하기' : 'Start Solving';

  const popularProblems = sampleProblems
    .slice()
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 3);

  const newProblems = sampleProblems.slice(0, 3);

  const heroTargetHref = todayProblem
    ? getLocalizedPath(`/problem/${todayProblem.id}`)
    : getLocalizedPath('/play');

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 relative overflow-hidden">
      {/* Ambient glow background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute top-40 right-[-6rem] h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-14">
        {/* Top tagline */}
        <header className="mb-6 sm:mb-8">
          <p className="text-xs sm:text-sm uppercase tracking-[0.28em] text-cyan-300/80">
            {lang === 'ko' ? 'Lateral Thinking Mystery Puzzles' : 'Immersive Mystery Puzzle Lobby'}
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white">
            {lang === 'ko' ? '질문으로 비밀을 풀어보세요.' : 'Unravel secrets with your questions.'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-300">
            {lang === 'ko'
              ? '오늘의 미스터리와 인기 퍼즐이 당신을 기다리고 있습니다. 바로 플레이를 시작해 보세요.'
              : "Today's mystery and the most intriguing puzzles are waiting for you. Dive in and start solving."}
          </p>
        </header>

        {/* HERO: Today's Mystery */}
        <section className="mb-10 sm:mb-12">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-500/40 bg-slate-900/80 shadow-[0_0_60px_rgba(34,211,238,0.30)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.25),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(8,47,73,0.9),_transparent_60%)]" />

            <div className="relative grid min-h-[260px] grid-cols-1 gap-8 p-6 sm:p-8 lg:p-10 lg:grid-cols-[2fr,1.2fr]">
              {/* Mystery question */}
              <div className="flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-slate-900/80 px-3 py-1 text-xs font-medium text-cyan-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                    {heroTitle}
                  </div>

                  {isLoadingProblem ? (
                    <div className="mt-2 space-y-3">
                      <div className="h-8 w-3/4 rounded-lg bg-slate-700/60" />
                      <div className="h-4 w-full rounded bg-slate-800/70" />
                      <div className="h-4 w-5/6 rounded bg-slate-800/70" />
                    </div>
                  ) : todayProblem ? (
                    <>
                      <h2 className="text-2xl sm:text-3xl lg:text-[2rem] font-semibold tracking-tight text-white">
                        {todayProblem.title}
                      </h2>
                      <p className="max-w-2xl text-sm sm:text-base text-slate-300/90 line-clamp-3">
                        {todayProblem.content}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl sm:text-3xl lg:text-[2rem] font-semibold tracking-tight text-white">
                        {lang === 'ko'
                          ? '오늘의 미스터리가 준비 중입니다.'
                          : "Today's mystery is being prepared."}
                      </h2>
                      <p className="max-w-2xl text-sm sm:text-base text-slate-300/90">
                        {lang === 'ko'
                          ? '그 사이 인기 퍼즐이나 새로운 퍼즐을 먼저 풀어보세요.'
                          : 'In the meantime, explore popular or new puzzles below.'}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={heroTargetHref}>
                    <button className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-6 py-3.5 text-sm sm:text-base font-semibold text-slate-950 shadow-[0_0_35px_rgba(34,211,238,0.9)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_55px_rgba(34,211,238,1.0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto">
                      <i className="ri-play-fill text-lg" />
                      <span>{heroCta}</span>
                      <i className="ri-arrow-right-line text-base transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </Link>

                  {!isLoadingProblem && todayProblem && (
                    <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-slate-300/80">
                      <span className="inline-flex items-center gap-1.5">
                        <i className="ri-eye-line text-cyan-300" />
                        {todayProblem.view_count || 0}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <i className="ri-heart-3-line text-cyan-300" />
                        {todayProblem.like_count || 0}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <i className="ri-chat-3-line text-cyan-300" />
                        {todayProblem.comment_count || 0}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right side: lobby info */}
              <div className="flex flex-col justify-between gap-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-4 sm:p-5">
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">
                    {lang === 'ko' ? '게임 로비' : 'Game Lobby'}
                  </p>
                  <p className="text-sm text-slate-300">
                    {lang === 'ko'
                      ? '혼자 추리하거나, 친구와 방을 만들어 함께 비밀을 파헤쳐 보세요.'
                      : 'Solve mysteries alone or create a room with friends to uncover the truth together.'}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center text-xs sm:text-sm">
                  <div className="rounded-xl bg-slate-900/70 px-2 py-3">
                    <p className="text-[0.72rem] uppercase tracking-wide text-slate-400">
                      {lang === 'ko' ? '퍼즐 수' : 'Puzzles'}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-cyan-300">100+</p>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 px-2 py-3">
                    <p className="text-[0.72rem] uppercase tracking-wide text-slate-400">
                      {lang === 'ko' ? '게임 모드' : 'Game Modes'}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-cyan-300">3</p>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 px-2 py-3">
                    <p className="text-[0.72rem] uppercase tracking-wide text-slate-400">
                      {lang === 'ko' ? '평균 소요' : 'Avg. Time'}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-cyan-300">10m</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content sections */}
        <section className="mb-10 flex flex-1 flex-col gap-10 lg:gap-12">
          {/* Popular Puzzles */}
          <section>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  {lang === 'ko' ? '인기 미스터리' : 'Popular Puzzles'}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  {lang === 'ko'
                    ? '많이 플레이된 미스터리부터 도전해 보세요.'
                    : 'Start with the most played mysteries.'}
                </p>
              </div>
              <Link
                href={getLocalizedPath('/problems')}
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-cyan-300 hover:text-cyan-200"
              >
                <span>{lang === 'ko' ? '전체 보기' : 'View all'}</span>
                <i className="ri-arrow-right-line text-sm" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {isLoadingSamples ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm"
                  >
                    <div className="mb-3 h-5 w-3/4 rounded bg-slate-800" />
                    <div className="mb-1.5 h-3 w-full rounded bg-slate-800/80" />
                    <div className="mb-1.5 h-3 w-5/6 rounded bg-slate-800/80" />
                    <div className="mt-3 h-3 w-1/3 rounded bg-slate-800/80" />
                  </div>
                ))
              ) : popularProblems.length > 0 ? (
                popularProblems.map((problem) => (
                  <Link
                    key={problem.id}
                    href={getLocalizedPath(`/problem/${problem.id}`)}
                    className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.6)] transition-colors hover:border-cyan-400/70 hover:bg-slate-900"
                  >
                    <h3 className="mb-2 line-clamp-2 text-sm sm:text-base font-semibold text-white group-hover:text-cyan-200">
                      {problem.title}
                    </h3>
                    <p className="mb-3 line-clamp-2 text-xs sm:text-sm text-slate-400">
                      {problem.content}
                    </p>
                    <div className="mt-auto flex items-center gap-3 text-[0.7rem] sm:text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <i className="ri-eye-line text-cyan-300" />
                        {problem.view_count || 0}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <i className="ri-heart-3-line text-cyan-300" />
                        {problem.like_count || 0}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
                  {lang === 'ko'
                    ? '아직 인기 미스터리가 없습니다. 첫 번째 도전자가 되어 보세요.'
                    : 'No popular puzzles yet. Be the first to set the record.'}
                </div>
              )}
            </div>
          </section>

          {/* New Puzzles */}
          <section>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  {lang === 'ko' ? '새로 올라온 미스터리' : 'New Puzzles'}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  {lang === 'ko'
                    ? '방금 올라온 따끈한 미스터리들입니다.'
                    : 'Fresh mysteries just uploaded.'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {isLoadingSamples ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm"
                  >
                    <div className="mb-3 h-5 w-3/4 rounded bg-slate-800" />
                    <div className="mb-1.5 h-3 w-full rounded bg-slate-800/80" />
                    <div className="mb-1.5 h-3 w-4/5 rounded bg-slate-800/80" />
                    <div className="mt-3 h-3 w-1/2 rounded bg-slate-800/80" />
                  </div>
                ))
              ) : newProblems.length > 0 ? (
                newProblems.map((problem) => (
                  <Link
                    key={problem.id}
                    href={getLocalizedPath(`/problem/${problem.id}`)}
                    className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.6)] transition-colors hover:border-cyan-400/70 hover:bg-slate-900"
                  >
                    <h3 className="mb-2 line-clamp-2 text-sm sm:text-base font-semibold text-white group-hover:text-cyan-200">
                      {problem.title}
                    </h3>
                    <p className="mb-3 line-clamp-2 text-xs sm:text-sm text-slate-400">
                      {problem.content}
                    </p>
                    <div className="mt-auto flex items-center gap-3 text-[0.7rem] sm:text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <i className="ri-time-line text-cyan-300" />
                        {lang === 'ko' ? '최근 업로드' : 'Recently added'}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
                  {lang === 'ko'
                    ? '아직 새로운 미스터리가 없습니다. 직접 하나 만들어 보세요.'
                    : 'No new puzzles yet. Create one yourself.'}
                </div>
              )}
            </div>
          </section>

          {/* Game Modes */}
          <section>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  {lang === 'ko' ? '게임 모드' : 'Game Modes'}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  {lang === 'ko'
                    ? '나에게 맞는 방식으로 바다거북스프를 즐겨보세요.'
                    : 'Choose how you want to enjoy the mysteries.'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* Multiplayer */}
              <Link
                href={getLocalizedPath('/rooms')}
                className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm transition-all hover:border-cyan-400/70 hover:bg-slate-900"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                  <i className="ri-group-line text-lg" />
                </div>
                <h3 className="mb-1 text-sm sm:text-base font-semibold text-white group-hover:text-cyan-200">
                  {t.home.multiplayer}
                </h3>
                <p className="mb-3 text-xs sm:text-sm text-slate-400 line-clamp-3">
                  {t.home.multiplayerDesc}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-cyan-300 group-hover:gap-1.5">
                  {lang === 'ko' ? '방 만들기' : 'Create a room'}
                  <i className="ri-arrow-right-up-line text-xs" />
                </span>
              </Link>

              {/* Solo */}
              <Link
                href={getLocalizedPath('/play')}
                className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm transition-all hover:border-cyan-400/70 hover:bg-slate-900"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                  <i className="ri-user-line text-lg" />
                </div>
                <h3 className="mb-1 text-sm sm:text-base font-semibold text-white group-hover:text-cyan-200">
                  {t.home.offline}
                </h3>
                <p className="mb-3 text-xs sm:text-sm text-slate-400 line-clamp-3">
                  {t.home.offlineDesc}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-cyan-300 group-hover:gap-1.5">
                  {lang === 'ko' ? '솔로 플레이' : 'Play solo'}
                  <i className="ri-arrow-right-up-line text-xs" />
                </span>
              </Link>

              {/* Create */}
              <Link
                href={getLocalizedPath('/create-problem')}
                className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm transition-all hover:border-cyan-400/70 hover:bg-slate-900"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                  <i className="ri-add-circle-line text-lg" />
                </div>
                <h3 className="mb-1 text-sm sm:text-base font-semibold text-white group-hover:text-cyan-200">
                  {t.problem.createProblem}
                </h3>
                <p className="mb-3 text-xs sm:text-sm text-slate-400 line-clamp-3">
                  {lang === 'ko'
                    ? '자신만의 미스터리를 만들어 전 세계 플레이어와 공유하세요.'
                    : 'Create your own mysteries and share them with players worldwide.'}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-cyan-300 group-hover:gap-1.5">
                  {lang === 'ko' ? '문제 만들기' : 'Create puzzle'}
                  <i className="ri-arrow-right-up-line text-xs" />
                </span>
              </Link>
            </div>
          </section>

          {/* Secondary actions: ranking & attendance lower on the page */}
          <section className="border-t border-slate-800 pt-6 lg:pt-8">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr),minmax(0,1.5fr)]">
              <Link
                href={getLocalizedPath('/ranking')}
                className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-sm transition-all hover:border-cyan-400/70 hover:bg-slate-900"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                  <i className="ri-trophy-line text-lg" />
                </div>
                <h3 className="mb-1 text-sm sm:text-base font-semibold text-white group-hover:text-cyan-200">
                  {t.ranking.title}
                </h3>
                <p className="mb-3 text-xs sm:text-sm text-slate-400">
                  {lang === 'ko'
                    ? '정답 수와 좋아요 순위를 확인하고, 나만의 기록을 세워보세요.'
                    : 'Check solve and like rankings, and set your own records.'}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-cyan-300 group-hover:gap-1.5">
                  {lang === 'ko' ? '랭킹 보러가기' : 'View ranking'}
                  <i className="ri-arrow-right-up-line text-xs" />
                </span>
              </Link>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
                      <i className="ri-calendar-check-line text-sm" />
                    </span>
                    <h3 className="text-sm sm:text-base font-semibold text-white">
                      {t.home.checkIn}
                    </h3>
                  </div>
                  <p className="mb-3 text-xs sm:text-sm text-slate-400">
                    {t.home.checkInDesc}
                  </p>
                  {checkInMessage && (
                    <div className="mb-3 rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                      {checkInMessage}
                    </div>
                  )}
                  <button
                    onClick={handleCheckIn}
                    disabled={isCheckedIn || isCheckingIn}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                      isCheckedIn
                        ? 'cursor-not-allowed bg-slate-800 text-slate-400'
                        : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                    }`}
                  >
                    {isCheckingIn ? (
                      <>
                        <i className="ri-loader-4-line animate-spin" />
                        {t.home.checkInProcessing}
                      </>
                    ) : isCheckedIn ? (
                      <>
                        <i className="ri-checkbox-circle-line" />
                        {t.home.checkInComplete}
                      </>
                    ) : (
                      <>
                        <i className="ri-calendar-check-line" />
                        {t.home.checkInButton}
                      </>
                    )}
                  </button>
                </div>

                {!user && (
                  <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <p className="mb-3 text-xs sm:text-sm font-medium text-slate-200">
                      {lang === 'ko'
                        ? '로그인하면 기록과 랭킹, 커뮤니티 기능을 모두 사용할 수 있어요.'
                        : 'Log in to keep your records, join rankings, and use all community features.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={getLocalizedPath('/auth/login')}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                      >
                        <i className="ri-login-box-line text-sm" />
                        <span>{lang === 'ko' ? '로그인' : 'Log in'}</span>
                      </Link>
                      <Link
                        href={getLocalizedPath('/tutorial')}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:border-cyan-400/70"
                      >
                        <i className="ri-book-open-line text-sm" />
                        <span>{lang === 'ko' ? '플레이 방법' : 'How to play'}</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

