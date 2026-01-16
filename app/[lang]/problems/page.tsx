'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Problem } from '@/lib/types';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import { ProblemCardSkeleton } from '@/components/Skeleton';
import { ProblemsEmptyState } from '@/components/EmptyState';
import { handleError } from '@/lib/error-handler';
import AdNativeBanner from '@/components/ads/AdNativeBanner';
import AdBanner300x250 from '@/components/ads/AdBanner300x250';

type SortOption = 'latest' | 'popular' | 'difficulty';

export default function ProblemsPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [filteredProblems, setFilteredProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 필터 상태
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('latest');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  // 페이지네이션
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
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 리셋
  }, [problems, difficultyFilter, searchQuery, sortOption, selectedTags]);

  const loadProblems = async () => {
    try {
      const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
      
      let data: any[] | null = null;
      let error: any = null;
      
      // lang 컬럼으로 필터링 시도
      const result = await supabase
        .from('problems')
        .select('*')
        .eq('lang', currentLang)
        .order('created_at', { ascending: false });
      
      data = result.data;
      error = result.error;
      
      // lang 컬럼이 없어서 에러가 발생한 경우 (42703: undefined_column)
      if (error && (error.code === '42703' || error.message?.includes('column') || error.message?.includes('lang') || error.message?.includes('does not exist'))) {
        console.warn('lang 컬럼이 없습니다. 모든 문제를 가져옵니다. 마이그레이션을 실행해주세요.');
        // lang 컬럼 없이 모든 문제 가져오기
        const allResult = await supabase
          .from('problems')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (allResult.error) {
          throw allResult.error;
        }
        
        // 클라이언트 사이드에서 필터링 (lang 필드가 있는 경우만)
        data = (allResult.data || []).filter((p: any) => !p.lang || p.lang === currentLang);
        error = null; // 에러를 null로 설정하여 정상 처리로 간주
      }
      
      // 다른 에러가 있으면 throw
      if (error) {
        throw error;
      }
      
      // 각 문제의 평균 별점 계산
      const problemsWithRatings = await Promise.all(
        (data || []).map(async (problem) => {
          const { data: ratings } = await supabase
            .from('problem_difficulty_ratings')
            .select('rating')
            .eq('problem_id', problem.id);

          let averageRating = 0;
          let ratingCount = 0;
          
          if (ratings && ratings.length > 0) {
            const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
            averageRating = Number((sum / ratings.length).toFixed(2));
            ratingCount = ratings.length;
          }

          return {
            ...problem,
            average_rating: averageRating,
            rating_count: ratingCount,
          };
        })
      );

      setProblems(problemsWithRatings);
      
      // 사용 가능한 태그 추출
      const allTags = new Set<string>();
      problemsWithRatings.forEach(p => {
        if (p.tags && Array.isArray(p.tags)) {
          p.tags.forEach((tag: string) => allTags.add(tag));
        }
      });
      setAvailableTags(Array.from(allTags).sort());
    } catch (error: any) {
      // AbortError는 무해한 에러이므로 무시 (컴포넌트 언마운트 시 발생 가능)
      if (error?.name !== 'AbortError' && error?.message?.includes('aborted') === false) {
        handleError(error, '문제 로드', true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortProblems = () => {
    let filtered = [...problems];

    // 난이도 필터 (별점 기반으로 변경)
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(p => {
        const rating = (p as any).average_rating || 0;
        if (difficultyFilter === 'easy') return rating < 3;
        if (difficultyFilter === 'medium') return rating >= 3 && rating < 4;
        if (difficultyFilter === 'hard') return rating >= 4;
        return true;
      });
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query) ||
        (p.tags && Array.isArray(p.tags) && p.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    // 태그 필터
    if (selectedTags.length > 0) {
      filtered = filtered.filter(p => 
        p.tags && Array.isArray(p.tags) && selectedTags.every(tag => p.tags!.includes(tag))
      );
    }

    // 정렬
    switch (sortOption) {
      case 'latest':
        filtered.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case 'popular':
        // 인기순은 하트(like_count) 개수로 정렬
        filtered.sort((a, b) => 
          (b.like_count || 0) - (a.like_count || 0)
        );
        break;
      case 'difficulty':
        filtered.sort((a, b) => {
          const ratingA = (a as any).average_rating || 0;
          const ratingB = (b as any).average_rating || 0;
          return ratingA - ratingB;
        });
        break;
    }

    setFilteredProblems(filtered);
  };

  const getDifficultyFromRating = (rating: number): { text: string; color: string; emoji: string } => {
    if (rating === 0) {
      return { text: t.problem.noRatingText, color: 'bg-slate-500', emoji: '⚪' };
    } else if (rating < 2) {
      return { text: t.problem.veryEasy, color: 'bg-green-500', emoji: '🟢' };
    } else if (rating < 3) {
      return { text: t.problem.easy, color: 'bg-green-400', emoji: '🟢' };
    } else if (rating < 4) {
      return { text: t.problem.normal, color: 'bg-yellow-500', emoji: '🟡' };
    } else if (rating < 4.5) {
      return { text: t.problem.hard, color: 'bg-orange-500', emoji: '🟠' };
    } else {
      return { text: t.problem.veryHard, color: 'bg-red-500', emoji: '🔴' };
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-6xl">
        {/* 헤더 */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              {t.problem.problemList}
            </h1>
            <Link href={`/${lang}/create-problem`}>
              <button className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-3 sm:px-4 py-2 rounded-xl transition-all duration-200 text-sm sm:text-base touch-manipulation">
                <i className="ri-add-circle-line mr-2"></i>
                {t.problem.createProblem}
              </button>
            </Link>
          </div>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-slate-800 rounded-xl p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6 border border-slate-700">
          <div className="space-y-3 sm:space-y-4">
            {/* 검색 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">{t.problem.search}:</label>
              <input
                type="text"
                placeholder={t.problem.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm sm:text-base"
              />
            </div>

            {/* 난이도 필터 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">{t.problem.difficultyLabel}:</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDifficultyFilter('all')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    difficultyFilter === 'all'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {t.problem.all}
                </button>
                <button
                  onClick={() => setDifficultyFilter('easy')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    difficultyFilter === 'easy'
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {t.problem.easy}
                </button>
                <button
                  onClick={() => setDifficultyFilter('medium')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    difficultyFilter === 'medium'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {t.problem.medium}
                </button>
                <button
                  onClick={() => setDifficultyFilter('hard')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    difficultyFilter === 'hard'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {t.problem.hard}
                </button>
              </div>
            </div>

            {/* 정렬 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">{t.problem.sortLabel}:</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSortOption('latest')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    sortOption === 'latest'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {t.problem.latest}
                </button>
                <button
                  onClick={() => setSortOption('popular')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    sortOption === 'popular'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {t.problem.popular}
                </button>
                <button
                  onClick={() => setSortOption('difficulty')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    sortOption === 'difficulty'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {t.problem.difficultySort}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 광고: 필터 섹션 후 */}
        <div className="my-6">
          <AdNativeBanner
            position="problems-after-filters"
            className="w-full max-w-md mx-auto"
            cardStyle={true}
          />
        </div>

        {/* 문제 목록 */}
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
              {paginatedProblems.map(problem => {
              const averageRating = (problem as any).average_rating || 0;
              const ratingCount = (problem as any).rating_count || 0;
              const difficultyBadge = getDifficultyFromRating(averageRating);
              return (
                <div
                  key={problem.id}
                  className="bg-slate-800 rounded-xl p-3 sm:p-4 lg:p-6 border border-slate-700 hover:border-teal-500/50 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                    <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white flex-1 break-words">
                      {problem.title}
                    </h3>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${difficultyBadge.color} text-white whitespace-nowrap`}>
                        {difficultyBadge.emoji} {difficultyBadge.text}
                      </span>
                      {averageRating > 0 && (
                        <span className="text-xs text-slate-400">
                          ⭐ {averageRating.toFixed(1)} ({ratingCount})
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 mb-3 sm:mb-4 line-clamp-3">
                    {truncateText(problem.content, 100)}
                  </p>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 sm:mb-4 text-xs sm:text-sm text-slate-400">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="flex items-center gap-1">
                        <i className="ri-eye-line"></i>
                        {problem.view_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-heart-line"></i>
                        {problem.like_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-chat-3-line"></i>
                        {problem.comment_count || 0}
                      </span>
                    </div>
                  </div>

                  <Link href={`/${lang}/problem/${problem.id}`}>
                    <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2 sm:py-2.5 rounded-lg transition-all duration-200 text-sm sm:text-base touch-manipulation">
                      {t.problem.solve}
                    </button>
                  </Link>
                </div>
              );
            })}
            </div>

            {/* 광고: 문제 리스트 중간 (6개 문제 후) */}
            {paginatedProblems.length > 6 && currentPage === 1 && (
              <div className="my-6">
                <div className="flex flex-col items-center gap-4">
                  <AdNativeBanner
                    position="problems-middle"
                    className="w-full max-w-md"
                    cardStyle={true}
                  />
                  <div className="hidden sm:block">
                    <AdBanner300x250 position="problems-middle" />
                  </div>
                </div>
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-6 sm:mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm font-semibold"
                >
                  <i className="ri-arrow-left-line"></i>
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 sm:px-4 py-2 rounded-lg transition-all text-sm font-semibold ${
                        currentPage === pageNum
                          ? 'bg-teal-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm font-semibold"
                >
                  <i className="ri-arrow-right-line"></i>
                </button>
              </div>
            )}

            {/* 결과 개수 */}
            {!isLoading && (
              <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-slate-400">
                {lang === 'ko' 
                  ? `총 ${filteredProblems.length}개의 문제 (${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredProblems.length)} / ${filteredProblems.length})`
                  : `Total ${filteredProblems.length} problems (${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredProblems.length)} / ${filteredProblems.length})`
                }
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

