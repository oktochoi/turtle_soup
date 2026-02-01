'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import UserLabel from '@/components/UserLabel';
import { useTranslations } from '@/hooks/useTranslations';
import { PostCardSkeleton } from '@/components/Skeleton';
import { PostsEmptyState } from '@/components/EmptyState';
import { handleError } from '@/lib/error-handler';

type Post = {
  id: string;
  title: string;
  content: string;
  author: string;
  user_id: string | null;
  category: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  is_notice: boolean;
  created_at: string;
  updated_at: string;
};

type Category = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

export default function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const t = useTranslations();
  const categoryFromUrl = searchParams.get('category');
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    categoryFromUrl === 'notice' ? 'notice' : 'all'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [postGameUserIds, setPostGameUserIds] = useState<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [sortOption, setSortOption] = useState<'latest' | 'popular' | 'most_comments' | 'most_views'>('latest');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const CATEGORIES: Category[] = [
    { id: 'all', label: t.community.all, icon: 'ri-list-check', color: 'from-slate-500 to-slate-600' },
    { id: 'notice', label: t.community.notice, icon: 'ri-megaphone-line', color: 'from-red-500 to-pink-500' },
    { id: 'daily', label: t.community.daily, icon: 'ri-calendar-check-line', color: 'from-yellow-500 to-orange-500' },
    { id: 'recommend', label: t.community.recommend, icon: 'ri-share-forward-line', color: 'from-green-500 to-emerald-500' },
    { id: 'free', label: t.community.free, icon: 'ri-chat-3-line', color: 'from-blue-500 to-cyan-500' },
    { id: 'bug', label: t.community.bug, icon: 'ri-bug-line', color: 'from-purple-500 to-indigo-500' },
    { id: 'hall_of_fame', label: t.community.hallOfFame, icon: 'ri-trophy-line', color: 'from-yellow-400 to-amber-500' },
    { id: 'funny', label: t.community.funny, icon: 'ri-emotion-laugh-line', color: 'from-pink-500 to-rose-500' },
    { id: 'social', label: t.community.social, icon: 'ri-group-line', color: 'from-teal-500 to-cyan-500' },
  ];

  // URL ?category=notice 파라미터와 동기화
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat === 'notice') {
      setSelectedCategory('notice');
    }
  }, [searchParams]);

  useEffect(() => {
    loadPosts();
    
    // 실시간 업데이트를 위한 구독 설정
    const channel = supabase
      .channel('posts-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'post_likes' },
        () => {
          // 좋아요 변경 시 게시글 목록 새로고침
          loadPosts();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        () => {
          // 댓글 변경 시 게시글 목록 새로고침
          loadPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCategory]);

  const loadPosts = async () => {
    try {
      const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
      let query = supabase
        .from('posts')
        .select('*')
        .eq('lang', currentLang)
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // 뷰, 하트, 댓글 수를 최신 상태로 업데이트
      const postsWithCounts = await Promise.all((data || []).map(async (post) => {
        // 댓글 수 직접 계산
        const { count: commentCount } = await supabase
          .from('post_comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);
        
        // 좋아요 수 직접 계산
        const { count: likeCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);
        
        return {
          ...post,
          comment_count: commentCount || 0,
          like_count: likeCount || 0,
        };
      }));
      
      setPosts(postsWithCounts);

      // 각 게시글 작성자의 game_user_id 찾기
      const userIds = new Map<string, string>();
      for (const post of data || []) {
        if (post.user_id) {
          const { data: gameUser } = await supabase
            .from('game_users')
            .select('id')
            .eq('auth_user_id', post.user_id)
            .maybeSingle();

          if (gameUser) {
            userIds.set(post.id, gameUser.id);
          }
        }
      }
      setPostGameUserIds(userIds);
    } catch (error) {
      handleError(error, '게시글 로드', true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    filterAndSortPosts();
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 리셋
  }, [posts, selectedCategory, searchQuery, authorFilter, sortOption, dateRange]);

  const filterAndSortPosts = () => {
    let filtered = [...posts];

    // 카테고리 필터
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(post => post.category === selectedCategory);
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post => 
        post.title.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query)
      );
    }

    // 작성자 필터
    if (authorFilter.trim()) {
      const query = authorFilter.toLowerCase();
      filtered = filtered.filter(post => 
        post.author.toLowerCase().includes(query)
      );
    }

    // 날짜 범위 필터
    if (dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      switch (dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
      }
      filtered = filtered.filter(post => new Date(post.created_at) >= cutoffDate);
    }

    // 전체 카테고리일 때 공지사항을 최상단에 표시
    if (selectedCategory === 'all') {
      // 공지사항과 일반 게시글 분리
      const notices = filtered.filter(post => post.is_notice);
      const regularPosts = filtered.filter(post => !post.is_notice);
      
      // 공지사항은 최신순 정렬
      notices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // 일반 게시글 정렬
      switch (sortOption) {
        case 'latest':
          regularPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case 'popular':
          regularPosts.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
          break;
        case 'most_comments':
          regularPosts.sort((a, b) => (b.comment_count || 0) - (a.comment_count || 0));
          break;
        case 'most_views':
          regularPosts.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
          break;
      }
      
      // 공지사항을 맨 위에, 그 다음 일반 게시글
      filtered = [...notices, ...regularPosts];
    } else {
      // 특정 카테고리 선택 시 일반 정렬
      switch (sortOption) {
        case 'latest':
          filtered.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          break;
        case 'popular':
          filtered.sort((a, b) => 
            (b.like_count || 0) - (a.like_count || 0)
          );
          break;
        case 'most_comments':
          filtered.sort((a, b) => 
            (b.comment_count || 0) - (a.comment_count || 0)
          );
          break;
        case 'most_views':
          filtered.sort((a, b) => 
            (b.view_count || 0) - (a.view_count || 0)
          );
          break;
      }
    }

    setFilteredPosts(filtered);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t.community.justNow;
    if (minutes < 60) return `${minutes}${t.community.minutesAgo}`;
    if (hours < 24) return `${hours}${t.community.hoursAgo}`;
    if (days < 7) return `${days}${t.community.daysAgo}`;
    return date.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US');
  };

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(cat => cat.id === categoryId) || CATEGORIES[0];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-6xl">
        {/* 커뮤니티 헤더 & 소개 (AdSense용 풍부한 콘텐츠) */}
        <div className="mb-6 bg-slate-800/60 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-slate-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              {lang === 'ko' ? '바다거북스프 퀴즈하는 커뮤니티' : 'Turtle Soup Quiz Community'}
            </h1>
            <button
              onClick={() => {
                if (user) {
                  router.push(`/${lang}/community/create`);
                } else {
                  router.push(`/${lang}/auth/login`);
                }
              }}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
            >
              <i className="ri-pencil-line"></i>
              {t.community.createPost}
            </button>
          </div>
          <div className="text-sm sm:text-base text-slate-300 leading-relaxed space-y-2">
            {lang === 'ko' ? (
              <>
                <p>바다거북스프(바거수)는 예/아니오 질문을 통해 이야기의 진실을 추리하는 퀴즈 게임입니다. 이 커뮤니티에서는 바다거북스프 관련 정보 공유, 문제 추천, 해설 논의, 자유 게시, 버그 신고 등 다양한 주제로 소통할 수 있습니다.</p>
                <p>멀티플레이어 방에서 친구들과 함께 플레이하거나, 오프라인으로 혼자 문제를 풀어보세요. 사용자가 만든 문제와 맞추기 게임 세트도 즐길 수 있습니다. 질문 설계 요령, 힌트 활용법, 추리 팁 등 바거수 실력을 높이는 정보를 공유해 주세요.</p>
              </>
            ) : (
              <>
                <p>Turtle Soup (Pelican Soup) is a deduction quiz game where you uncover the truth through yes/no questions. In this community, you can share information, recommend problems, discuss solutions, post freely, and report bugs.</p>
                <p>Play with friends in multiplayer rooms or solve problems offline. Enjoy user-created problems and guess game sets. Share tips on question design, hint usage, and deduction strategies to improve your Turtle Soup skills.</p>
              </>
            )}
          </div>
        </div>


        {/* 검색 및 필터 */}
        <div className="mb-4 sm:mb-6 bg-slate-800/50 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-slate-700/50">
          <div className="space-y-4">
            {/* 검색 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '제목/내용 검색' : 'Search Title/Content'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'ko' ? '제목이나 내용을 입력하세요...' : 'Enter title or content...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '작성자 검색' : 'Search Author'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'ko' ? '작성자 닉네임을 입력하세요...' : 'Enter author nickname...'}
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            {/* 정렬 및 날짜 필터 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '정렬' : 'Sort'}
                </label>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="latest">{lang === 'ko' ? '최신순' : 'Latest'}</option>
                  <option value="popular">{lang === 'ko' ? '인기순 (좋아요)' : 'Popular (Likes)'}</option>
                  <option value="most_comments">{lang === 'ko' ? '댓글 많은순' : 'Most Comments'}</option>
                  <option value="most_views">{lang === 'ko' ? '조회수 많은순' : 'Most Views'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '날짜 범위' : 'Date Range'}
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">{lang === 'ko' ? '전체' : 'All'}</option>
                  <option value="today">{lang === 'ko' ? '오늘' : 'Today'}</option>
                  <option value="week">{lang === 'ko' ? '최근 7일' : 'Last 7 Days'}</option>
                  <option value="month">{lang === 'ko' ? '최근 30일' : 'Last 30 Days'}</option>
                </select>
              </div>
            </div>

            {/* 필터 초기화 */}
            <button
              onClick={() => {
                setSearchQuery('');
                setAuthorFilter('');
                setSortOption('latest');
                setDateRange('all');
              }}
              className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-all"
            >
              <i className="ri-refresh-line mr-2"></i>
              {lang === 'ko' ? '필터 초기화' : 'Reset Filters'}
            </button>
          </div>
        </div>

        {/* 커뮤니티 카테고리 탭 (디시 스타일) */}
        <div className="mb-4 sm:mb-6 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="flex gap-1 sm:gap-2 pb-2 min-w-max border-b border-slate-700">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-t-lg font-semibold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-1 touch-manipulation -mb-px ${
                  selectedCategory === category.id
                    ? `bg-slate-800 text-white border-b-2 border-blue-500`
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <i className={category.icon}></i>
                <span>{category.label.length > 6 ? category.label.substring(0, 6) : category.label}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <PostsEmptyState 
            lang={lang}
            category={selectedCategory}
            onCreateClick={() => {
              if (user) {
                router.push(`/${lang}/community/create`);
              } else {
                router.push(`/${lang}/auth/login`);
              }
            }}
          />
        ) : (
          <>
            {/* 커뮤니티 리스트 (테이블 스타일) */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden">
              {/* 테이블 헤더 */}
              <div className="hidden sm:grid sm:grid-cols-[auto_auto_1fr_auto_auto_auto_auto] gap-2 sm:gap-4 px-4 py-3 bg-slate-800/80 border-b border-slate-700 text-xs sm:text-sm font-semibold text-slate-400">
                <span className="w-10 text-center">{lang === 'ko' ? '번호' : '#'}</span>
                <span className="w-16 sm:w-20">{lang === 'ko' ? '말머리' : 'Cat'}</span>
                <span>{lang === 'ko' ? '제목' : 'Title'}</span>
                <span className="w-20 sm:w-24 truncate">{lang === 'ko' ? '글쓴이' : 'Author'}</span>
                <span className="w-16 sm:w-20">{lang === 'ko' ? '작성일' : 'Date'}</span>
                <span className="w-12 text-center">{lang === 'ko' ? '조회' : 'Views'}</span>
                <span className="w-12 text-center">{lang === 'ko' ? '추천' : 'Likes'}</span>
              </div>
              {/* 게시글 행 */}
              {paginatedPosts.map((post, index) => {
                const categoryInfo = getCategoryInfo(post.category);
                const rowNum = (currentPage - 1) * itemsPerPage + index + 1;
                return (
                  <div
                    key={post.id}
                    onClick={() => router.push(`/${lang}/community/${post.id}`)}
                    className="flex flex-col sm:grid sm:grid-cols-[auto_auto_1fr_auto_auto_auto_auto] gap-1 sm:gap-4 px-4 py-3 sm:py-2.5 border-b border-slate-700/50 last:border-b-0 hover:bg-slate-700/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 sm:contents">
                      <span className="hidden sm:block w-10 text-center text-sm text-slate-500 self-center">{rowNum}</span>
                      <span className="flex-shrink-0">
                        {post.is_notice ? (
                          <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-500/80 text-white">
                            {lang === 'ko' ? '공지' : 'Notice'}
                          </span>
                        ) : (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold bg-gradient-to-r ${categoryInfo.color} text-white`}>
                            {categoryInfo.label.length > 4 ? categoryInfo.label.substring(0, 4) : categoryInfo.label}
                          </span>
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h2 className={`text-sm sm:text-base font-semibold line-clamp-1 ${
                          post.is_notice ? 'text-red-400' : 'text-white'
                        }`}>
                          {post.is_notice && <i className="ri-pushpin-fill mr-1 text-red-500 text-xs"></i>}
                          {post.title}
                          {post.comment_count > 0 && (
                            <span className="ml-1 text-slate-500 text-xs">[{post.comment_count}]</span>
                          )}
                        </h2>
                        <p className="sm:hidden text-xs text-slate-400 mt-0.5 line-clamp-1">{post.content}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:contents mt-1 sm:mt-0 text-xs text-slate-500 gap-2">
                      {postGameUserIds.get(post.id) ? (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/${lang}/profile/${postGameUserIds.get(post.id)}`);
                          }}
                          className="text-slate-300 hover:opacity-80 cursor-pointer truncate max-w-[80px] sm:max-w-[96px] sm:w-24"
                        >
                          {post.author}
                        </span>
                      ) : (
                        <span className="text-slate-300 truncate max-w-[80px] sm:max-w-[96px] sm:w-24">{post.author}</span>
                      )}
                      <span className="whitespace-nowrap sm:w-20">{formatDate(post.created_at)}</span>
                      <span className="hidden sm:block w-12 text-center">{post.view_count}</span>
                      <span className="hidden sm:block w-12 text-center">{post.like_count}</span>
                      <span className="sm:hidden flex gap-3 ml-auto">
                        <span><i className="ri-eye-line"></i> {post.view_count}</span>
                        <span><i className="ri-heart-line"></i> {post.like_count}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
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
                          ? 'bg-blue-500 text-white'
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
              <div className="mt-4 text-center text-xs sm:text-sm text-slate-400">
                {lang === 'ko' 
                  ? `총 ${filteredPosts.length}개의 게시글 (${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredPosts.length)} / ${filteredPosts.length})`
                  : `Total ${filteredPosts.length} posts (${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredPosts.length)} / ${filteredPosts.length})`
                }
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

