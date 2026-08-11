'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/hooks/useTranslations';
import { useAuth } from '@/lib/hooks/useAuth';

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

type FollowRanking = {
  user_id: string; // game_users.id (프로필 링크용)
  nickname: string;
  profile_image_url: string | null;
  follower_count: number;
};

export default function RankingPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const t = useTranslations();
  const { user } = useAuth();
  const [problemRanking, setProblemRanking] = useState<ProblemAuthorRanking[]>([]);
  const [solveRanking, setSolveRanking] = useState<ProblemSolveRanking[]>([]);
  const [followRanking, setFollowRanking] = useState<FollowRanking[]>([]);
  const [activeTab, setActiveTab] = useState<'hearts' | 'solves' | 'follows'>('hearts');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [myRank, setMyRank] = useState<{ rank: number; data: ProblemAuthorRanking | ProblemSolveRanking | null } | null>(null);
  const [myFollowRank, setMyFollowRank] = useState<{ rank: number; data: FollowRanking | null } | null>(null);
  const ITEMS_PER_PAGE = 10;

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
            
            // 자신의 등수 찾기
            if (user) {
              const myRankIndex = ranking.findIndex(item => item.user_id === user.id);
              if (myRankIndex !== -1) {
                setMyRank({ rank: myRankIndex + 1, data: ranking[myRankIndex] });
              } else {
                setMyRank(null);
              }
            }
          } else {
            setSolveRanking([]);
            setMyRank(null);
          }
        } else {
          setSolveRanking([]);
          setMyRank(null);
        }
      } catch (error) {
        console.error('문제 맞춘 수 랭킹 로드 오류:', error);
        setSolveRanking([]);
        setMyRank(null);
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
          
          // 자신의 등수 찾기
          if (user) {
            const myRankIndex = ranking.findIndex(item => item.user_id === user.id);
            if (myRankIndex !== -1) {
              setMyRank({ rank: myRankIndex + 1, data: ranking[myRankIndex] });
            } else {
              setMyRank(null);
            }
          }
        } else {
          // 문제 데이터가 없으면 빈 배열
          setProblemRanking([]);
          setMyRank(null);
        }
      } catch (error) {
        console.error('문제 랭킹 로드 오류:', error);
        setProblemRanking([]);
        setMyRank(null);
      }

      // 팔로워 수 랭킹 (game_user_follows에서 following_id별 개수 → game_users와 조인)
      try {
        const { data: followsData, error: followsError } = await supabase
          .from('game_user_follows')
          .select('following_id');

        if (followsError) {
          console.error('팔로워 랭킹 로드 오류:', followsError);
          setFollowRanking([]);
          setMyFollowRank(null);
        } else if (followsData && followsData.length > 0) {
          const countByFollowing = new Map<string, number>();
          followsData.forEach((row: { following_id: string }) => {
            const id = row.following_id;
            countByFollowing.set(id, (countByFollowing.get(id) || 0) + 1);
          });
          const sortedIds = Array.from(countByFollowing.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 100)
            .map(([id]) => id);

          if (sortedIds.length > 0) {
            const { data: gameUsersData, error: guError } = await supabase
              .from('game_users')
              .select('id, nickname, profile_image_url')
              .in('id', sortedIds);

            if (!guError && gameUsersData) {
              const userMap = new Map(gameUsersData.map(u => [u.id, u]));
              const ranking: FollowRanking[] = sortedIds
                .map(id => {
                  const u = userMap.get(id);
                  return u ? {
                    user_id: u.id,
                    nickname: u.nickname || '알 수 없음',
                    profile_image_url: u.profile_image_url || null,
                    follower_count: countByFollowing.get(id) || 0,
                  } : null;
                })
                .filter((r): r is FollowRanking => r !== null);
              setFollowRanking(ranking);

              if (user) {
                const { data: myGameUser } = await supabase
                  .from('game_users')
                  .select('id')
                  .eq('auth_user_id', user.id)
                  .maybeSingle();
                if (myGameUser) {
                  const idx = ranking.findIndex(r => r.user_id === myGameUser.id);
                  if (idx !== -1) {
                    setMyFollowRank({ rank: idx + 1, data: ranking[idx] });
                  } else {
                    setMyFollowRank(null);
                  }
                } else {
                  setMyFollowRank(null);
                }
              } else {
                setMyFollowRank(null);
              }
            } else {
              setFollowRanking([]);
              setMyFollowRank(null);
            }
          } else {
            setFollowRanking([]);
            setMyFollowRank(null);
          }
        } else {
          setFollowRanking([]);
          setMyFollowRank(null);
        }
      } catch (error) {
        console.error('팔로워 랭킹 로드 오류:', error);
        setFollowRanking([]);
        setMyFollowRank(null);
      }
    } catch (error) {
      console.error('랭킹 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 자신의 등수 찾기 (문제 맞춘 수)
  useEffect(() => {
    if (user && solveRanking.length > 0) {
      const myRankIndex = solveRanking.findIndex(item => item.user_id === user.id);
      if (myRankIndex !== -1) {
        setMyRank({ rank: myRankIndex + 1, data: solveRanking[myRankIndex] });
      } else {
        setMyRank(null);
      }
    } else if (!user) {
      setMyRank(null);
    }
  }, [user, solveRanking, activeTab]);

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
    return 'from-slate-800/50 to-slate-800/50 border-brass/20';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ink-800 via-ink-700 to-ink-800 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-fog">{t.ranking.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-800 via-ink-700 to-ink-800 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-4xl">
        <div className="mb-6">
          <Link href={`/${lang}`}>
            <button className="text-fog hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {t.ranking.title}
          </h1>
          <p className="text-fog text-sm sm:text-base">{t.ranking.description}</p>
        </div>

        {/* 탭 */}
        <div className="flex flex-wrap gap-2 mb-6 bg-ink-700/50 rounded-lg p-1 border border-brass/20">
          <button
            onClick={() => {
              setActiveTab('solves');
              setCurrentPage(1);
            }}
            className={`flex-1 min-w-0 py-2 px-3 sm:px-4 rounded-md transition-all font-medium text-sm sm:text-base ${
              activeTab === 'solves'
                ? 'bg-gradient-to-r from-brass to-brass-600 text-white shadow-lg'
                : 'text-fog hover:text-white'
            }`}
          >
            <i className="ri-checkbox-circle-line mr-1 sm:mr-2"></i>
            {t.ranking.problemSolves}
          </button>
          <button
            onClick={() => {
              setActiveTab('hearts');
              setCurrentPage(1);
            }}
            className={`flex-1 min-w-0 py-2 px-3 sm:px-4 rounded-md transition-all font-medium text-sm sm:text-base ${
              activeTab === 'hearts'
                ? 'bg-gradient-to-r from-brass to-brass-600 text-white shadow-lg'
                : 'text-fog hover:text-white'
            }`}
          >
            <i className="ri-heart-line mr-1 sm:mr-2"></i>
            {t.ranking.receivedHearts}
          </button>
          <button
            onClick={() => {
              setActiveTab('follows');
              setCurrentPage(1);
            }}
            className={`flex-1 min-w-0 py-2 px-3 sm:px-4 rounded-md transition-all font-medium text-sm sm:text-base ${
              activeTab === 'follows'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                : 'text-fog hover:text-white'
            }`}
          >
            <i className="ri-user-follow-line mr-1 sm:mr-2"></i>
            {t.ranking.mostFollowers}
          </button>
        </div>

        {/* 문제 맞춘 수 랭킹 */}
        {activeTab === 'solves' && (
          <div className="space-y-3">
            {/* 자신의 등수 표시 */}
            {myRank && myRank.data && 'solve_count' in myRank.data && (
              <div className="bg-gradient-to-r from-brass/20 to-brass-600/20 rounded-xl p-4 border border-brass/50 backdrop-blur-sm mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-white min-w-[3rem] text-center">
                      {getRankIcon(myRank.rank)}
                    </span>
                    <div>
                      <p className="text-lg font-semibold text-white flex items-center gap-2">
                        {(myRank.data as ProblemSolveRanking).nickname || (myRank.data as ProblemSolveRanking).user_id.substring(0, 8)}
                        <span className="text-xs bg-brass/30 text-brass-300 px-2 py-0.5 rounded">나</span>
                      </p>
                      <p className="text-sm text-fog">
                        {(myRank.data as ProblemSolveRanking).solve_count} {t.ranking.problems}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {solveRanking.length === 0 ? (
              <div className="text-center py-12 bg-ink-700/50 rounded-xl border border-brass/20">
                <i className="ri-inbox-line text-4xl text-slate-600 mb-4"></i>
                <p className="text-fog">{t.ranking.noSolves}</p>
              </div>
            ) : (
              <>
                {solveRanking
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((userItem, index) => {
                    const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
                    const rank = globalIndex + 1;
                    const isMyRank = user && userItem.user_id === user.id;
                    
                    return (
                      <div
                        key={userItem.user_id}
                        className={`bg-gradient-to-r ${getRankColor(rank)} rounded-xl p-4 border backdrop-blur-sm ${isMyRank ? 'ring-2 ring-teal-500/50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold text-white min-w-[3rem] text-center">
                              {getRankIcon(rank)}
                            </span>
                            <div>
                              <p className="text-lg font-semibold text-white">
                                {userItem.nickname || userItem.user_id.substring(0, 8)}
                              </p>
                              <p className="text-sm text-fog">
                                {userItem.solve_count} {t.ranking.problems}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                
                {/* 페이지네이션 */}
                {solveRanking.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-ink-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-600 transition-all"
                    >
                      <i className="ri-arrow-left-line"></i>
                    </button>
                    <span className="text-fog px-4">
                      {currentPage} / {Math.ceil(solveRanking.length / ITEMS_PER_PAGE)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(solveRanking.length / ITEMS_PER_PAGE), prev + 1))}
                      disabled={currentPage >= Math.ceil(solveRanking.length / ITEMS_PER_PAGE)}
                      className="px-4 py-2 bg-ink-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-600 transition-all"
                    >
                      <i className="ri-arrow-right-line"></i>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 받은 하트 랭킹 */}
        {activeTab === 'hearts' && (
          <div className="space-y-3">
            {/* 자신의 등수 표시 */}
            {myRank && myRank.data && 'total_likes' in myRank.data && (
              <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/50 backdrop-blur-sm mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-white min-w-[3rem] text-center">
                      {getRankIcon(myRank.rank)}
                    </span>
                    <div>
                      <p className="text-lg font-semibold text-white flex items-center gap-2">
                        {(myRank.data as ProblemAuthorRanking).author}
                        <span className="text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded">나</span>
                      </p>
                      <p className="text-sm text-fog">
                        <i className="ri-heart-fill text-red-400 mr-1"></i>
                        {(myRank.data as ProblemAuthorRanking).total_likes} {t.ranking.hearts} · {(myRank.data as ProblemAuthorRanking).problem_count} {t.ranking.problems}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {problemRanking.length === 0 ? (
              <div className="text-center py-12 bg-ink-700/50 rounded-xl border border-brass/20">
                <i className="ri-inbox-line text-4xl text-slate-600 mb-4"></i>
                <p className="text-fog">{t.ranking.noHearts}</p>
              </div>
            ) : (
              <>
                {problemRanking
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((author, index) => {
                    const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
                    const rank = globalIndex + 1;
                    const isMyRank = user && author.user_id === user.id;
                    
                    return (
                      <div
                        key={author.user_id || `author_${author.author}`}
                        className={`bg-gradient-to-r ${getRankColor(rank)} rounded-xl p-4 border backdrop-blur-sm ${isMyRank ? 'ring-2 ring-purple-500/50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold text-white min-w-[3rem] text-center">
                              {getRankIcon(rank)}
                            </span>
                            <div>
                              <p className="text-lg font-semibold text-white">{author.author}</p>
                              <p className="text-sm text-fog">
                                <i className="ri-heart-fill text-red-400 mr-1"></i>
                                {author.total_likes} {t.ranking.hearts} · {author.problem_count} {t.ranking.problems}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                
                {/* 페이지네이션 */}
                {problemRanking.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-ink-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-600 transition-all"
                    >
                      <i className="ri-arrow-left-line"></i>
                    </button>
                    <span className="text-fog px-4">
                      {currentPage} / {Math.ceil(problemRanking.length / ITEMS_PER_PAGE)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(problemRanking.length / ITEMS_PER_PAGE), prev + 1))}
                      disabled={currentPage >= Math.ceil(problemRanking.length / ITEMS_PER_PAGE)}
                      className="px-4 py-2 bg-ink-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-600 transition-all"
                    >
                      <i className="ri-arrow-right-line"></i>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 팔로워 수 랭킹 */}
        {activeTab === 'follows' && (
          <div className="space-y-3">
            {myFollowRank && myFollowRank.data && (
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl p-4 border border-amber-500/50 backdrop-blur-sm mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-white min-w-[3rem] text-center">
                      {getRankIcon(myFollowRank.rank)}
                    </span>
                    <Link href={`/${lang}/profile/${myFollowRank.data.user_id}`} className="flex items-center gap-3 hover:opacity-90">
                      {myFollowRank.data.profile_image_url ? (
                        <img src={myFollowRank.data.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover bg-ink-600" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold">
                          {myFollowRank.data.nickname.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-lg font-semibold text-white flex items-center gap-2">
                          {myFollowRank.data.nickname}
                          <span className="text-xs bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded">나</span>
                        </p>
                        <p className="text-sm text-fog">
                          <i className="ri-user-follow-line mr-1"></i>
                          {myFollowRank.data.follower_count} {t.ranking.followers}
                        </p>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            )}
            {followRanking.length === 0 ? (
              <div className="text-center py-12 bg-ink-700/50 rounded-xl border border-brass/20">
                <i className="ri-user-follow-line text-4xl text-slate-600 mb-4"></i>
                <p className="text-fog">{t.ranking.noFollowers}</p>
              </div>
            ) : (
              <>
                {followRanking
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((item, index) => {
                    const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
                    const rank = globalIndex + 1;
                    const isMyRank = myFollowRank?.data?.user_id === item.user_id;
                    return (
                      <Link
                        key={item.user_id}
                        href={`/${lang}/profile/${item.user_id}`}
                        className={`block bg-gradient-to-r ${getRankColor(rank)} rounded-xl p-4 border backdrop-blur-sm hover:opacity-95 transition-opacity ${isMyRank ? 'ring-2 ring-amber-500/50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold text-white min-w-[3rem] text-center">
                              {getRankIcon(rank)}
                            </span>
                            {item.profile_image_url ? (
                              <img src={item.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover bg-ink-600" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold">
                                {item.nickname.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-lg font-semibold text-white">{item.nickname}</p>
                              <p className="text-sm text-fog">
                                <i className="ri-user-follow-line mr-1"></i>
                                {item.follower_count} {t.ranking.followers}
                              </p>
                            </div>
                          </div>
                          <i className="ri-arrow-right-s-line text-fog text-xl"></i>
                        </div>
                      </Link>
                    );
                  })}
                {followRanking.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-ink-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-600 transition-all"
                    >
                      <i className="ri-arrow-left-line"></i>
                    </button>
                    <span className="text-fog px-4">
                      {currentPage} / {Math.ceil(followRanking.length / ITEMS_PER_PAGE)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(followRanking.length / ITEMS_PER_PAGE), prev + 1))}
                      disabled={currentPage >= Math.ceil(followRanking.length / ITEMS_PER_PAGE)}
                      className="px-4 py-2 bg-ink-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-600 transition-all"
                    >
                      <i className="ri-arrow-right-line"></i>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

