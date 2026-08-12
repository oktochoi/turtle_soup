'use client';

import { use, useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Problem } from '@/lib/types';
import { useTranslations } from '@/hooks/useTranslations';
import { ProblemCardSkeleton } from '@/components/Skeleton';
import { ProblemsEmptyState } from '@/components/EmptyState';
import { handleError } from '@/lib/error-handler';
import { filterPublicProblems } from '@/lib/problems/public';
import CaseCard from '@/components/case/CaseCard';
import AdSlot from '@/components/ads/AdSlot';

type SortOption = 'latest' | 'popular' | 'difficulty';

export default function ProblemsPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const t = useTranslations();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [filteredProblems, setFilteredProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'featured'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('latest');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredProblems.length / itemsPerPage);
  const paginatedProblems = filteredProblems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    loadProblems();
  }, [lang]);

  useEffect(() => {
    filterAndSortProblems();
    setCurrentPage(1);
  }, [problems, difficultyFilter, featuredFilter, searchQuery, sortOption]);

  const loadProblems = async () => {
    try {
      let data: Problem[] | null = null;
      let error: { code?: string; message?: string } | null = null;

      const result = await supabase
        .from('problems')
        .select('*')
        .eq('lang', lang)
        .in('status', ['published', 'featured'])
        .order('created_at', { ascending: false });

      data = result.data as Problem[] | null;
      error = result.error;

      if (
        error &&
        (error.code === '42703' ||
          error.message?.includes('column') ||
          error.message?.includes('lang') ||
          error.message?.includes('does not exist'))
      ) {
        const allResult = await supabase
          .from('problems')
          .select('*')
          .order('created_at', { ascending: false });

        if (allResult.error) throw allResult.error;

        data = ((allResult.data || []) as Problem[]).filter(
          (p) => !(p as Problem & { lang?: string }).lang || (p as Problem & { lang?: string }).lang === lang
        );
        data = filterPublicProblems(data);
        error = null;
      }

      if (error) throw error;
      setProblems(filterPublicProblems((data || []) as Problem[]));
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name !== 'AbortError' && e?.message?.includes('aborted') === false) {
        handleError(err, '사건 로드', true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortProblems = () => {
    let filtered = [...problems];

    if (featuredFilter === 'featured') {
      filtered = filtered.filter((p) => ((p as Problem & { status?: string }).status || 'published') === 'featured');
    }

    if (difficultyFilter !== 'all') {
      filtered = filtered.filter((p) => (p.difficulty || 'medium') === difficultyFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.content?.toLowerCase().includes(query) ||
          (Array.isArray(p.tags) && p.tags.some((tag) => tag.toLowerCase().includes(query)))
      );
    }

    switch (sortOption) {
      case 'latest':
        filtered.sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        break;
      case 'popular':
        filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        break;
      case 'difficulty': {
        const rank = (d?: string) => (d === 'easy' ? 0 : d === 'hard' ? 2 : 1);
        filtered.sort((a, b) => rank(a.difficulty) - rank(b.difficulty));
        break;
      }
    }

    setFilteredProblems(filtered);
  };

  const filterBtn = (active: boolean) =>
    `px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
      active ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    }`;

  return (
    <div className="min-h-screen text-slate-100">
      <div className="page-shell py-6 sm:py-10">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-white">사건 둘러보기</h1>
              <p className="mt-2 text-sm text-slate-400 max-w-2xl">
                레전드·고난도·공포·최신 CASE를 골라 수사하세요.
              </p>
            </div>
            <Link href={`/${lang}/create-problem`} className="btn-primary">
              사건 만들기
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
            {[
              { href: `/${lang}/problems/legend`, label: '레전드' },
              { href: `/${lang}/problems/hard`, label: '어려운' },
              { href: `/${lang}/problems/scary`, label: '공포·반전' },
              { href: `/${lang}/problems/easy`, label: '쉬운' },
              { href: `/${lang}/problems/latest`, label: '최신' },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 px-3 text-center text-sm text-slate-100 transition hover:border-teal-500/40"
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4 mb-6 space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-400">
              {t.problem.search}:
            </label>
            <input
              type="text"
              placeholder="사건 제목·내용 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field w-full"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-400">채택</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setFeaturedFilter('all')} className={filterBtn(featuredFilter === 'all')}>
                전체
              </button>
              <button
                type="button"
                onClick={() => setFeaturedFilter('featured')}
                className={filterBtn(featuredFilter === 'featured')}
              >
                관리자 채택
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-400">난이도</label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficultyFilter(d)}
                  className={filterBtn(difficultyFilter === d)}
                >
                  {d === 'all' ? '전체' : d === 'easy' ? '쉬움' : d === 'medium' ? '보통' : '어려움'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-400">정렬</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSortOption('latest')} className={filterBtn(sortOption === 'latest')}>
                최신
              </button>
              <button type="button" onClick={() => setSortOption('popular')} className={filterBtn(sortOption === 'popular')}>
                인기
              </button>
              <button
                type="button"
                onClick={() => setSortOption('difficulty')}
                className={filterBtn(sortOption === 'difficulty')}
              >
                난이도
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            {[...Array(6)].map((_, i) => (
              <ProblemCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProblems.length === 0 ? (
          <ProblemsEmptyState lang={lang} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              {paginatedProblems.map((problem, idx) => (
                <Fragment key={problem.id}>
                  <CaseCard problem={problem} lang={lang} />
                  {idx === 2 && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <AdSlot variant="infeed" className="my-1" />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 sm:mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold"
                >
                  이전
                </button>
                <span className="text-sm text-slate-400 px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold"
                >
                  다음
                </button>
              </div>
            )}

            <p className="mt-4 text-center text-xs sm:text-sm text-slate-500">
              총 {filteredProblems.length}건의 사건
            </p>
          </>
        )}

        <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 text-slate-300 text-sm leading-relaxed space-y-3">
          <p>
            바다거북스프 CASE를 찾고 계신가요? 레전드부터 어려운 사건, 공포·반전까지 다양한 미스터리를
            AI 예/아니요 수사로 혼자 풀어볼 수 있습니다.
          </p>
          <p>
            장소·인물·시간·행동을 넓은 질문으로 시작한 뒤, 단서가 모이면 구체적으로 좁혀가세요. 가설로
            방향을 확인하고, 확신이 생기면 사건 해결로 마무리하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
