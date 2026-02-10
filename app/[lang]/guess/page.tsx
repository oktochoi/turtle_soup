'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { GuessSet } from '@/lib/types/guess';
import { useTranslations } from '@/hooks/useTranslations';

type SortOption = 'latest' | 'popular' | 'difficulty';

export default function GuessSetsPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';
  const t = useTranslations();
  
  const [sets, setSets] = useState<any[]>([]);
  const [filteredSets, setFilteredSets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 필터 상태
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'featured'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('latest');
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredSets.length / itemsPerPage);
  const paginatedSets = filteredSets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    loadSets();
  }, [lang]);

  useEffect(() => {
    filterAndSortSets();
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 리셋
  }, [sets, difficultyFilter, featuredFilter, searchQuery, sortOption]);

  const loadSets = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('guess_sets')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // 각 세트에 댓글 수, 좋아요 수 추가
      const setsWithCounts = await Promise.all(
        (data || []).map(async (set) => {
          // 댓글 수
          const { count: commentCount } = await supabase
            .from('guess_set_comments')
            .select('id', { count: 'exact', head: true })
            .eq('set_id', set.id);
          
          // 좋아요 수
          const { count: likeCount } = await supabase
            .from('guess_set_likes')
            .select('id', { count: 'exact', head: true })
            .eq('set_id', set.id);
          
          // 평균 별점 계산
          const { data: ratings } = await supabase
            .from('guess_set_ratings')
            .select('rating')
            .eq('set_id', set.id);

          let averageRating = 0;
          let ratingCount = 0;
          
          if (ratings && ratings.length > 0) {
            const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
            averageRating = Number((sum / ratings.length).toFixed(2));
            ratingCount = ratings.length;
          }

          return {
            ...set,
            comment_count: commentCount || 0,
            like_count: likeCount || 0,
            average_rating: averageRating,
            rating_count: ratingCount,
            view_count: set.view_count || 0,
            difficulty_rating: set.difficulty_rating || averageRating || 0,
            status: set.status || 'published',
          };
        })
      );
      
      setSets(setsWithCounts);
    } catch (error: any) {
      console.error('세트 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortSets = () => {
    let filtered = [...sets];

    // 관리자 채택 필터
    if (featuredFilter === 'featured') {
      filtered = filtered.filter(s => s.status === 'featured');
    }

    // 난이도 필터 (별점 기반)
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(s => {
        const rating = s.difficulty_rating || s.average_rating || 0;
        if (difficultyFilter === 'easy') return rating < 3;
        if (difficultyFilter === 'medium') return rating >= 3 && rating < 4;
        if (difficultyFilter === 'hard') return rating >= 4;
        return true;
      });
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        return s.title.toLowerCase().includes(query) ||
               (s.description && s.description.toLowerCase().includes(query));
      });
    }

    // 정렬
    switch (sortOption) {
      case 'latest':
        filtered.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case 'popular':
        // 인기순은 조회수와 좋아요 수로 정렬
        filtered.sort((a, b) => {
          const scoreA = (a.view_count || 0) * 0.3 + (a.like_count || 0) * 0.7;
          const scoreB = (b.view_count || 0) * 0.3 + (b.like_count || 0) * 0.7;
          return scoreB - scoreA;
        });
        break;
      case 'difficulty':
        filtered.sort((a, b) => {
          const ratingA = a.difficulty_rating || a.average_rating || 0;
          const ratingB = b.difficulty_rating || b.average_rating || 0;
          return ratingA - ratingB;
        });
        break;
    }

    setFilteredSets(filtered);
  };

  const getDifficultyFromRating = (rating: number): { text: string; color: string; emoji: string } => {
    if (rating === 0) {
      return { text: lang === 'ko' ? '평가 없음' : 'No rating', color: 'bg-slate-500', emoji: '⚪' };
    } else if (rating < 2) {
      return { text: lang === 'ko' ? '매우 쉬움' : 'Very Easy', color: 'bg-green-500', emoji: '🟢' };
    } else if (rating < 3) {
      return { text: lang === 'ko' ? '쉬움' : 'Easy', color: 'bg-green-400', emoji: '🟢' };
    } else if (rating < 4) {
      return { text: lang === 'ko' ? '보통' : 'Normal', color: 'bg-yellow-500', emoji: '🟡' };
    } else if (rating < 4.5) {
      return { text: lang === 'ko' ? '어려움' : 'Hard', color: 'bg-orange-500', emoji: '🟠' };
    } else {
      return { text: lang === 'ko' ? '매우 어려움' : 'Very Hard', color: 'bg-red-500', emoji: '🔴' };
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-6xl">
        {/* 헤더 */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <Link href={`/${lang}/play`}>
                <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
                  <i className="ri-arrow-left-line mr-2"></i>
                  {lang === 'ko' ? '게임 선택' : 'Select Game'}
                </button>
              </Link>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                {lang === 'ko' ? '맞추기 게임' : 'Guess Games'}
              </h1>
            </div>
            <Link href={`/${lang}/guess/create`}>
              <button className="w-full sm:w-auto bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 text-white font-semibold px-3 sm:px-4 py-2 rounded-xl transition-all duration-200 text-sm sm:text-base touch-manipulation">
                <i className="ri-add-circle-line mr-2"></i>
                {lang === 'ko' ? '새 게임 만들기' : 'Create New Game'}
              </button>
            </Link>
          </div>

          {/* 설명 텍스트 (AdSense 품질 강화) */}
          <div className="mt-4 p-4 sm:p-5 bg-slate-800/60 rounded-xl border border-slate-700/50 text-slate-300 text-sm sm:text-base leading-relaxed space-y-3">
            <p>
              {lang === 'ko'
                ? '맞추기 게임은 카드 세트로 즐기는 바다거북스프형 퀴즈입니다. 사용자가 만든 카드 세트(제목, 정답, 힌트가 있는 카드 묶음)를 시간 제한 안에 맞추는 게임입니다. 한 장씩 카드를 넘기며 정답을 추측하고, 힌트를 활용해 빠르게 맞추면 높은 점수를 얻습니다.'
                : 'Guess Games are Turtle Soup-style quizzes played with card sets. Guess answers within the time limit using user-created card sets (cards with titles, answers, and hints). Flip cards one by one, guess the answer, and use hints to score higher.'}
            </p>
            <p>
              {lang === 'ko'
                ? '혼자서 연습하거나 친구들과 대결할 수 있습니다. 인기 세트를 플레이하거나 직접 세트를 만들어 공유할 수 있습니다. 각 세트마다 난이도와 카드 수가 다르므로 자신에게 맞는 세트를 선택하세요.'
                : 'Practice alone or compete with friends. Play popular sets or create and share your own. Each set has different difficulty and card count—choose one that suits you.'}
            </p>
          </div>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-slate-800 rounded-xl p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6 border border-slate-700">
          <div className="space-y-3 sm:space-y-4">
            {/* 검색 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                {lang === 'ko' ? '검색' : 'Search'}:
              </label>
              <input
                type="text"
                placeholder={lang === 'ko' ? '제목 또는 설명으로 검색...' : 'Search by title or description...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
              />
            </div>

            {/* 관리자 채택 필터 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                {lang === 'ko' ? '관리자 채택' : 'Featured'}:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFeaturedFilter('all')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    featuredFilter === 'all'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {lang === 'ko' ? '전체' : 'All'}
                </button>
                <button
                  onClick={() => setFeaturedFilter('featured')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    featuredFilter === 'featured'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <i className="ri-star-fill mr-1"></i>
                  {lang === 'ko' ? '관리자 채택' : 'Featured'}
                </button>
              </div>
            </div>

            {/* 난이도 필터 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                {lang === 'ko' ? '난이도' : 'Difficulty'}:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDifficultyFilter('all')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    difficultyFilter === 'all'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {lang === 'ko' ? '전체' : 'All'}
                </button>
                <button
                  onClick={() => setDifficultyFilter('easy')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    difficultyFilter === 'easy'
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {lang === 'ko' ? '쉬움' : 'Easy'}
                </button>
                <button
                  onClick={() => setDifficultyFilter('medium')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    difficultyFilter === 'medium'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {lang === 'ko' ? '중간' : 'Medium'}
                </button>
                <button
                  onClick={() => setDifficultyFilter('hard')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    difficultyFilter === 'hard'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {lang === 'ko' ? '어려움' : 'Hard'}
                </button>
              </div>
            </div>

            {/* 정렬 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                {lang === 'ko' ? '정렬' : 'Sort'}:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSortOption('latest')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    sortOption === 'latest'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {lang === 'ko' ? '최신순' : 'Latest'}
                </button>
                <button
                  onClick={() => setSortOption('popular')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    sortOption === 'popular'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {lang === 'ko' ? '인기순' : 'Popular'}
                </button>
                <button
                  onClick={() => setSortOption('difficulty')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    sortOption === 'difficulty'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {lang === 'ko' ? '난이도순' : 'Difficulty'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 게임 세트 목록 */}
        {filteredSets.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
            <div className="text-4xl mb-4 text-slate-500">
              <i className="ri-image-search-line"></i>
            </div>
            <p className="text-slate-400 mb-4">{lang === 'ko' ? '게임 세트가 없습니다.' : 'No game sets found.'}</p>
            <Link href={`/${lang}/guess/create`}>
              <button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-4 py-2 rounded-lg transition-all">
                {lang === 'ko' ? '첫 게임 만들기' : 'Create First Game'}
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              {paginatedSets.map((set) => {
                const averageRating = set.average_rating || 0;
                const ratingCount = set.rating_count || 0;
                const difficultyRating = set.difficulty_rating || averageRating || 0;
                const difficultyBadge = getDifficultyFromRating(difficultyRating);
                
                return (
                  <Link key={set.id} href={`/${lang}/guess/${set.id}`}>
                    <div className="group bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 sm:p-5 lg:p-6 border border-slate-700/60 hover:border-purple-500/50 transition-colors duration-200 cursor-pointer h-full flex flex-col">
                      {/* 커버 이미지 */}
                      {set.cover_image_url && (
                        <div className="w-full h-32 sm:h-40 mb-3 sm:mb-4 rounded-lg overflow-hidden relative">
                          <img
                            src={set.cover_image_url}
                            alt={set.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>
                        </div>
                      )}
                      
                      {/* 제목 및 설명 */}
                      <div className="flex-1 mb-3 sm:mb-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white line-clamp-2 group-hover:text-purple-300 transition-colors">
                                {set.title}
                              </h3>
                              {set.status === 'featured' && (
                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs font-medium border border-amber-500/30 flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                                  <i className="ri-star-fill text-amber-400"></i>
                                  {lang === 'ko' ? '관리자 채택' : 'Featured'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${difficultyBadge.color} text-white whitespace-nowrap`}>
                              {difficultyBadge.emoji} {difficultyBadge.text}
                            </span>
                            {averageRating > 0 && (
                              <span className="text-xs text-slate-400">
                                ⭐ {averageRating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        {set.description && (
                          <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed">
                            {truncateText(set.description, 100)}
                          </p>
                        )}
                      </div>

                      {/* 통계 정보 (숫자는 숨기고 기록만 유지) */}
                      <div className="pt-3 sm:pt-4 border-t border-slate-700/50 text-xs sm:text-sm text-slate-400" />
                    </div>
                  </Link>
                );
              })}
            </div>

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
                          ? 'bg-purple-500 text-white'
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
                  ? `총 ${filteredSets.length}개의 게임 (${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredSets.length)} / ${filteredSets.length})`
                  : `Total ${filteredSets.length} games (${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredSets.length)} / ${filteredSets.length})`
                }
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
