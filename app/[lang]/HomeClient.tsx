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
  const currentLang = 'ko';

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
                `사용자${user.id.substring(0, 8)}`,
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
                `게스트${guestId.substring(0, 6)}`,
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
        throw new Error('유저를 찾거나 생성할 수 없습니다.');
      }

      const result = await triggerEvent(userId, guestId, authUserId, 'daily_participate', {});

      if (result && result.success) {
        setIsCheckedIn(true);
        setCheckInMessage(
          `출석 완료! +${result.gainedXP} XP, +${result.gainedPoints} P 획득!`
        );
      } else {
        throw new Error('출석 처리에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('출석 오류:', error);
      setCheckInMessage('출석 처리 중 오류가 발생했습니다.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const getLocalizedPath = (path: string) => {
    return `/${lang}${path === '/' ? '' : path}`;
  };

  const heroTitle = '오늘의 사건';
  const heroCta = '사건 수사 시작';

  const popularProblems = sampleProblems
    .slice()
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 3);

  const newProblems = sampleProblems.slice(0, 3);

  const heroTargetHref = todayProblem
    ? getLocalizedPath(`/problem/${todayProblem.id}`)
    : getLocalizedPath('/play');

  return (
    <main className="min-h-screen text-slate-50 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute top-40 right-[-4rem] h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 page-shell py-8 sm:py-10 lg:py-14">
        {/* Top intro */}
        <header className="mb-6 sm:mb-8">
          <p className="text-xs sm:text-sm uppercase tracking-[0.22em] text-teal-300/80">
            AI 사건 수사
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white">
            단서를 모아 사건의 진실을 밝혀내세요.
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-300">
            AI에게 자유롭게 질문하고, 핵심 단서를 발견하며 추리하세요. 오늘의 CASE가 기다리고 있습니다.
          </p>
        </header>

        {/* HERO: Today's Mystery */}
        <section className="mb-10 sm:mb-12">
          <div className="relative overflow-hidden rounded-3xl border border-teal-500/30 bg-slate-900/80">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_55%)]" />

            <div className="relative grid min-h-[260px] grid-cols-1 gap-8 p-6 sm:p-8 lg:p-10 lg:grid-cols-[2fr,1.2fr]">
              <div className="flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-slate-900/80 px-3 py-1 text-xs font-medium text-teal-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
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
                        오늘의 미스터리가 준비 중입니다.
                      </h2>
                      <p className="max-w-2xl text-sm sm:text-base text-slate-300/90">
                        그 사이 인기 퍼즐이나 새로운 퍼즐을 먼저 풀어보세요.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link href={heroTargetHref} className="btn-primary sm:w-auto w-full">
                    <i className="ri-play-fill text-lg" />
                    <span>{heroCta}</span>
                    <i className="ri-arrow-right-line text-base" />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-6 rounded-2xl border border-teal-500/15 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-4 sm:p-5">
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                    게임 로비
                  </p>
                  <p className="text-sm text-slate-300">
                    혼자 추리하거나, 친구와 방을 만들어 함께 비밀을 파헤쳐 보세요.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center text-xs sm:text-sm">
                  <div className="rounded-xl bg-slate-900/70 px-2 py-3">
                    <p className="text-[0.72rem] uppercase tracking-wide text-slate-400">퍼즐 수</p>
                    <p className="mt-1 text-lg font-semibold text-teal-300">100+</p>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 px-2 py-3">
                    <p className="text-[0.72rem] uppercase tracking-wide text-slate-400">게임 모드</p>
                    <p className="mt-1 text-lg font-semibold text-teal-300">3</p>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 px-2 py-3">
                    <p className="text-[0.72rem] uppercase tracking-wide text-slate-400">평균 소요</p>
                    <p className="mt-1 text-lg font-semibold text-teal-300">10m</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-10 flex flex-1 flex-col gap-10 lg:gap-12">
          {/* Popular */}
          <section>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <div>
                <h2 className="section-title">인기 미스터리</h2>
                <p className="section-lead">많이 플레이된 미스터리부터 도전해 보세요.</p>
              </div>
              <Link
                href={getLocalizedPath('/problems')}
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-teal-300 hover:text-teal-200"
              >
                <span>전체 보기</span>
                <i className="ri-arrow-right-line text-sm" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {isLoadingSamples ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="mb-3 h-5 w-3/4 rounded bg-slate-800" />
                    <div className="mb-1.5 h-3 w-full rounded bg-slate-800/80" />
                    <div className="h-3 w-5/6 rounded bg-slate-800/80" />
                  </div>
                ))
              ) : popularProblems.length > 0 ? (
                popularProblems.map((problem) => (
                  <Link
                    key={problem.id}
                    href={getLocalizedPath(`/problem/${problem.id}`)}
                    className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition-colors hover:border-teal-400/50 hover:bg-slate-900"
                  >
                    <h3 className="mb-2 line-clamp-2 text-sm sm:text-base font-semibold text-white group-hover:text-teal-200">
                      {problem.title}
                    </h3>
                    <p className="mb-3 line-clamp-2 text-xs sm:text-sm text-slate-400">
                      {problem.content}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
                  아직 인기 미스터리가 없습니다. 첫 번째 도전자가 되어 보세요.
                </div>
              )}
            </div>
          </section>

          {/* New */}
          <section>
            <div className="mb-4">
              <h2 className="section-title">새로 올라온 미스터리</h2>
              <p className="section-lead">방금 올라온 따끈한 미스터리들입니다.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {isLoadingSamples ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="mb-3 h-5 w-3/4 rounded bg-slate-800" />
                    <div className="h-3 w-full rounded bg-slate-800/80" />
                  </div>
                ))
              ) : newProblems.length > 0 ? (
                newProblems.map((problem) => (
                  <Link
                    key={problem.id}
                    href={getLocalizedPath(`/problem/${problem.id}`)}
                    className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition-colors hover:border-teal-400/50 hover:bg-slate-900"
                  >
                    <h3 className="mb-2 line-clamp-2 text-sm sm:text-base font-semibold text-white group-hover:text-teal-200">
                      {problem.title}
                    </h3>
                    <p className="mb-3 line-clamp-2 text-xs sm:text-sm text-slate-400">
                      {problem.content}
                    </p>
                    <div className="mt-auto flex items-center gap-3 text-[0.7rem] sm:text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <i className="ri-time-line text-teal-300" />
                        최근 업로드
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
                  아직 새로운 미스터리가 없습니다. 직접 하나 만들어 보세요.
                </div>
              )}
            </div>
          </section>

          {/* Game Modes */}
          <section>
            <div className="mb-4">
              <h2 className="section-title">게임 모드</h2>
              <p className="section-lead">나에게 맞는 방식으로 바다거북스프를 즐겨보세요.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Link
                href={getLocalizedPath('/rooms')}
                className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition-all hover:border-teal-400/50 hover:bg-slate-900"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
                  <i className="ri-group-line text-lg" />
                </div>
                <h3 className="mb-1 text-sm sm:text-base font-semibold text-white group-hover:text-teal-200">
                  {t.home.multiplayer}
                </h3>
                <p className="mb-3 text-xs sm:text-sm text-slate-400 line-clamp-3">
                  {t.home.multiplayerDesc}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-teal-300">
                  방 만들기
                  <i className="ri-arrow-right-up-line text-xs" />
                </span>
              </Link>

              <Link
                href={getLocalizedPath('/play')}
                className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition-all hover:border-teal-400/50 hover:bg-slate-900"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
                  <i className="ri-user-line text-lg" />
                </div>
                <h3 className="mb-1 text-sm sm:text-base font-semibold text-white group-hover:text-teal-200">
                  {t.home.offline}
                </h3>
                <p className="mb-3 text-xs sm:text-sm text-slate-400 line-clamp-3">
                  {t.home.offlineDesc}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-teal-300">
                  솔로 플레이
                  <i className="ri-arrow-right-up-line text-xs" />
                </span>
              </Link>

              <Link
                href={getLocalizedPath('/create-problem')}
                className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition-all hover:border-teal-400/50 hover:bg-slate-900"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
                  <i className="ri-add-circle-line text-lg" />
                </div>
                <h3 className="mb-1 text-sm sm:text-base font-semibold text-white group-hover:text-teal-200">
                  {t.problem.createProblem}
                </h3>
                <p className="mb-3 text-xs sm:text-sm text-slate-400 line-clamp-3">
                  자신만의 미스터리를 만들어 플레이어와 공유하세요.
                </p>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-teal-300">
                  문제 만들기
                  <i className="ri-arrow-right-up-line text-xs" />
                </span>
              </Link>
            </div>
          </section>

          {/* Categories */}
          <section>
            <h2 className="section-title mb-4">카테고리별 사건</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
              {[
                { href: `/${lang}/problems/legend`, label: '레전드 사건', desc: '가장 인기 있는 CASE' },
                { href: `/${lang}/problems/hard`, label: '고난도 수사', desc: '극악·고난도 추리' },
                { href: `/${lang}/problems/scary`, label: '공포·반전', desc: '소름 돋는 사건' },
                { href: `/${lang}/problems/easy`, label: '입문 사건', desc: '초보자용 CASE' },
                { href: `/${lang}/problems/latest`, label: '신규 사건', desc: '새로 올라온 CASE' },
              ].map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="group flex flex-col items-center p-3 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-teal-500/40 transition-all text-center"
                >
                  <span className="text-sm font-medium text-white group-hover:text-teal-300 transition-colors">
                    {cat.label}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">{cat.desc}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Ranking & check-in */}
          <section className="border-t border-slate-800 pt-6 lg:pt-8">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr),minmax(0,1.5fr)]">
              <Link
                href={getLocalizedPath('/ranking')}
                className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 transition-all hover:border-teal-400/50 hover:bg-slate-900"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
                  <i className="ri-trophy-line text-lg" />
                </div>
                <h3 className="mb-1 text-sm sm:text-base font-semibold text-white group-hover:text-teal-200">
                  {t.ranking.title}
                </h3>
                <p className="mb-3 text-xs sm:text-sm text-slate-400">
                  정답 수와 좋아요 순위를 확인하고, 나만의 기록을 세워보세요.
                </p>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-teal-300">
                  랭킹 보러가기
                  <i className="ri-arrow-right-up-line text-xs" />
                </span>
              </Link>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
                      <i className="ri-calendar-check-line text-sm" />
                    </span>
                    <h3 className="text-sm sm:text-base font-semibold text-white">
                      {t.home.checkIn}
                    </h3>
                  </div>
                  <p className="mb-3 text-xs sm:text-sm text-slate-400">{t.home.checkInDesc}</p>
                  {checkInMessage && (
                    <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                      {checkInMessage}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={isCheckedIn || isCheckingIn}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                      isCheckedIn
                        ? 'cursor-not-allowed bg-slate-800 text-slate-400'
                        : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
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
                      로그인하면 기록과 랭킹을 더 편하게 사용할 수 있어요.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link href={getLocalizedPath('/auth/login')} className="btn-primary flex-1">
                        로그인
                      </Link>
                      <Link href={getLocalizedPath('/guide')} className="btn-ghost">
                        플레이 방법
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

