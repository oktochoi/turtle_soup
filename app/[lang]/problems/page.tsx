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
import { QUIZ_TYPE_METADATA, type QuizType } from '@/lib/types/quiz';

// 게임 유형별 색상 팔레트
const getQuizTypeColors = (quizType: QuizType) => {
  const colorMap: Record<QuizType, { bg: string; text: string; border: string }> = {
    soup: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
    reasoning: { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30' },
    nonsense: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' },
    mcq: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
    ox: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
    image: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
    poll: { bg: 'bg-pink-500/20', text: 'text-pink-300', border: 'border-pink-500/30' },
    balance: { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/30' },
    logic: { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' },
    pattern: { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/30' },
    liar: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
    mafia: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
    chat: { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/30' },
    battle: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' },
    fill_blank: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
    order: { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/30' },
  };
  return colorMap[quizType] || { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/30' };
};

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
  const [quizTypeFilter, setQuizTypeFilter] = useState<string>('all'); // 태그 기반으로 변경
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'featured'>('all');
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
  }, [problems, difficultyFilter, quizTypeFilter, featuredFilter, searchQuery, sortOption, selectedTags]);

  const loadProblems = async () => {
    try {
      const currentLang = 'ko';
      
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

    // 관리자 채택 필터
    if (featuredFilter === 'featured') {
      filtered = filtered.filter(p => {
        const status = (p as any).status || 'published';
        return status === 'featured';
      });
    }

    // 퀴즈 타입 필터 (tags 기반으로 변경 - 태그값 직접 사용)
    if (quizTypeFilter !== 'all') {
      filtered = filtered.filter(p => {
        const tags = (p.tags && Array.isArray(p.tags)) ? p.tags : [];
        // tags 배열에 선택한 태그가 정확히 포함되어 있는지 확인
        return tags.includes(quizTypeFilter);
      });
    }

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
      filtered = filtered.filter(p => {
        const type = (p as any).type || 'soup';
        const typeName = type === 'soup' ? '바다거북스프' :
                        type === 'nonsense' ? '넌센스 퀴즈' :
                        type === 'mcq' ? '객관식 퀴즈' :
                        type === 'ox' ? 'OX 퀴즈' :
                        type === 'image' ? '이미지 퀴즈' :
                        type === 'balance' ? '밸런스 게임' :
                        type === 'logic' ? '논리 퍼즐' :
                        type === 'fill_blank' ? '빈칸 퀴즈' :
                        type === 'liar' ? '라이어 게임' :
                        type === 'mafia' ? '마피아' : type;
        return p.title.toLowerCase().includes(query) ||
               p.content.toLowerCase().includes(query) ||
               typeName.toLowerCase().includes(query) ||
               type.toLowerCase().includes(query) ||
               (p.tags && Array.isArray(p.tags) && p.tags.some(tag => tag.toLowerCase().includes(query)));
      });
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
            <div className="flex items-center gap-3">
              <Link href={`/${lang}/play`}>
                <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
                  <i className="ri-arrow-left-line mr-2"></i>
                  {'게임 선택'}
                </button>
              </Link>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                {'바다거북스프 문제 모음'}
              </h1>
            </div>
            <Link href={`/${lang}/create-problem`}>
              <button className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-3 sm:px-4 py-2 rounded-xl transition-all duration-200 text-sm sm:text-base touch-manipulation">
                <i className="ri-add-circle-line mr-2"></i>
                {t.problem.createProblem}
              </button>
            </Link>
          </div>

          {/* SEO 카테고리 내부 링크 */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
            {[
              { href: `/${lang}/problems/legend`, label: '🏆 레전드 문제', color: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30 hover:border-amber-400/60' },
              { href: `/${lang}/problems/hard`, label: '🔥 어려운 문제', color: 'from-red-500/20 to-orange-500/20 border-red-500/30 hover:border-red-400/60' },
              { href: `/${lang}/problems/scary`, label: '👻 공포·반전', color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30 hover:border-purple-400/60' },
              { href: `/${lang}/problems/easy`, label: '🌱 쉬운 문제', color: 'from-green-500/20 to-emerald-500/20 border-green-500/30 hover:border-green-400/60' },
              { href: `/${lang}/problems/latest`, label: '✨ 최신 문제', color: 'from-cyan-500/20 to-teal-500/20 border-cyan-500/30 hover:border-cyan-400/60' },
            ].map((cat) => (
              <Link key={cat.href} href={cat.href} className={`block text-center py-2.5 px-3 rounded-xl bg-gradient-to-r ${cat.color} border text-white text-sm font-medium transition-all duration-200`}>
                {cat.label}
              </Link>
            ))}
          </div>

          {/* 설명 텍스트 */}
          <div className="mt-4 p-4 sm:p-5 bg-slate-800/60 rounded-xl border border-slate-700/50 text-slate-300 text-sm sm:text-base leading-relaxed space-y-3">
            <p>
              {'바다거북스프 문제를 찾고 계신가요? 레전드 문제부터 어려운 문제, 공포·반전 문제까지 다양한 바다거북스프 문제를 직접 풀어볼 수 있습니다. AI가 질문에 자동으로 답변해주는 솔로 모드로 혼자서도 추리를 즐길 수 있습니다.'}
            </p>
            <p>
              {'바다거북스프 퍼즐은 장소, 등장인물, 시간, 행동 순서를 체계적으로 좁혀가는 것이 핵심입니다. 초반에는 넓은 범위를 묻고, 정보가 모이면 구체적으로 좁혀가세요. 추리 팁은 튜토리얼 페이지에서 확인할 수 있습니다.'}
            </p>
            <p>
              {'친구들과 함께 플레이하고 싶다면 방 만들기에서 멀티플레이어 모드를 선택하세요. 문제를 만들고 싶다면 위의 "문제 만들기" 버튼을 클릭하세요.'}
            </p>
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

            {/* 관리자 채택 필터 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                관리자 채택:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFeaturedFilter('all')}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                    featuredFilter === 'all'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {t.problem.all}
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
                  {'관리자 채택'}
                </button>
              </div>
            </div>

            {/* 게임 유형 필터 - 바다거북 스프만 표시 (필터 숨김) */}

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
              
              // 이미지 URL 추출 (quizContent에서)
              let imageUrl: string | null = null;
              // quiz_type 필드 확인 (다양한 필드명 시도)
              const quizType = (problem as any).quiz_type 
                || (problem as any).quizType 
                || (problem as any).type 
                || 'soup';
              
              // 디버깅: quiz_type이 없거나 잘못된 경우 로그
              if (!quizType || quizType === 'soup') {
                console.log('문제 ID:', problem.id, 'quiz_type:', quizType, '전체 problem:', problem);
              }
              
              const quizTypeMetadata = QUIZ_TYPE_METADATA[quizType as QuizType];
              
              try {
                // quiz_content 필드 확인 (다양한 필드명 시도)
                const quizContentRaw = (problem as any).quiz_content 
                  || (problem as any).quizContent 
                  || (problem as any).content;
                
                if (quizContentRaw) {
                  let quizContent: any = null;
                  
                  // 문자열인 경우 JSON인지 확인 후 파싱
                  if (typeof quizContentRaw === 'string') {
                    // JSON 문자열인지 확인 (시작이 { 또는 [인 경우만)
                    const trimmed = quizContentRaw.trim();
                    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                      try {
                        quizContent = JSON.parse(quizContentRaw);
                      } catch (e) {
                        // JSON이 아니면 무시 (일반 텍스트일 수 있음)
                        quizContent = null;
                      }
                    } else {
                      // JSON이 아닌 일반 텍스트는 무시
                      quizContent = null;
                    }
                  } else {
                    // 이미 객체인 경우
                    quizContent = quizContentRaw;
                  }
                  
                  if (quizContent && typeof quizContent === 'object' && !Array.isArray(quizContent)) {
                    // image_url이 직접 있는 경우 (모든 타입)
                    if (quizContent.image_url && typeof quizContent.image_url === 'string') {
                      imageUrl = quizContent.image_url;
                    }
                    // imageUrl (camelCase)도 확인
                    else if (quizContent.imageUrl && typeof quizContent.imageUrl === 'string') {
                      imageUrl = quizContent.imageUrl;
                    }
                    // image 필드도 확인
                    else if (quizContent.image && typeof quizContent.image === 'string') {
                      imageUrl = quizContent.image;
                    }
                  }
                }
                
                // quiz_content에서 찾지 못한 경우, problem의 image_url 필드 직접 확인
                if (!imageUrl) {
                  const directImageUrl = (problem as any).image_url || (problem as any).imageUrl || (problem as any).image;
                  if (directImageUrl && typeof directImageUrl === 'string') {
                    imageUrl = directImageUrl;
                  }
                }
                
                // Supabase Storage URL인 경우 public URL로 변환
                if (imageUrl && imageUrl.includes('supabase.co/storage/v1/object')) {
                  // 이미 public URL이면 그대로 사용
                  if (imageUrl.includes('/public/')) {
                    // 그대로 사용
                  } else {
                    // signed URL인 경우 public으로 변환 시도
                    imageUrl = imageUrl.replace('/sign/', '/public/');
                  }
                }
                
                // 최종적으로 유효한 URL인지 확인 (http:// 또는 https://로 시작하는지)
                if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                  imageUrl = null;
                }
              } catch (e) {
                // 예상치 못한 오류는 무시하고 이미지 없이 진행
                imageUrl = null;
              }
              
              // tags 배열 가져오기
              const problemTags = problem.tags && Array.isArray(problem.tags) ? problem.tags : [];
              
              return (
                <div
                  key={problem.id}
                  className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 sm:p-5 lg:p-6 border border-slate-700/60 hover:border-slate-600 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {/* 이미지 썸네일 (가운데 정렬, 중앙 표시) - 이미지가 있을 때만 표시 */}
                  {imageUrl && (
                    <div className="mb-3 sm:mb-4 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center" style={{ minHeight: '120px' }}>
                      <img
                        src={imageUrl}
                        alt={problem.title}
                        className="w-full h-32 sm:h-40 object-contain"
                        loading="lazy"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          console.error('이미지 로드 실패:', imageUrl, '문제 ID:', problem.id, '문제 제목:', problem.title);
                          // 이미지 로드 실패 시 숨김
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                        onLoad={() => {
                          console.log('이미지 로드 성공:', imageUrl, '문제 ID:', problem.id);
                        }}
                      />
                    </div>
                  )}

                  {/* Tags 표시 (제목 위) */}
                  {problemTags.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {problemTags.map((tag, tagIndex) => {
                        // 태그에 맞는 색상 매핑 (기존 게임 유형 색상 사용)
                        let tagColor = { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/30' };
                        
                        // 태그명을 기반으로 색상 결정
                        const tagLower = tag.toLowerCase();
                        if (tagLower.includes('바다거북') || tagLower.includes('soup')) {
                          tagColor = getQuizTypeColors('soup');
                        } else if (tagLower.includes('객관식') || tagLower.includes('mcq')) {
                          tagColor = getQuizTypeColors('mcq');
                        } else if (tagLower.includes('ox')) {
                          tagColor = getQuizTypeColors('ox');
                        } else if (tagLower.includes('이미지') || tagLower.includes('image')) {
                          tagColor = getQuizTypeColors('image');
                        } else if (tagLower.includes('밸런스') || tagLower.includes('balance')) {
                          tagColor = getQuizTypeColors('balance');
                        } else if (tagLower.includes('로직') || tagLower.includes('logic')) {
                          tagColor = getQuizTypeColors('logic');
                        } else if (tagLower.includes('패턴') || tagLower.includes('pattern')) {
                          tagColor = getQuizTypeColors('pattern');
                        } else if (tagLower.includes('추론') || tagLower.includes('reasoning')) {
                          tagColor = getQuizTypeColors('reasoning');
                        } else if (tagLower.includes('넌센스') || tagLower.includes('nonsense')) {
                          tagColor = getQuizTypeColors('nonsense');
                        } else if (tagLower.includes('라이어') || tagLower.includes('liar')) {
                          tagColor = getQuizTypeColors('liar');
                        } else if (tagLower.includes('마피아') || tagLower.includes('mafia')) {
                          tagColor = getQuizTypeColors('mafia');
                        } else if (tagLower.includes('아재') || tagLower.includes('puns')) {
                          tagColor = { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' };
                        }
                        
                        return (
                          <span
                            key={tagIndex}
                            className={`inline-block px-2 py-1 ${tagColor.bg} ${tagColor.text} rounded text-xs font-medium border ${tagColor.border}`}
                          >
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white break-words hover:text-slate-100 transition-colors">
                          {problem.title}
                        </h3>
                        {(problem as any).status === 'featured' && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs font-medium border border-amber-500/30 flex items-center gap-1 whitespace-nowrap">
                            <i className="ri-star-fill text-amber-400"></i>
                            {'관리자 채택'}
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

                  <p className="text-xs sm:text-sm text-slate-300 mb-3 sm:mb-4 line-clamp-3">
                    {truncateText(problem.content, 100)}
                  </p>

                  <div className="mb-3 sm:mb-4" />

                  <Link href={`/${lang}/problem/${problem.id}`}>
                    <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 sm:py-3 rounded-lg transition-all duration-200 text-sm sm:text-base touch-manipulation">
                      {t.problem.solve}
                    </button>
                  </Link>
                </div>
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
                {`총 ${filteredProblems.length}개의 문제 (${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredProblems.length)} / ${filteredProblems.length})`}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

