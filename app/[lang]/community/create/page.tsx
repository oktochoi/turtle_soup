'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import { createClient } from '@/lib/supabase/client';

type Category = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

export default function CreatePostPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('free');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  const CATEGORIES: Category[] = [
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
    const checkAdmin = async () => {
      if (!user) {
        setIsCheckingAdmin(false);
        return;
      }

      try {
        const supabaseClient = createClient();
        const { data: userData, error } = await supabaseClient
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('관리자 확인 오류:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(userData?.is_admin || false);
        }
      } catch (error) {
        console.error('관리자 확인 오류:', error);
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    checkAdmin();
  }, [user]);

  if (isCheckingAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl animate-spin text-teal-400"></i>
          <p className="mt-4 text-slate-400">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{t.community.loginRequired}</p>
          <Link href={`/${lang}/auth/login`}>
            <button className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg">
              {t.community.loginButton}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      alert(t.community.enterTitleAndContent);
      return;
    }

    if (!category) {
      alert(t.community.selectCategory);
      return;
    }

    setIsSubmitting(true);
    try {
      // 작성자 이름 결정 (이메일 앞부분 또는 user.id)
      const author = user.email?.split('@')[0] || user.id.substring(0, 8);

      // 공지사항은 관리자만 작성 가능
      const isNotice = category === 'notice';
      if (isNotice && !isAdmin) {
        alert(lang === 'ko' ? '공지사항은 관리자만 작성할 수 있습니다.' : 'Only admins can create notice posts.');
        setIsSubmitting(false);
        return;
      }

      const supabaseClient = createClient();
      const { data, error } = await supabaseClient
        .from('posts')
        .insert({
          title: title.trim(),
          content: content.trim(),
          author: author,
          user_id: user.id,
          category: category,
          lang: currentLang,
          is_notice: isNotice,
        })
        .select()
        .single();

      if (error) throw error;

      router.push(`/${lang}/community/${data.id}`);
    } catch (error: any) {
      console.error('게시글 작성 오류:', error);
      alert(t.community.createPostFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
        <div className="mb-6">
          <Link href={`/${lang}/community`}>
            <button className="text-slate-400 hover:text-white transition-colors text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.community.backToList}
            </button>
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          {t.community.createPostTitle}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              {t.community.postTitle}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.community.postTitle}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={200}
              required
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              {t.community.postContent}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.community.postContent}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 h-64 resize-none"
              maxLength={5000}
              required
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {content.length} / 5000
            </div>
          </div>

          {/* 카테고리 선택 */}
          <div>
            <label className="block text-sm font-medium mb-3 text-slate-300">
              {t.community.selectCategoryLabel}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => {
                // 공지사항은 관리자만 선택 가능
                const isNotice = cat.id === 'notice';
                const isDisabled = isNotice && !isAdmin;
                
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      if (!isDisabled) {
                        setCategory(cat.id);
                      } else {
                        alert(lang === 'ko' ? '공지사항은 관리자만 작성할 수 있습니다.' : 'Only admins can create notice posts.');
                      }
                    }}
                    disabled={isDisabled}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      category === cat.id
                        ? `border-blue-500 bg-gradient-to-r ${cat.color} text-white`
                        : isDisabled
                        ? 'border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                    title={isDisabled ? (lang === 'ko' ? '관리자만 작성 가능' : 'Admin only') : ''}
                  >
                    <i className={`${cat.icon} text-2xl mb-2 block`}></i>
                    <span className="text-sm font-semibold">{cat.label}</span>
                    {isNotice && !isAdmin && (
                      <span className="text-xs text-slate-500 block mt-1">
                        {lang === 'ko' ? '(관리자 전용)' : '(Admin only)'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 제출 버튼 */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t.community.creating : t.community.submitPost}
            </button>
            <Link href={`/${lang}/community`}>
              <button
                type="button"
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all"
              >
                {t.common.cancel}
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

