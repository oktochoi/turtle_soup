'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';

type Category = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

const CATEGORIES: Category[] = [
  { id: 'daily', label: '오늘의 문제/데일리', icon: 'ri-calendar-check-line', color: 'from-yellow-500 to-orange-500' },
  { id: 'recommend', label: '문제 추천/공유', icon: 'ri-share-forward-line', color: 'from-green-500 to-emerald-500' },
  { id: 'free', label: '자유게시판', icon: 'ri-chat-3-line', color: 'from-blue-500 to-cyan-500' },
  { id: 'bug', label: '버그/개선', icon: 'ri-bug-line', color: 'from-purple-500 to-indigo-500' },
  { id: 'hall_of_fame', label: '명예의 전당', icon: 'ri-trophy-line', color: 'from-yellow-400 to-amber-500' },
  { id: 'funny', label: '웃긴 질문/드립', icon: 'ri-emotion-laugh-line', color: 'from-pink-500 to-rose-500' },
  { id: 'social', label: '친목', icon: 'ri-group-line', color: 'from-teal-500 to-cyan-500' },
];

export default function CreatePostPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('free');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">로그인이 필요합니다.</p>
          <Link href="/auth/login">
            <button className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg">
              로그인하기
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    if (!category) {
      alert('카테고리를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 작성자 이름 결정 (이메일 앞부분 또는 user.id)
      const author = user.email?.split('@')[0] || user.id.substring(0, 8);

      const { data, error } = await supabase
        .from('posts')
        .insert({
          title: title.trim(),
          content: content.trim(),
          author: author,
          user_id: user.id,
          category: category,
        })
        .select()
        .single();

      if (error) throw error;

      router.push(`/community/${data.id}`);
    } catch (error: any) {
      console.error('게시글 작성 오류:', error);
      alert('게시글 작성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
        <div className="mb-6">
          <Link href="/community">
            <button className="text-slate-400 hover:text-white transition-colors text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              목록으로
            </button>
          </Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          글 작성하기
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              카테고리
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    category === cat.id
                      ? `bg-gradient-to-r ${cat.color} text-white border-transparent`
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <i className={`${cat.icon} text-xl`}></i>
                    <span className="text-xs font-semibold">{cat.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={200}
              required
            />
            <p className="text-xs text-slate-500 mt-1">{title.length} / 200</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              내용
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 h-64 resize-none"
              maxLength={5000}
              required
            />
            <p className="text-xs text-slate-500 mt-1">{content.length} / 5000</p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  작성 중...
                </>
              ) : (
                <>
                  <i className="ri-check-line mr-2"></i>
                  작성하기
                </>
              )}
            </button>
            <Link href="/community">
              <button
                type="button"
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all font-semibold"
              >
                취소
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

