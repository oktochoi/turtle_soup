'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { GuessSet, GuessCard } from '@/lib/types/guess';

export default function GuessSetDetailPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';
  const setId = params?.setId as string;
  const router = useRouter();
  const { user } = useAuth();
  
  const [guessSet, setGuessSet] = useState<GuessSet | null>(null);
  const [cards, setCards] = useState<GuessCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPlayModal, setShowPlayModal] = useState(false);
  
  // 플레이 설정
  const [playCount, setPlayCount] = useState<number | 'all'>(10);
  const [timePerCard, setTimePerCard] = useState<number | null>(30); // null = 무제한
  
  // 별점 및 좋아요
  const [averageRating, setAverageRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  
  // 댓글
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [userNickname, setUserNickname] = useState<string | null>(null);
  const [customTimeInput, setCustomTimeInput] = useState<string>('');
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const commentImageInputRef = useRef<HTMLInputElement | null>(null);
  const [showCardShareModal, setShowCardShareModal] = useState<string | null>(null);
  const [showSetShareModal, setShowSetShareModal] = useState(false);
  const [creatorInfo, setCreatorInfo] = useState<{id: string; nickname: string; profile_image_url: string | null} | null>(null);

  useEffect(() => {
    if (setId) {
      loadSet();
    }
  }, [setId, user]);

  const loadSet = async () => {
    if (!setId) return;
    
    try {
      const supabase = createClient();
      
      // 세트 정보 로드
      const { data: setData, error: setError } = await supabase
        .from('guess_sets')
        .select('*')
        .eq('id', setId)
        .single();

      if (setError) throw setError;
      if (!setData) throw new Error('세트를 찾을 수 없습니다.');

      setGuessSet(setData);
      setIsCreator(user?.id === setData.creator_id);

      // 작성자 정보 가져오기
      if (setData.creator_id) {
        const { data: creator } = await supabase
          .from('game_users')
          .select('id, nickname, profile_image_url')
          .eq('id', setData.creator_id)
          .maybeSingle();
        
        if (creator) {
          setCreatorInfo(creator);
        }
      }

      // 관리자 확인 및 사용자 닉네임 가져오기
      if (user) {
        const { data: gameUser } = await supabase
          .from('game_users')
          .select('is_admin, nickname')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        
        setIsAdmin(gameUser?.is_admin || false);
        if (gameUser) {
          const { data: gameUserById } = await supabase
            .from('game_users')
            .select('nickname')
            .eq('id', user.id)
            .maybeSingle();
          setUserNickname(gameUserById?.nickname || gameUser.nickname || null);
        }
      }

      // 카드 로드
      const { data: guessCards, error: cardsError } = await supabase
        .from('guess_cards')
        .select('*')
        .eq('set_id', setId)
        .order('order_index', { ascending: true });

      if (cardsError) throw cardsError;
      setCards(guessCards || []);
      
      // 별점 및 좋아요 로드
      await loadRatingAndLikes();
      
      // 댓글 로드
      await loadComments();
    } catch (error: any) {
      console.error('세트 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 조회수 증가 (세트 로드 후 한 번만 실행)
  useEffect(() => {
    if (guessSet?.id && !isLoading) {
      const updateViewCount = async () => {
        try {
          const supabase = createClient();
          const { data: currentSet } = await supabase
            .from('guess_sets')
            .select('view_count')
            .eq('id', guessSet.id)
            .single();
          
          if (currentSet) {
            const { data: updatedSet, error } = await supabase
              .from('guess_sets')
              .update({ view_count: (currentSet.view_count || 0) + 1 })
              .eq('id', guessSet.id)
              .select()
              .single();
            
            if (error) throw error;
            
            // 조회수 업데이트 후 세트 데이터 갱신
            if (updatedSet) {
              setGuessSet(updatedSet);
            }
          }
        } catch (error) {
          // 에러는 무시 (조회수 증가 실패는 치명적이지 않음)
          console.warn('조회수 증가 실패:', error);
        }
      };
      updateViewCount();
    }
  }, [guessSet?.id, isLoading]); // 세트 ID가 로드될 때 한 번만 실행

  const loadRatingAndLikes = async () => {
    if (!setId || !user) return;
    
    try {
      const supabase = createClient();
      
      // 평균 별점 및 개수
      const set = await supabase
        .from('guess_sets')
        .select('average_rating, rating_count, like_count')
        .eq('id', setId)
        .single();
      
      if (set.data) {
        setAverageRating(set.data.average_rating || 0);
        setRatingCount(set.data.rating_count || 0);
        setLikeCount(set.data.like_count || 0);
      }
      
      // 사용자 별점
      if (user) {
        const { data: userRatingData } = await supabase
          .from('guess_set_ratings')
          .select('rating')
          .eq('set_id', setId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        setUserRating(userRatingData?.rating || null);
        
        // 사용자 좋아요
        const { data: likeData } = await supabase
          .from('guess_set_likes')
          .select('id')
          .eq('set_id', setId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        setIsLiked(!!likeData);
      }
    } catch (error: any) {
      console.error('별점/좋아요 로드 오류:', error);
    }
  };

  const loadComments = async () => {
    if (!setId) return;
    
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('guess_set_comments')
        .select('*')
        .eq('set_id', setId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // 각 댓글에 사용자 정보 추가
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        
        // users와 game_users에서 정보 가져오기
        const { data: usersData } = await supabase
          .from('users')
          .select('id, nickname')
          .in('id', userIds);
        
        const { data: gameUsersData } = await supabase
          .from('game_users')
          .select('auth_user_id, nickname, profile_image_url')
          .in('auth_user_id', userIds);
        
        const usersMap = new Map(usersData?.map(u => [u.id, u.nickname]) || []);
        const gameUsersMap = new Map(gameUsersData?.map(gu => [gu.auth_user_id, { nickname: gu.nickname, profile_image_url: gu.profile_image_url }]) || []);
        
        const commentsWithUsers = data.map(comment => {
          const gameUser = gameUsersMap.get(comment.user_id);
          return {
            ...comment,
            user_nickname: gameUser?.nickname || usersMap.get(comment.user_id) || 'User',
            user_profile_image: gameUser?.profile_image_url || null
          };
        });
        setComments(commentsWithUsers);
      } else {
        setComments([]);
      }
    } catch (error: any) {
      console.error('댓글 로드 오류:', error);
    }
  };

  const handleRatingClick = async (rating: number) => {
    if (!user) {
      alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
      router.push(`/${lang}/auth/login`);
      return;
    }

    if (!setId) return;

    try {
      const supabase = createClient();
      
      const { data: existing } = await supabase
        .from('guess_set_ratings')
        .select('id')
        .eq('set_id', setId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('guess_set_ratings')
          .update({ rating, updated_at: new Date().toISOString() })
          .eq('set_id', setId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('guess_set_ratings')
          .insert({
            set_id: setId,
            user_id: user.id,
            rating,
          });
        if (error) throw error;
      }

      setUserRating(rating);
      await loadRatingAndLikes();
    } catch (error: any) {
      console.error('별점 투표 오류:', error);
      alert(lang === 'ko' ? `별점 투표 실패: ${error?.message}` : `Rating failed: ${error?.message}`);
    }
  };

  const handleLikeToggle = async () => {
    if (!user) {
      alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
      router.push(`/${lang}/auth/login`);
      return;
    }

    if (!setId) return;

    try {
      const supabase = createClient();
      
      if (isLiked) {
        const { error } = await supabase
          .from('guess_set_likes')
          .delete()
          .eq('set_id', setId)
          .eq('user_id', user.id);
        if (error) throw error;
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase
          .from('guess_set_likes')
          .insert({
            set_id: setId,
            user_id: user.id,
          });
        if (error) throw error;
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }
      
      await loadRatingAndLikes();
    } catch (error: any) {
      console.error('좋아요 토글 오류:', error);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    
    setIsUploadingImage(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `comment-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      setCommentImage(data.publicUrl);
    } catch (error: any) {
      console.error('이미지 업로드 오류:', error);
      alert(lang === 'ko' ? `이미지 업로드 실패: ${error?.message}` : `Image upload failed: ${error?.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleEditRequest = async (cardId: string, currentQuestion: string, currentAnswer: string) => {
    if (!user) {
      alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Please log in.');
      return;
    }

    if (!guessSet || !guessSet.creator_id) {
      alert(lang === 'ko' ? '작성자를 찾을 수 없습니다.' : 'Creator not found.');
      return;
    }

    const requestMessage = prompt(
      lang === 'ko' 
        ? `수정 요청 내용을 입력하세요:\n\n현재 질문: ${currentQuestion}\n현재 정답: ${currentAnswer}`
        : `Enter your edit request:\n\nCurrent Question: ${currentQuestion}\nCurrent Answer: ${currentAnswer}`
    );

    if (!requestMessage || !requestMessage.trim()) {
      return;
    }

    try {
      const supabase = createClient();
      
      // 알림 생성
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: guessSet.creator_id,
          type: 'edit_request',
          title: lang === 'ko' ? '수정 요청' : 'Edit Request',
          message: `${lang === 'ko' ? '카드 수정 요청' : 'Card Edit Request'}: ${requestMessage}`,
          link: `/${lang}/guess/${setId}?card=${cardId}`,
          is_read: false,
        });

      if (notificationError) {
        console.error('알림 생성 오류:', notificationError);
        alert(lang === 'ko' ? `알림 전송 실패: ${notificationError.message}` : `Notification failed: ${notificationError.message}`);
        return;
      }

      alert(lang === 'ko' ? '수정 요청이 전송되었습니다.' : 'Edit request sent.');
    } catch (error: any) {
      console.error('수정 요청 오류:', error);
      alert(lang === 'ko' ? `수정 요청 실패: ${error?.message}` : `Failed to send edit request: ${error?.message}`);
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !setId || (!newComment.trim() && !commentImage)) return;

    setIsSubmittingComment(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('guess_set_comments')
        .insert({
          set_id: setId,
          user_id: user.id,
          content: newComment.trim() || '',
          image_url: commentImage,
        });

      if (error) throw error;
      setNewComment('');
      setCommentImage(null);
      await loadComments();
    } catch (error: any) {
      console.error('댓글 작성 오류:', error);
      alert(lang === 'ko' ? `댓글 작성 실패: ${error?.message}` : `Comment failed: ${error?.message}`);
    } finally {
      setIsSubmittingComment(false);
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

  if (!guessSet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{lang === 'ko' ? '세트를 찾을 수 없습니다.' : 'Set not found.'}</p>
          <Link href={`/${lang}/guess`}>
            <button className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg">
              {lang === 'ko' ? '목록으로' : 'Back to List'}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-4xl">
        <div className="mb-4 sm:mb-6">
          <Link href={`/${lang}/guess`}>
            <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {lang === 'ko' ? '목록으로' : 'Back to List'}
            </button>
          </Link>
        </div>

        {/* 세트 헤더 */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mb-6">
          {guessSet.cover_image_url && (
            <div className="w-full h-48 sm:h-64 mb-4 rounded-lg overflow-hidden">
              <img
                src={guessSet.cover_image_url}
                alt={guessSet.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-white">
            {guessSet.title}
          </h1>
          {guessSet.description && (
            <p className="text-slate-300 mb-4">{guessSet.description}</p>
          )}
          
          {/* 작성자 정보 */}
          {creatorInfo && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-slate-400">{lang === 'ko' ? '작성자' : 'Creator'}:</span>
              <Link href={`/${lang}/profile/${creatorInfo.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                {creatorInfo.profile_image_url ? (
                  <img
                    src={creatorInfo.profile_image_url}
                    alt={creatorInfo.nickname}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs">
                    {creatorInfo.nickname.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold text-teal-400">{creatorInfo.nickname}</span>
              </Link>
            </div>
          )}

          {/* 공유 버튼 */}
          <div className="mb-3">
            <button
              onClick={() => setShowSetShareModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
            >
              <i className="ri-share-line"></i>
              <span>{lang === 'ko' ? '공유하기' : 'Share'}</span>
            </button>
          </div>

          {/* 조회수 */}
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
            <i className="ri-eye-line"></i>
            <span>{lang === 'ko' ? '조회수' : 'Views'}: {(guessSet as any)?.view_count || 0}</span>
          </div>
          
          <div className="flex items-center flex-wrap gap-4 text-sm">
            <span className="text-slate-400">
              <i className="ri-file-list-line mr-1"></i>
              {cards.length} {lang === 'ko' ? '개 카드' : 'cards'}
            </span>
            
            {/* 별점 표시 */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRatingClick(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className={`text-lg transition-colors ${
                      (hoverRating !== null ? star <= hoverRating : star <= Math.round(averageRating))
                        ? 'text-yellow-400'
                        : 'text-slate-500'
                    }`}
                  >
                    <i className={star <= (userRating || 0) ? 'ri-star-fill' : 'ri-star-line'}></i>
                  </button>
                ))}
              </div>
              {averageRating > 0 && (
                <span className="text-slate-300 text-xs">
                  {averageRating.toFixed(1)} ({ratingCount})
                </span>
              )}
            </div>
            
            {/* 좋아요 */}
            <button
              onClick={handleLikeToggle}
              className={`flex items-center gap-1 transition-colors ${
                isLiked ? 'text-red-400' : 'text-slate-400 hover:text-red-400'
              }`}
            >
              <i className={isLiked ? 'ri-heart-fill' : 'ri-heart-line'}></i>
              <span>{likeCount}</span>
            </button>
          </div>

          {/* 작성자/관리자 액션 */}
          {(isCreator || isAdmin) && (
            <div className="mt-4 flex gap-3">
              <Link href={`/${lang}/guess/${setId}/edit`}>
                <button className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                  <i className="ri-edit-line mr-2"></i>
                  {lang === 'ko' ? '편집하기' : 'Edit'}
                </button>
              </Link>
              <button
                onClick={async () => {
                  if (!confirm(lang === 'ko' ? '이 세트를 삭제하시겠습니까?' : 'Delete this set?')) {
                    return;
                  }
                  try {
                    const supabase = createClient();
                    const { error } = await supabase
                      .from('guess_sets')
                      .delete()
                      .eq('id', setId);
                    
                    if (error) throw error;
                    router.push(`/${lang}/guess`);
                  } catch (error: any) {
                    alert(lang === 'ko' ? `삭제 실패: ${error?.message}` : `Delete failed: ${error?.message}`);
                  }
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <i className="ri-delete-bin-line mr-2"></i>
                {lang === 'ko' ? '삭제하기' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        {/* 플레이 버튼 */}
        <div className="mb-6">
          {cards.length < 10 && (
            <div className="mb-3 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm">
              <i className="ri-alert-line mr-2"></i>
              {lang === 'ko' ? '카드가 10개 이상이어야 게임을 시작할 수 있습니다. (현재: ' : 'You need at least 10 cards to start the game. (Current: '}
              {cards.length}
              {lang === 'ko' ? '개)' : ')'}
            </div>
          )}
          <button
            onClick={() => {
              if (cards.length < 10) {
                alert(lang === 'ko' ? '카드가 10개 이상이어야 게임을 시작할 수 있습니다.' : 'You need at least 10 cards to start the game.');
                return;
              }
              setShowPlayModal(true);
            }}
            disabled={cards.length < 10}
            className={`w-full font-semibold px-4 py-3 rounded-xl transition-all ${
              cards.length >= 10
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            <i className="ri-play-line mr-2"></i>
            {lang === 'ko' ? '게임 시작하기' : 'Start Game'}
          </button>
        </div>

        {/* 댓글 섹션 */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4">{lang === 'ko' ? '댓글' : 'Comments'}</h2>
          
          {/* 댓글 입력 */}
          {user && (
            <div className="mb-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={lang === 'ko' ? '댓글을 입력하세요...' : 'Write a comment...'}
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none text-sm"
                maxLength={500}
              />
              
              {/* 이미지 업로드 */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        alert(lang === 'ko' ? '이미지 크기는 5MB 이하여야 합니다.' : 'Image size must be 5MB or less.');
                        return;
                      }
                      handleImageUpload(file);
                    }
                  }}
                  className="hidden"
                  ref={commentImageInputRef}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (commentImageInputRef.current) {
                      commentImageInputRef.current.click();
                    }
                  }}
                  disabled={isUploadingImage}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  <i className="ri-image-line mr-1"></i>
                  {lang === 'ko' ? '이미지' : 'Image'}
                </button>
                {commentImage && (
                  <div className="flex items-center gap-2">
                    <img src={commentImage} alt="Preview" className="w-12 h-12 object-cover rounded" />
                    <button
                      type="button"
                      onClick={() => setCommentImage(null)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                )}
                {isUploadingImage && (
                  <span className="text-xs text-slate-400">{lang === 'ko' ? '업로드 중...' : 'Uploading...'}</span>
                )}
              </div>
              
              <button
                onClick={handleSubmitComment}
                disabled={(!newComment.trim() && !commentImage) || isSubmittingComment}
                className="mt-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-all text-sm"
              >
                {isSubmittingComment ? (lang === 'ko' ? '작성 중...' : 'Submitting...') : (lang === 'ko' ? '댓글 작성' : 'Post Comment')}
              </button>
            </div>
          )}
          
          {/* 댓글 목록 */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">
                {lang === 'ko' ? '아직 댓글이 없습니다.' : 'No comments yet.'}
              </p>
            ) : (
              comments.map((comment) => {
                const isOwnComment = user && comment.user_id === user.id;
                return (
                  <div 
                    key={comment.id} 
                    className={`bg-slate-900 rounded-lg p-3 sm:p-4 border border-slate-700`}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      {comment.user_profile_image ? (
                        <img
                          src={comment.user_profile_image}
                          alt={comment.user_nickname || 'User'}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(comment.user_nickname || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-sm font-semibold ${
                            isOwnComment ? 'text-cyan-400' : 'text-teal-400'
                          }`}>
                            {comment.user_nickname || (comment.user_id?.substring(0, 8) || 'User')}
                            {isOwnComment && userNickname && ` (${userNickname})`}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(comment.created_at).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                          </span>
                        </div>
                        <p className={`text-sm whitespace-pre-wrap mb-2 ${
                          isOwnComment ? 'text-cyan-200' : 'text-slate-300'
                        }`}>{comment.content}</p>
                        {comment.image_url && (
                          <div className="mt-2">
                            <img
                              src={comment.image_url}
                              alt="Comment image"
                              className="max-w-full max-h-64 object-contain rounded-lg border border-slate-700"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 플레이 설정 모달 */}
        {showPlayModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4 text-white">
                {lang === 'ko' ? '게임 설정' : 'Game Settings'}
              </h2>
              
              {/* 문제 개수 */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '문제 개수' : 'Number of Questions'} <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[10, 20, 30].map(count => (
                    <button
                      key={count}
                      onClick={() => setPlayCount(count)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        playCount === count
                          ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                          : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                  <button
                    onClick={() => setPlayCount('all')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      playCount === 'all'
                        ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                        : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                    }`}
                  >
                    {lang === 'ko' ? '모두' : 'All'}
                  </button>
                </div>
                <input
                  type="number"
                  value={typeof playCount === 'number' ? playCount : ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                      setPlayCount(Math.max(10, Math.min(cards.length, val)));
                    }
                  }}
                  min={10}
                  max={cards.length}
                  placeholder={lang === 'ko' ? '커스텀 (10~' + cards.length + ')' : 'Custom (10~' + cards.length + ')'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {lang === 'ko' ? `총 ${cards.length}개 카드 중 선택` : `${cards.length} cards available`}
                </p>
              </div>

              {/* 시간 제한 */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '카드당 시간 제한' : 'Time Limit Per Card'} <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { label: lang === 'ko' ? '30초' : '30s', value: 30 },
                    { label: lang === 'ko' ? '1분' : '1m', value: 60 },
                    { label: lang === 'ko' ? '3분' : '3m', value: 180 },
                    { label: lang === 'ko' ? '무제한' : '∞', value: null },
                  ].map(option => (
                    <button
                      key={option.value || 'unlimited'}
                      onClick={() => {
                        setTimePerCard(option.value);
                        setCustomTimeInput('');
                      }}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        timePerCard === option.value && customTimeInput === ''
                          ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                          : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  <input
                    type="number"
                    value={customTimeInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomTimeInput(val);
                      if (val && !isNaN(parseInt(val))) {
                        const numVal = parseInt(val);
                        // 3초~180초(3분) 범위로 제한
                        if (numVal >= 3 && numVal <= 180) {
                          setTimePerCard(numVal);
                        } else if (numVal < 3) {
                          setTimePerCard(3);
                          setCustomTimeInput('3');
                        } else if (numVal > 180) {
                          setTimePerCard(180);
                          setCustomTimeInput('180');
                        }
                      }
                    }}
                    placeholder={lang === 'ko' ? '직접 입력 (3초~180초, 예: 3)' : 'Custom (3-180 seconds, e.g., 3)'}
                    min="3"
                    max="180"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {customTimeInput && (
                    <p className="text-xs text-teal-400 mt-1">
                      {lang === 'ko' ? `${customTimeInput}초로 설정됨 (3초~180초)` : `Set to ${customTimeInput} seconds (3-180 seconds)`}
                    </p>
                  )}
                  {customTimeInput && (parseInt(customTimeInput) < 3 || parseInt(customTimeInput) > 180) && (
                    <p className="text-xs text-red-400 mt-1">
                      {lang === 'ko' ? '시간 제한은 3초 이상 180초(3분) 이하여야 합니다.' : 'Time limit must be between 3 and 180 seconds.'}
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {lang === 'ko' ? '모든 카드에 동일한 시간이 적용됩니다 (3초~180초)' : 'Same time limit for all cards (3-180 seconds)'}
                </p>
              </div>

              {/* 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPlayModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-3 rounded-lg transition-all"
                >
                  {lang === 'ko' ? '취소' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    const actualCount = playCount === 'all' ? cards.length : playCount;
                    if (typeof actualCount === 'number' && (actualCount < 10 || actualCount > cards.length)) {
                      alert(lang === 'ko' ? `문제 개수는 10개 이상 ${cards.length}개 이하여야 합니다.` : `Number of questions must be between 10 and ${cards.length}.`);
                      return;
                    }
                    if (actualCount < 10) {
                      alert(lang === 'ko' ? '문제 개수는 최소 10개 이상이어야 합니다.' : 'Number of questions must be at least 10.');
                      return;
                    }
                    // 시간 제한 검증 (3초~180초 또는 무제한만 허용)
                    if (timePerCard !== null && (timePerCard < 3 || timePerCard > 180)) {
                      alert(lang === 'ko' ? '시간 제한은 3초 이상 180초(3분) 이하여야 합니다.' : 'Time limit must be between 3 and 180 seconds.');
                      return;
                    }
                    // 플레이 화면으로 이동 (세션 생성)
                    const timeParam = timePerCard === null ? 'unlimited' : timePerCard;
                    router.push(`/${lang}/guess/${setId}/play?count=${actualCount}&time=${timeParam}`);
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-4 py-3 rounded-lg transition-all"
                >
                  {lang === 'ko' ? '시작하기' : 'Start'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 세트 공유 모달 */}
        {showSetShareModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSetShareModal(false)}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  {lang === 'ko' ? '퀴즈 세트 공유하기' : 'Share Quiz Set'}
                </h2>
                <button
                  onClick={() => setShowSetShareModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
              
              {(() => {
                const shareUrl = typeof window !== 'undefined' 
                  ? `${window.location.origin}/${lang}/guess/${setId}`
                  : '';
                
                return (
                  <div className="space-y-4">
                    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-sm font-semibold text-white mb-2">{guessSet?.title}</h3>
                      {guessSet?.description && (
                        <p className="text-xs text-slate-400 line-clamp-2">{guessSet.description}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(shareUrl);
                            alert(lang === 'ko' ? '링크가 복사되었습니다!' : 'Link copied!');
                            setShowSetShareModal(false);
                          } catch (error) {
                            alert(lang === 'ko' ? '링크 복사에 실패했습니다.' : 'Failed to copy link.');
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-all font-medium"
                      >
                        <i className="ri-file-copy-line"></i>
                        <span>{lang === 'ko' ? '링크 복사' : 'Copy Link'}</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          const text = lang === 'ko' 
                            ? `${guessSet?.title} - 퀴즈 도전하기!`
                            : `${guessSet?.title} - Take the quiz!`;
                          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
                          window.open(twitterUrl, '_blank', 'width=550,height=420');
                          setShowSetShareModal(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-all font-medium"
                      >
                        <i className="ri-twitter-x-line"></i>
                        <span>{lang === 'ko' ? '트위터 공유' : 'Share on Twitter'}</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
                          window.open(facebookUrl, '_blank', 'width=550,height=420');
                          setShowSetShareModal(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium"
                      >
                        <i className="ri-facebook-line"></i>
                        <span>{lang === 'ko' ? '페이스북 공유' : 'Share on Facebook'}</span>
                      </button>
                    </div>
                    
                    <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                      <p className="text-xs text-slate-400 mb-1">{lang === 'ko' ? '공유 링크' : 'Share Link'}</p>
                      <p className="text-xs text-teal-400 break-all font-mono">{shareUrl}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 카드 공유 모달 */}
        {showCardShareModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCardShareModal(null)}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  {lang === 'ko' ? '카드 공유하기' : 'Share Card'}
                </h2>
                <button
                  onClick={() => setShowCardShareModal(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
              
              {(() => {
                const card = cards.find(c => c.id === showCardShareModal);
                if (!card) return null;
                
                const shareUrl = typeof window !== 'undefined' 
                  ? `${window.location.origin}/${lang}/guess/${setId}#card-${card.id}`
                  : '';
                
                return (
                  <div className="space-y-4">
                    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-sm font-semibold text-white mb-2">{card.question}</h3>
                      {card.answers && Array.isArray(card.answers) && card.answers.length > 0 && (
                        <p className="text-xs text-slate-400">
                          {lang === 'ko' ? '정답' : 'Answer'}: {card.answers.join(', ')}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(shareUrl);
                            alert(lang === 'ko' ? '링크가 복사되었습니다!' : 'Link copied!');
                            setShowCardShareModal(null);
                          } catch (error) {
                            alert(lang === 'ko' ? '링크 복사에 실패했습니다.' : 'Failed to copy link.');
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-all font-medium"
                      >
                        <i className="ri-file-copy-line"></i>
                        <span>{lang === 'ko' ? '링크 복사' : 'Copy Link'}</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          const text = lang === 'ko' 
                            ? `${guessSet.title} - ${card.question}`
                            : `${guessSet.title} - ${card.question}`;
                          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
                          window.open(twitterUrl, '_blank', 'width=550,height=420');
                          setShowCardShareModal(null);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-all font-medium"
                      >
                        <i className="ri-twitter-x-line"></i>
                        <span>{lang === 'ko' ? '트위터 공유' : 'Share on Twitter'}</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
                          window.open(facebookUrl, '_blank', 'width=550,height=420');
                          setShowCardShareModal(null);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium"
                      >
                        <i className="ri-facebook-line"></i>
                        <span>{lang === 'ko' ? '페이스북 공유' : 'Share on Facebook'}</span>
                      </button>
                    </div>
                    
                    <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                      <p className="text-xs text-slate-400 mb-1">{lang === 'ko' ? '공유 링크' : 'Share Link'}</p>
                      <p className="text-xs text-teal-400 break-all font-mono">{shareUrl}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

