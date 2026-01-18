'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { GuessSet } from '@/lib/types/guess';

export default function GuessSetsPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';
  
  const [sets, setSets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSets();
  }, [lang]);

  const loadSets = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('guess_sets')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // 각 세트에 댓글 수 추가
      const setsWithCounts = await Promise.all(
        (data || []).map(async (set) => {
          const { count } = await supabase
            .from('guess_set_comments')
            .select('id', { count: 'exact', head: true })
            .eq('set_id', set.id);
          
          return {
            ...set,
            comment_count: count || 0,
          };
        })
      );
      
      setSets(setsWithCounts);
    } catch (error: any) {
      console.error('세트 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-6xl">
        {/* 헤더 */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <Link href={`/${lang}/play`}>
                <button className="text-slate-400 hover:text-white transition-colors text-sm">
                  <i className="ri-arrow-left-line mr-2 text-lg"></i>
                  {lang === 'ko' ? '게임 선택' : 'Select Game'}
                </button>
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  {lang === 'ko' ? '맞추기 게임' : 'Guess Games'}
                </h1>
                <p className="text-slate-400 text-sm mt-1">{lang === 'ko' ? '다양한 주제로 맞추기 게임을 즐겨보세요' : 'Enjoy guessing games with various topics'}</p>
              </div>
            </div>
            <Link href={`/${lang}/guess/create`}>
              <button className="w-full sm:w-auto bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 text-white font-semibold px-5 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-purple-500/20 flex items-center justify-center">
                <i className="ri-add-circle-line mr-2 text-lg"></i>
                {lang === 'ko' ? '새 게임 만들기' : 'Create New Game'}
              </button>
            </Link>
          </div>
        </div>

        {/* 게임 세트 목록 */}
        {sets.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
            <div className="text-4xl mb-4 text-slate-500">
              <i className="ri-image-search-line"></i>
            </div>
            <p className="text-slate-400 mb-4">{lang === 'ko' ? '아직 게임 세트가 없습니다.' : 'No game sets yet.'}</p>
            <Link href={`/${lang}/guess/create`}>
              <button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-4 py-2 rounded-lg transition-all">
                {lang === 'ko' ? '첫 게임 만들기' : 'Create First Game'}
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {sets.map((set) => (
              <Link key={set.id} href={`/${lang}/guess/${set.id}`}>
                <div className="group bg-slate-800/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 cursor-pointer h-full flex flex-col shadow-lg hover:shadow-purple-500/10 hover:scale-[1.02]">
                  {/* 커버 이미지 */}
                  {set.cover_image_url && (
                    <div className="w-full h-40 sm:h-48 mb-4 rounded-xl overflow-hidden relative">
                      <img
                        src={set.cover_image_url}
                        alt={set.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>
                    </div>
                  )}
                  
                  {/* 제목 및 설명 */}
                  <div className="flex-1 mb-4">
                    <h3 className="text-lg sm:text-xl font-bold mb-2 text-white line-clamp-2 group-hover:text-purple-300 transition-colors">
                      {set.title}
                    </h3>
                    {set.description && (
                      <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                        {set.description}
                      </p>
                    )}
                  </div>

                  {/* 통계 정보 */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                    {/* 별점 난이도 */}
                    <div className="flex items-center gap-1.5">
                      {set.average_rating > 0 ? (
                        <>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <i
                                key={star}
                                className={`text-sm ${
                                  star <= Math.round(set.average_rating || 0)
                                    ? 'ri-star-fill text-yellow-400'
                                    : 'ri-star-line text-slate-600'
                                }`}
                              ></i>
                            ))}
                          </div>
                          <span className="text-xs text-slate-400 ml-1">
                            {(set.average_rating || 0).toFixed(1)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <i className="ri-star-line"></i>
                          <span>{lang === 'ko' ? '평가 없음' : 'No rating'}</span>
                        </span>
                      )}
                    </div>

                    {/* 하트 및 댓글 */}
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <i className="ri-heart-fill text-red-400"></i>
                        <span>{set.like_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <i className="ri-chat-3-line text-cyan-400"></i>
                        <span>{set.comment_count || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

