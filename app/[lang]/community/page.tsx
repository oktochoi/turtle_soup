'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const { user } = useAuth();
  const t = useTranslations();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            {t.community.title}
          </h1>
          <button
            onClick={() => {
              if (user) {
                router.push(`/${lang}/community/create`);
              } else {
                router.push(`/${lang}/auth/login`);
              }
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all font-semibold text-sm sm:text-base touch-manipulation active:scale-95"
          >
            <i className="ri-pencil-line mr-2"></i>
            {t.community.createPost}
          </button>
        </div>

        {/* 검색 및 필터 */}
        <div className="mb-4 sm:mb-6 bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 sm:p-6 border border-slate-700/50">
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

        {/* 카테고리 탭 */}
        <div className="mb-4 sm:mb-6 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="flex gap-2 pb-2 min-w-max">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                }}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-1.5 sm:gap-2 touch-manipulation ${
                  selectedCategory === category.id
                    ? `bg-gradient-to-r ${category.color} text-white shadow-lg`
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 active:bg-slate-600'
                }`}
              >
                <i className={category.icon}></i>
                <span className="hidden xs:inline">{category.label}</span>
                <span className="xs:hidden">{category.label.length > 4 ? category.label.substring(0, 4) : category.label}</span>
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
            <div className="space-y-4">
              {paginatedPosts.map((post) => {
                const categoryInfo = getCategoryInfo(post.category);
                return (
                  <div
                    key={post.id}
                    onClick={() => router.push(`/${lang}/community/${post.id}`)}
                    className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 sm:p-5 lg:p-6 border border-slate-700/50 hover:border-blue-500/50 active:border-blue-500 transition-all cursor-pointer hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-1 active:translate-y-0 touch-manipulation"
                  >
                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                      {post.is_notice && (
                        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-gradient-to-r from-red-500 to-pink-500 text-white whitespace-nowrap animate-pulse">
                          <i className="ri-megaphone-fill mr-1"></i>
                          {lang === 'ko' ? '공지사항' : 'Notice'}
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold bg-gradient-to-r ${categoryInfo.color} text-white whitespace-nowrap`}>
                        <i className={`${categoryInfo.icon} mr-1`}></i>
                        {categoryInfo.label}
                      </span>
                    </div>
                    <h2 className={`text-base sm:text-lg lg:text-xl font-bold mb-2 sm:mb-3 line-clamp-2 leading-tight ${
                      post.is_notice ? 'text-red-400' : 'text-white'
                    }`}>
                      {post.is_notice && <i className="ri-pushpin-fill mr-2 text-red-500"></i>}
                      {post.title}
                    </h2>
                    <p className="text-xs sm:text-sm lg:text-base text-slate-300 mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-3 leading-relaxed">
                      {post.content}
                    </p>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 text-xs sm:text-sm text-slate-400">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        {postGameUserIds.get(post.id) ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/${lang}/profile/${postGameUserIds.get(post.id)}`);
                            }}
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          >
                            <UserLabel
                              userId={postGameUserIds.get(post.id)!}
                              nickname={post.author}
                              size="sm"
                            />
                          </div>
                        ) : (
                          <span className="flex items-center gap-1">
                            <i className="ri-user-line"></i>
                            <span className="truncate max-w-[100px] sm:max-w-none">{post.author}</span>
                          </span>
                        )}
                        <span className="whitespace-nowrap">{formatDate(post.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <i className="ri-eye-line"></i>
                          {post.view_count}
                        </span>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <i className="ri-heart-line"></i>
                          {post.like_count}
                        </span>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <i className="ri-chat-3-line"></i>
                          {post.comment_count}
                        </span>
                      </div>
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

