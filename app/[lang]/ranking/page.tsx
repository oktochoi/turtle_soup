'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/hooks/useTranslations';

type ProblemAuthorRanking = {
  user_id: string | null;
  author: string;
  total_likes: number;
  problem_count: number;
};

type ProblemSolveRanking = {
  user_id: string;
  email: string | null;
  nickname: string | null;
  solve_count: number;
};

export default function RankingPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const t = useTranslations();
  const [problemRanking, setProblemRanking] = useState<ProblemAuthorRanking[]>([]);
  const [solveRanking, setSolveRanking] = useState<ProblemSolveRanking[]>([]);
  const [activeTab, setActiveTab] = useState<'hearts' | 'solves'>('hearts');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRankings();
  }, []);

  const loadRankings = async () => {
    setIsLoading(true);
    try {
      // 문제 맞춘 수 랭킹
      try {
        // 뷰를 사용하여 사용자별 정답 수 가져오기
        const { data: solveCountsData, error: solveCountsError } = await supabase
          .from('user_problem_solve_counts')
          .select('*')
          .order('solve_count', { ascending: false })
          .limit(100);

        if (solveCountsError && (solveCountsError.message || solveCountsError.code || solveCountsError.details)) {
          console.error('문제 맞춘 수 랭킹 로드 오류:', {
            message: solveCountsError.message,
            code: solveCountsError.code,
            details: solveCountsError.details,
          });
          // 뷰가 작동하지 않으면 직접 집계
          const { data: solvesData, error: solvesError } = await supabase
            .from('user_problem_solves')
            .select('user_id')
            .order('solved_at', { ascending: false });

          if (solvesError) {
            console.error('직접 집계 오류:', solvesError);
            setSolveRanking([]);
          } else {
            // user_id별로 집계
            const solveCountMap = new Map<string, number>();
            solvesData?.forEach(solve => {
              if (solve.user_id) {
                solveCountMap.set(solve.user_id, (solveCountMap.get(solve.user_id) || 0) + 1);
              }
            });

            const userIds = Array.from(solveCountMap.keys());
            
            if (userIds.length > 0) {
              // 각 사용자가 만든 문제의 author 필드 가져오기
              const { data: problemsData } = await supabase
                .from('problems')
                .select('user_id, author')
                .in('user_id', userIds);
              
              // user_id별로 가장 최근 author 값 사용 (같은 사용자가 여러 문제를 만들었을 수 있음)
              const userNicknameMap = new Map<string, string>();
              if (problemsData) {
                problemsData.forEach(problem => {
                  if (problem.user_id && problem.author && !userNicknameMap.has(problem.user_id)) {
                    userNicknameMap.set(problem.user_id, problem.author);
                  }
                });
              }
              
              const ranking: ProblemSolveRanking[] = Array.from(solveCountMap.entries())
                .map(([user_id, solve_count]) => ({
                  user_id,
                  email: null,
                  nickname: userNicknameMap.get(user_id) || null,
                  solve_count,
                }))
                .sort((a, b) => b.solve_count - a.solve_count);

              setSolveRanking(ranking);
            } else {
              setSolveRanking([]);
            }
          }
        } else if (solveCountsData) {
          const userIds = solveCountsData
            .filter(item => item.solve_count > 0)
            .map(item => item.user_id);
          
          if (userIds.length > 0) {
            // 각 사용자가 만든 문제의 author 필드 가져오기
            const { data: problemsData } = await supabase
              .from('problems')
              .select('user_id, author')
              .in('user_id', userIds);
            
            // user_id별로 가장 최근 author 값 사용 (같은 사용자가 여러 문제를 만들었을 수 있음)
            const userNicknameMap = new Map<string, string>();
            if (problemsData) {
              problemsData.forEach(problem => {
                if (problem.user_id && problem.author && !userNicknameMap.has(problem.user_id)) {
                  userNicknameMap.set(problem.user_id, problem.author);
                }
              });
            }
            
            const ranking: ProblemSolveRanking[] = solveCountsData
              .filter(item => item.solve_count > 0)
              .map(item => ({
                user_id: item.user_id,
                email: item.email,
                nickname: userNicknameMap.get(item.user_id) || null,
                solve_count: item.solve_count,
              }))
              .sort((a, b) => b.solve_count - a.solve_count);

            setSolveRanking(ranking);
          } else {
            setSolveRanking([]);
          }
        } else {
          setSolveRanking([]);
        }
      } catch (error) {
        console.error('문제 맞춘 수 랭킹 로드 오류:', error);
        setSolveRanking([]);
      }

      // 문제 좋아요 랭킹 - 유저가 만든 모든 문제의 하트를 합산
      try {
        // 모든 문제 데이터 가져오기 (like_count 포함, user_id가 null이어도 포함)
        const { data: problemsData, error: problemsError } = await supabase
          .from('problems')
          .select('id, user_id, author, like_count');

        // 실제 오류가 있는 경우에만 처리
        if (problemsError && (problemsError.message || problemsError.code || problemsError.details)) {
          console.error('문제 데이터 로드 오류:', {
            message: problemsError.message,
            code: problemsError.code,
            details: problemsError.details,
            hint: problemsError.hint
          });
          setProblemRanking([]);
          return;
        }

        // 작성자별 집계 (user_id가 있으면 user_id로, 없으면 author로)
        const authorMap = new Map<string, { likes: number; problems: number; author: string }>();
        
        if (problemsData && problemsData.length > 0) {
          problemsData.forEach((problem) => {
            // problems 테이블의 like_count를 직접 사용 (트리거로 자동 업데이트됨)
            const likes = problem.like_count || 0;
            
            // user_id가 있으면 user_id를 키로, 없으면 author를 키로 사용
            const key = problem.user_id || `author_${problem.author}`;
            const existing = authorMap.get(key);
            
            if (existing) {
              existing.likes += likes; // 좋아요 합산
              existing.problems += 1; // 문제 개수 증가
            } else {
              authorMap.set(key, { 
                likes, // 이 문제의 좋아요 수
                problems: 1, 
                author: problem.author || '알 수 없음' 
              });
            }
          });

          const ranking = Array.from(authorMap.entries())
            .map(([key, data]) => ({
              user_id: key.startsWith('author_') ? null : key,
              author: data.author,
              total_likes: data.likes, // 모든 문제의 하트 합산
              problem_count: data.problems,
            }))
            .filter(item => item.total_likes > 0) // 하트가 1개 이상인 유저만 표시
            .sort((a, b) => {
              if (b.total_likes !== a.total_likes) {
                return b.total_likes - a.total_likes;
              }
              return b.problem_count - a.problem_count;
            })
            .slice(0, 100);

          setProblemRanking(ranking);
        } else {
          // 문제 데이터가 없으면 빈 배열
          setProblemRanking([]);
        }
      } catch (error) {
        console.error('문제 랭킹 로드 오류:', error);
        setProblemRanking([]);
      }
    } catch (error) {
      console.error('랭킹 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/50';
    if (rank === 2) return 'from-slate-400/20 to-slate-500/20 border-slate-400/50';
    if (rank === 3) return 'from-orange-600/20 to-orange-700/20 border-orange-600/50';
    return 'from-slate-800/50 to-slate-800/50 border-slate-700';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{t.ranking.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-4xl">
        <div className="mb-6">
          <Link href={`/${lang}`}>
            <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {t.ranking.title}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">{t.ranking.description}</p>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-6 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setActiveTab('solves')}
            className={`flex-1 py-2 px-4 rounded-md transition-all font-medium ${
              activeTab === 'solves'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <i className="ri-checkbox-circle-line mr-2"></i>
            {t.ranking.problemSolves}
          </button>
          <button
            onClick={() => setActiveTab('hearts')}
            className={`flex-1 py-2 px-4 rounded-md transition-all font-medium ${
              activeTab === 'hearts'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <i className="ri-heart-line mr-2"></i>
            {t.ranking.receivedHearts}
          </button>
        </div>

        {/* 문제 맞춘 수 랭킹 */}
        {activeTab === 'solves' && (
          <div className="space-y-3">
            {solveRanking.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
                <i className="ri-inbox-line text-4xl text-slate-600 mb-4"></i>
                <p className="text-slate-400">{t.ranking.noSolves}</p>
              </div>
            ) : (
              solveRanking.map((user, index) => {
                const rank = index + 1;
                return (
                  <div
                    key={user.user_id}
                    className={`bg-gradient-to-r ${getRankColor(rank)} rounded-xl p-4 border backdrop-blur-sm`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-white min-w-[3rem] text-center">
                          {getRankIcon(rank)}
                        </span>
                        <div>
                          <p className="text-lg font-semibold text-white">
                            {user.nickname || user.email?.split('@')[0] || user.user_id.substring(0, 8)}
                          </p>
                          <p className="text-sm text-slate-400">
                            {user.solve_count} {t.ranking.problems}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 받은 하트 랭킹 */}
        {activeTab === 'hearts' && (
          <div className="space-y-3">
            {problemRanking.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
                <i className="ri-inbox-line text-4xl text-slate-600 mb-4"></i>
                <p className="text-slate-400">{t.ranking.noHearts}</p>
              </div>
            ) : (
              problemRanking.map((author, index) => {
                const rank = index + 1;
                return (
                  <div
                    key={author.user_id || `author_${author.author}`}
                    className={`bg-gradient-to-r ${getRankColor(rank)} rounded-xl p-4 border backdrop-blur-sm`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-white min-w-[3rem] text-center">
                          {getRankIcon(rank)}
                        </span>
                        <div>
                          <p className="text-lg font-semibold text-white">{author.author}</p>
                          <p className="text-sm text-slate-400">
                            <i className="ri-heart-fill text-red-400 mr-1"></i>
                            {author.total_likes} {t.ranking.hearts} · {author.problem_count} {t.ranking.problems}
                          </p>
                        </div>
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

