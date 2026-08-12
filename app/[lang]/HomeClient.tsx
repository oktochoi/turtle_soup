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
import { filterPublicProblems } from '@/lib/problems/public';
import CaseCard from '@/components/case/CaseCard';
import AdSlot from '@/components/ads/AdSlot';

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
        .in('status', ['published', 'featured'])
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
          const filtered = filterPublicProblems(data as Problem[]).filter(
            (p: Problem & { lang?: string; language?: string }) =>
              (p.lang ?? p.language ?? 'ko') === currentLang
          );
          setSampleProblems(filtered.slice(0, 6));
        }
        setIsLoadingSamples(false);
        return;
      }

      if (error) throw error;

      if (data && data.length > 0) {
        setSampleProblems(filterPublicProblems(data as Problem[]).slice(0, 6));
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
        .in('status', ['published', 'featured'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!problems || problems.length === 0) {
        setIsLoadingProblem(false);
        return;
      }

      // ko → 한글 문제만, en → 영어 문제만
      const filteredProblems = filterPublicProblems(problems as Problem[]).filter(
        (problem) =>
          ((problem as Problem & { lang?: string; language?: string }).lang ??
            (problem as Problem & { language?: string }).language ??
            'ko') === currentLang
      );

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

  const popularProblems = sampleProblems
    .slice()
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 3);

  const newProblems = sampleProblems.slice(0, 3);

  const heroTargetHref = todayProblem
    ? getLocalizedPath(`/problem/${todayProblem.id}`)
    : getLocalizedPath('/problems');

  return (
    <main className="min-h-screen text-slate-50 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute top-40 right-[-4rem] h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 page-shell py-8 sm:py-10 lg:py-14">
        <header className="mb-8 sm:mb-10 text-center sm:text-left">
          <p className="text-xs sm:text-sm tracking-[0.22em] text-teal-300/80">AI 추리 게임</p>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white">
            오늘 어떤 미스터리를 풀어볼까요?
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-300 mx-auto sm:mx-0">
            AI에게 자유롭게 질문하며 사건의 진실을 추리하세요.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center justify-center sm:justify-start">
            <Link href={heroTargetHref} className="btn-primary">
              바로 사건 시작
            </Link>
            <Link href={getLocalizedPath('/problems')} className="btn-ghost">
              사건 둘러보기
            </Link>
          </div>
        </header>

        {/* Today's CASE */}
        <section className="mb-10 sm:mb-12">
          <h2 className="section-title mb-4">오늘의 CASE</h2>
          {isLoadingProblem ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 h-40 animate-pulse" />
          ) : todayProblem ? (
            <div className="max-w-xl">
              <CaseCard problem={todayProblem} lang={lang} ctaLabel="사건 시작" />
            </div>
          ) : (
            <p className="text-sm text-slate-400">오늘의 CASE가 준비 중입니다. 아래에서 다른 사건을 골라보세요.</p>
          )}
        </section>

        <AdSlot variant="home" className="mb-10" />

        <section className="mb-10">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="section-title">인기 CASE</h2>
            <Link href={getLocalizedPath('/problems')} className="text-xs sm:text-sm text-teal-300 hover:text-teal-200">
              전체 보기 →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoadingSamples
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/80 h-48 animate-pulse" />
                ))
              : popularProblems.map((p) => <CaseCard key={p.id} problem={p} lang={lang} />)}
            {!isLoadingSamples && popularProblems.length === 0 && (
              <p className="text-sm text-slate-400">아직 인기 CASE가 없습니다.</p>
            )}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="section-title mb-4">새로운 CASE</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoadingSamples
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/80 h-48 animate-pulse" />
                ))
              : newProblems.map((p) => <CaseCard key={p.id} problem={p} lang={lang} />)}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="section-title mb-4">난이도별 CASE</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
            {[
              { href: `/${lang}/problems/legend`, label: '레전드', desc: '인기 CASE' },
              { href: `/${lang}/problems/hard`, label: '고난도', desc: '어려운 수사' },
              { href: `/${lang}/problems/scary`, label: '공포·반전', desc: '소름 CASE' },
              { href: `/${lang}/problems/easy`, label: '입문', desc: '초보 수사' },
              { href: `/${lang}/problems/latest`, label: '최신', desc: '신규 CASE' },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="group flex flex-col items-center p-3 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-teal-500/40 transition-all text-center"
              >
                <span className="text-sm font-medium text-white group-hover:text-teal-300">{cat.label}</span>
                <span className="text-xs text-slate-500 mt-1">{cat.desc}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* SEO / secondary — below game experience */}
        <section className="border-t border-slate-800 pt-8 space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <Link href={getLocalizedPath('/create-problem')} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-teal-500/40 transition">
              <h3 className="font-semibold text-white">사건 만들기</h3>
              <p className="mt-1 text-sm text-slate-400">나만의 미스터리를 공개하세요.</p>
            </Link>
            <Link href={getLocalizedPath('/ranking')} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-teal-500/40 transition">
              <h3 className="font-semibold text-white">랭킹</h3>
              <p className="mt-1 text-sm text-slate-400">수사 기록을 확인하세요.</p>
            </Link>
            <Link href={getLocalizedPath('/guide')} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-teal-500/40 transition">
              <h3 className="font-semibold text-white">플레이 방법</h3>
              <p className="mt-1 text-sm text-slate-400">바다거북스프가 처음이라면</p>
            </Link>
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 max-w-md">
            <h3 className="text-sm font-semibold text-white mb-2">{t.home.checkIn}</h3>
            <p className="mb-3 text-xs text-slate-400">{t.home.checkInDesc}</p>
            {checkInMessage && (
              <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {checkInMessage}
              </div>
            )}
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={isCheckedIn || isCheckingIn}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
                isCheckedIn ? 'bg-slate-800 text-slate-400' : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
              }`}
            >
              {isCheckingIn ? t.home.checkInProcessing : isCheckedIn ? t.home.checkInComplete : t.home.checkInButton}
            </button>
          </div>
        </section>
      </div>
    </main>
  );

}

