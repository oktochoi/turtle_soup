'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import UserLabel from '@/components/UserLabel';
import { useTranslations } from '@/hooks/useTranslations';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [postGameUserIds, setPostGameUserIds] = useState<Map<string, string>>(new Map());

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
      setPosts(data || []);

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
      console.error('게시글 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{t.community.loading}</p>
        </div>
      </div>
    );
  }

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(cat => cat.id === categoryId) || CATEGORIES[0];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            {t.community.title}
          </h1>
          {user && (
            <Link href={`/${lang}/community/create`}>
              <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all font-semibold text-sm sm:text-base">
                <i className="ri-pencil-line mr-2"></i>
                {t.community.createPost}
              </button>
            </Link>
          )}
        </div>

        {/* 카테고리 탭 */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 pb-2 min-w-max">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setIsLoading(true);
                }}
                className={`px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                  selectedCategory === category.id
                    ? `bg-gradient-to-r ${category.color} text-white shadow-lg`
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <i className={category.icon}></i>
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
            <i className="ri-inbox-line text-4xl text-slate-600 mb-4"></i>
            <p className="text-slate-400 mb-4">{t.community.noPosts}</p>
            {user && (
              <Link href={`/${lang}/community/create`}>
                <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all">
                  {t.community.createFirst}
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
                <i className="ri-inbox-line text-4xl text-slate-600 mb-4"></i>
                <p className="text-slate-400 mb-4">
                  {selectedCategory === 'all' 
                    ? t.community.noPosts
                    : `${getCategoryInfo(selectedCategory).label} ${t.community.noPostsInCategory}`}
                </p>
                {user && (
                  <Link href={`/${lang}/community/create`}>
                    <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all">
                      {t.community.createFirst}
                    </button>
                  </Link>
                )}
              </div>
            ) : (
              posts.map((post) => {
                const categoryInfo = getCategoryInfo(post.category);
                return (
                  <div
                    key={post.id}
                    onClick={() => router.push(`/${lang}/community/${post.id}`)}
                    className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-5 sm:p-6 border border-slate-700/50 hover:border-blue-500/50 transition-all cursor-pointer hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-1"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold bg-gradient-to-r ${categoryInfo.color} text-white`}>
                        <i className={`${categoryInfo.icon} mr-1`}></i>
                        {categoryInfo.label}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-2 line-clamp-2">
                      {post.title}
                    </h2>
                    <p className="text-sm sm:text-base text-slate-300 mb-4 line-clamp-3">
                      {post.content}
                    </p>
                    <div className="flex items-center justify-between text-xs sm:text-sm text-slate-400">
                      <div className="flex items-center gap-4">
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
                            {post.author}
                          </span>
                        )}
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <i className="ri-eye-line"></i>
                          {post.view_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-heart-line"></i>
                          {post.like_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-chat-3-line"></i>
                          {post.comment_count}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

