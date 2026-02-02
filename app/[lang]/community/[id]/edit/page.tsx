'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import { supabase } from '@/lib/supabase';

type Category = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

type Post = {
  id: string;
  title: string;
  content: string;
  author: string;
  user_id: string | null;
  category: string;
  lang: string;
};

export default function EditPostPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const postId = resolvedParams.id;

  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations();

  const [post, setPost] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('free');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
    const loadPost = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('id', postId)
          .single();

        if (error) throw error;

        if (!data) {
          router.push(`/${lang}/community`);
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();

        const isAuthor = data.user_id === user.id;
        const admin = userData?.is_admin === true;

        if (!isAuthor && !admin) {
          alert(lang === 'ko' ? '수정 권한이 없습니다.' : 'You do not have permission to edit this post.');
          router.push(`/${lang}/community/${postId}`);
          return;
        }

        setPost(data);
        setTitle(data.title);
        setContent(data.content);
        setCategory(data.category);
        setIsAdmin(admin);
      } catch (error) {
        console.error('게시글 로드 오류:', error);
        router.push(`/${lang}/community`);
      } finally {
        setIsLoading(false);
      }
    };

    loadPost();
  }, [postId, user, lang, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post || !title.trim() || !content.trim()) return;

    const isNotice = category === 'notice';

    if (isNotice && !isAdmin) {
      alert(lang === 'ko' ? '공지사항은 관리자만 수정할 수 있습니다.' : 'Only admins can edit notice posts.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('posts')
        .update({
          title: title.trim(),
          content: content.trim(),
          category,
          is_notice: isNotice,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId);

      if (error) throw error;

      router.push(`/${lang}/community/${postId}`);
    } catch (error) {
      console.error('게시글 수정 오류:', error);
      alert(lang === 'ko' ? '수정에 실패했습니다.' : 'Failed to update post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl animate-spin text-teal-400"></i>
          <p className="mt-4 text-slate-400">
            {lang === 'ko' ? '로딩 중...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (!user || !post) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">

        <div className="mb-6">
          <Link href={`/${lang}/community/${postId}`}>
            <button className="text-slate-400 hover:text-white text-sm transition">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.community.backToList}
            </button>
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          {t.community.edit || (lang === 'ko' ? '게시글 수정' : 'Edit Post')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">

          <div>
            <label className="block mb-2 text-slate-300 text-sm">
              {t.community.postTitle}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
              maxLength={200}
              required
            />
          </div>

          <div>
            <label className="block mb-2 text-slate-300 text-sm">
              {t.community.postContent}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 h-64 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              maxLength={5000}
              required
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {content.length} / 5000
            </div>
          </div>

          <div>
            <label className="block mb-3 text-slate-300 text-sm">
              {t.community.selectCategoryLabel}
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => {
                const isNotice = cat.id === 'notice';
                const disabled = isNotice && !isAdmin;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setCategory(cat.id)}
                    className={`p-4 rounded-lg border-2 transition-all
                      ${
                        category === cat.id
                          ? `border-blue-500 bg-gradient-to-r ${cat.color} text-white`
                          : disabled
                          ? 'border-slate-800 bg-slate-900 text-slate-600 opacity-50 cursor-not-allowed'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                      }
                    `}
                  >
                    <i className={`${cat.icon} text-2xl mb-2 block`} />
                    <span className="text-sm font-semibold">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-4">

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition disabled:opacity-50"
            >
              {isSubmitting
                ? lang === 'ko' ? '수정 중...' : 'Saving...'
                : t.common.save || (lang === 'ko' ? '수정' : 'Save')}
            </button>

            <Link href={`/${lang}/community/${postId}`}>
              <button
                type="button"
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
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
