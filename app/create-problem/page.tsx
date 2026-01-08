'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const AVAILABLE_TAGS = ['공포', '추리', '개그', '역사', '과학', '일상', '판타지', '미스터리'];

export default function CreateProblem() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [answer, setAnswer] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [tags, setTags] = useState<string[]>([]);
  const [author, setAuthor] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    setTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !answer.trim() || !author.trim() || !adminPassword.trim()) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    if (!isSupabaseConfigured()) {
      alert('Supabase가 설정되지 않았습니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: problem, error } = await supabase
        .from('problems')
        .insert({
          title: title.trim(),
          content: content.trim(),
          answer: answer.trim(),
          difficulty,
          tags,
          author: author.trim(),
          admin_password: adminPassword.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      router.push(`/problem/${problem.id}`);
    } catch (error) {
      console.error('문제 생성 오류:', error);
      alert('문제 생성에 실패했습니다. 다시 시도해주세요.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-3xl">
        <div className="mb-4 sm:mb-6">
          <Link href="/">
            <button className="text-slate-400 hover:text-white transition-colors whitespace-nowrap text-sm sm:text-base">
              <i className="ri-arrow-left-line mr-2"></i>
              돌아가기
            </button>
          </Link>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            문제 만들기
          </h1>
        </div>

        <div className="space-y-5 sm:space-y-6">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="문제 제목을 입력하세요"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              maxLength={100}
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              내용
            </label>
            <p className="text-xs text-slate-400 mb-2">문제의 배경과 상황을 자세히 설명해주세요.</p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="문제의 배경과 상황을 자세히 설명해주세요."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-40 resize-none text-sm"
              maxLength={2000}
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {content.length} / 2000
            </div>
          </div>

          {/* 정답 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              정답
            </label>
            <p className="text-xs text-slate-400 mb-2">문제의 정답과 해설을 작성해주세요.</p>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="문제의 정답과 해설을 작성해주세요."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-40 resize-none text-sm"
              maxLength={2000}
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {answer.length} / 2000
            </div>
          </div>

          {/* 난이도 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              난이도
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDifficulty('easy')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  difficulty === 'easy'
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                쉬움
              </button>
              <button
                type="button"
                onClick={() => setDifficulty('medium')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  difficulty === 'medium'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                중간
              </button>
              <button
                type="button"
                onClick={() => setDifficulty('hard')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  difficulty === 'hard'
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                어려움
              </button>
            </div>
          </div>

          {/* 해시태그 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              해시태그
            </label>
            <p className="text-xs text-slate-400 mb-3">문제의 주제나 분야를 나타내는 해시태그를 추가해주세요.</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    tags.includes(tag)
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-teal-500/20 text-teal-400 rounded-lg text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 작성자 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              작성자
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="작성자 이름을 입력하세요"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              maxLength={50}
            />
          </div>

          {/* 관리 비밀번호 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              관리 비밀번호
            </label>
            <p className="text-xs text-slate-400 mb-2">문제를 나중에 수정하거나 삭제할 때 사용할 비밀번호를 입력하세요.</p>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="관리 비밀번호를 입력하세요"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 sm:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-teal-500/50 mt-6 sm:mt-8 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            <i className="ri-add-circle-line mr-2"></i>
            {isSubmitting ? '문제 생성 중...' : '문제 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}

