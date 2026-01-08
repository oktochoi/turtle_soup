'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Problem } from '@/lib/types';

type SortOption = 'latest' | 'popular' | 'difficulty';

export default function ProblemsPage() {
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [filteredProblems, setFilteredProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 필터 상태
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('latest');

  const AVAILABLE_TAGS = ['공포', '추리', '개그', '역사', '과학', '일상', '판타지', '미스터리'];

  useEffect(() => {
    loadProblems();
  }, []);

  useEffect(() => {
    filterAndSortProblems();
  }, [problems, difficultyFilter, tagFilter, searchQuery, sortOption]);

  const loadProblems = async () => {
    try {
      const { data, error } = await supabase
        .from('problems')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProblems(data || []);
    } catch (error) {
      console.error('문제 로드 오류:', error);
      alert('문제를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortProblems = () => {
    let filtered = [...problems];

    // 난이도 필터
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(p => p.difficulty === difficultyFilter);
    }

    // 해시태그 필터
    if (tagFilter !== 'all') {
      filtered = filtered.filter(p => p.tags.includes(tagFilter));
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query)
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
        filtered.sort((a, b) => 
          (b.like_count + b.comment_count) - (a.like_count + a.comment_count)
        );
        break;
      case 'difficulty':
        const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
        filtered.sort((a, b) => 
          difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
        );
        break;
    }

    setFilteredProblems(filtered);
  };

  const getDifficultyBadge = (difficulty: string) => {
    const badges = {
      easy: { text: '쉬움', color: 'bg-green-500', emoji: '🟢' },
      medium: { text: '중간', color: 'bg-yellow-500', emoji: '🟡' },
      hard: { text: '어려움', color: 'bg-red-500', emoji: '🔴' },
    };
    return badges[difficulty as keyof typeof badges] || badges.medium;
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        {/* 헤더 */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              문제 목록
            </h1>
            <Link href="/create-problem">
              <button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-4 py-2 rounded-xl transition-all duration-200 whitespace-nowrap text-sm sm:text-base">
                <i className="ri-add-circle-line mr-2"></i>
                문제 만들기
              </button>
            </Link>
          </div>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 mb-6 border border-slate-700">
          <div className="space-y-4">
            {/* 검색 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">검색:</label>
              <input
                type="text"
                placeholder="제목 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>

            {/* 난이도 필터 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">난이도:</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDifficultyFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    difficultyFilter === 'all'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  모두
                </button>
                <button
                  onClick={() => setDifficultyFilter('easy')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    difficultyFilter === 'easy'
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  쉬움
                </button>
                <button
                  onClick={() => setDifficultyFilter('medium')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    difficultyFilter === 'medium'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  중간
                </button>
                <button
                  onClick={() => setDifficultyFilter('hard')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    difficultyFilter === 'hard'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  어려움
                </button>
              </div>
            </div>

            {/* 해시태그 필터 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">해시태그:</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTagFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    tagFilter === 'all'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  모두
                </button>
                {AVAILABLE_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tagFilter === tag ? 'all' : tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      tagFilter === tag
                        ? 'bg-teal-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 정렬 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">정렬:</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSortOption('latest')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    sortOption === 'latest'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  최신순
                </button>
                <button
                  onClick={() => setSortOption('popular')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    sortOption === 'popular'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  인기순
                </button>
                <button
                  onClick={() => setSortOption('difficulty')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    sortOption === 'difficulty'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  난이도순
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 문제 목록 */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
            <p className="text-slate-400">문제를 불러오는 중...</p>
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
            <i className="ri-inbox-line text-5xl text-slate-500 mb-4"></i>
            <p className="text-slate-400">문제가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredProblems.map(problem => {
              const difficultyBadge = getDifficultyBadge(problem.difficulty);
              return (
                <div
                  key={problem.id}
                  className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 hover:border-teal-500/50 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg sm:text-xl font-bold text-white flex-1 pr-2">
                      {problem.title}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${difficultyBadge.color} text-white whitespace-nowrap`}>
                      {difficultyBadge.text}
                    </span>
                  </div>

                  <p className="text-sm text-slate-300 mb-4 line-clamp-3">
                    {truncateText(problem.content, 100)}
                  </p>

                  {problem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {problem.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-teal-500/20 text-teal-400 rounded text-xs">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4 text-sm text-slate-400">
                    <span>작성자: {problem.author}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <i className="ri-heart-line"></i>
                        {problem.like_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="ri-chat-3-line"></i>
                        {problem.comment_count}
                      </span>
                    </div>
                  </div>

                  <Link href={`/problem/${problem.id}`}>
                    <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2 rounded-lg transition-all duration-200">
                      풀어보기
                    </button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* 결과 개수 */}
        {!isLoading && (
          <div className="mt-6 text-center text-sm text-slate-400">
            총 {filteredProblems.length}개의 문제
          </div>
        )}
      </div>
    </div>
  );
}

