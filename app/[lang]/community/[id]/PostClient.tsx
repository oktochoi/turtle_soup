'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import UserLabel from '@/components/UserLabel';
import { useTranslations } from '@/hooks/useTranslations';
import { createNotification } from '@/lib/notifications';

type ListPost = {
  id: string;
  title: string;
  author: string;
  category: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
};

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

type Comment = {
  id: string;
  post_id: string;
  content: string;
  author: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  is_pinned?: boolean;
};

type PostClientProps = {
  initialPost: Post;
  lang: string;
  postId: string;
};

export default function PostClient({ initialPost, lang, postId }: PostClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations();
  
  const [post, setPost] = useState<Post | null>(initialPost);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [authorGameUserId, setAuthorGameUserId] = useState<string | null>(null);
  const [commentGameUserIds, setCommentGameUserIds] = useState<Map<string, string>>(new Map());
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [recentPosts, setRecentPosts] = useState<ListPost[]>([]);
  const [commentSort, setCommentSort] = useState<'oldest' | 'newest'>('oldest');
  const [isAdmin, setIsAdmin] = useState(false);

  const hasIncrementedView = useRef(false);

  const CATEGORIES: { [key: string]: { label: string; icon: string; color: string } } = {
    notice: { label: t.community.notice, icon: 'ri-megaphone-line', color: 'from-red-500 to-pink-500' },
    daily: { label: t.community.daily, icon: 'ri-calendar-check-line', color: 'from-yellow-500 to-orange-500' },
    recommend: { label: t.community.recommend, icon: 'ri-share-forward-line', color: 'from-green-500 to-emerald-500' },
    free: { label: t.community.free, icon: 'ri-chat-3-line', color: 'from-blue-500 to-cyan-500' },
    bug: { label: t.community.bug, icon: 'ri-bug-line', color: 'from-purple-500 to-indigo-500' },
    hall_of_fame: { label: t.community.hallOfFame, icon: 'ri-trophy-line', color: 'from-yellow-400 to-amber-500' },
    funny: { label: t.community.funny, icon: 'ri-emotion-laugh-line', color: 'from-pink-500 to-rose-500' },
    social: { label: t.community.social, icon: 'ri-group-line', color: 'from-teal-500 to-cyan-500' },
  };

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        setIsAdmin(data?.is_admin === true);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    loadPost();
    loadComments();
    checkLike();
    loadRecentPosts();
    
    // 조회수는 한 번만 증가 (약간의 지연을 두어 페이지 로드 후 실행)
    if (!hasIncrementedView.current) {
      // 페이지가 완전히 로드된 후 조회수 증가
      const timer = setTimeout(() => {
        incrementViewCount();
        hasIncrementedView.current = true;
      }, 500);
      
      return () => {
        clearTimeout(timer);
      };
    }

    // 실시간 업데이트를 위한 구독 설정
    const channel = supabase
      .channel(`post-${postId}-changes`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes', filter: `post_id=eq.${postId}` },
        async () => {
          // 좋아요 변경 시 게시글과 좋아요 상태 새로고침
          await loadPost();
          await checkLike();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        async () => {
          // 댓글 변경 시 게시글과 댓글 목록 새로고침
          await loadPost();
          await loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, user, lang]);

  const loadPost = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error) throw error;
      setPost(data);

      // 작성자의 game_user_id 찾기
      if (data.user_id) {
        const { data: gameUser } = await supabase
          .from('game_users')
          .select('id')
          .eq('auth_user_id', data.user_id)
          .maybeSingle();

        if (gameUser) {
          setAuthorGameUserId(gameUser.id);
        }
      }
    } catch (error) {
      console.error('게시글 로드 오류:', error);
      router.push(`/${lang}/community`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentPosts = async () => {
    try {
      const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, author, category, view_count, created_at')
        .eq('lang', currentLang)
        .neq('id', postId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const postsWithCounts = await Promise.all((data || []).map(async (p) => {
        const { count: commentCount } = await supabase
          .from('post_comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', p.id);
        const { count: likeCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', p.id);
        return {
          ...p,
          comment_count: commentCount || 0,
          like_count: likeCount || 0,
        };
      }));
      setRecentPosts(postsWithCounts);
    } catch (error) {
      console.error('최근 게시글 로드 오류:', error);
    }
  };

  const loadComments = async () => {
    try {
      // 모든 댓글을 가져온 후 클라이언트에서 정렬 (더 안전함)
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('댓글 조회 에러 상세:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      // 클라이언트에서 정렬: 고정된 댓글 먼저, 그 다음 일반 댓글
      const sortedComments = (data || []).sort((a, b) => {
        // is_pinned가 true인 댓글이 먼저 오도록
        const aPinned = a.is_pinned === true;
        const bPinned = b.is_pinned === true;
        
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        
        // 같은 타입이면 created_at 순서 유지
        return 0;
      });
      
      setComments(sortedComments);

      // 각 댓글 작성자의 game_user_id 찾기
      const userIds = new Map<string, string>();
      for (const comment of sortedComments) {
        if (comment.user_id) {
          try {
            const { data: gameUser } = await supabase
              .from('game_users')
              .select('id')
              .eq('auth_user_id', comment.user_id)
              .maybeSingle();

            if (gameUser) {
              userIds.set(comment.id, gameUser.id);
            }
          } catch (userError) {
            // 개별 사용자 조회 실패는 무시하고 계속 진행
            console.warn('사용자 ID 조회 실패:', comment.user_id, userError);
          }
        }
      }
      setCommentGameUserIds(userIds);
    } catch (error: any) {
      console.error('댓글 로드 오류:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        error: error
      });
      // 에러가 발생해도 빈 배열로 설정하여 UI가 깨지지 않도록
      setComments([]);
    }
  };

  const checkLike = async () => {
    if (!user) {
      setIsLiked(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsLiked(!!data);
    } catch (error) {
      console.error('좋아요 확인 오류:', error);
    }
  };

  const incrementViewCount = async () => {
    try {
      // RPC 함수 시도
      const { error: rpcError } = await supabase.rpc('increment_post_view_count', { post_uuid: postId });
      
      // RPC 함수가 없거나 실패하면 직접 UPDATE
      if (rpcError) {
        console.warn('RPC 함수 실패, 직접 UPDATE 시도:', rpcError);
        
        // 현재 조회수 가져오기
        const { data: currentPost, error: selectError } = await supabase
          .from('posts')
          .select('view_count')
          .eq('id', postId)
          .single();
        
        if (selectError) {
          console.error('조회수 조회 오류:', selectError);
          return;
        }
        
        // 조회수 증가
        const { error: updateError } = await supabase
          .from('posts')
          .update({ view_count: (currentPost?.view_count || 0) + 1 })
          .eq('id', postId);
        
        if (updateError) {
          console.error('조회수 직접 업데이트 오류:', updateError);
          return;
        }
      }
      
      // 조회수 업데이트 후 게시글 다시 로드
      await loadPost();
    } catch (error) {
      console.error('조회수 증가 오류:', error);
      // 에러가 발생해도 게시글은 로드
      await loadPost();
    }
  };

  const handleLike = async () => {
    if (!user) {
      alert(t.community.loginRequired);
      router.push(`/${lang}/auth/login`);
      return;
    }

    if (!post) return;

    const previousIsLiked = isLiked;
    const previousLikeCount = post.like_count || 0;

    try {
      const newIsLiked = !isLiked;
      setIsLiked(newIsLiked);
      setPost(prev => prev ? { ...prev, like_count: newIsLiked ? previousLikeCount + 1 : Math.max(previousLikeCount - 1, 0) } : null);

      if (newIsLiked) {
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id,
          });

        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      // 최신 좋아요 수 로드
      const { data: updatedPost } = await supabase
        .from('posts')
        .select('like_count, comment_count, view_count')
        .eq('id', postId)
        .single();
      
      if (updatedPost) {
        setPost(prev => prev ? { ...prev, ...updatedPost } : null);
      }
      
      await checkLike(); // 좋아요 상태도 다시 확인
    } catch (error: any) {
      console.error('좋아요 오류:', error);
      // 실패 시 롤백
      setIsLiked(previousIsLiked);
      setPost(prev => prev ? { ...prev, like_count: previousLikeCount } : null);
      
      // 사용자에게 오류 알림 (중복 좋아요는 무시)
      if (error?.code !== '23505' && error?.message) {
        console.error('좋아요 처리 실패:', error.message);
      }
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert(t.community.loginRequired);
      router.push(`/${lang}/auth/login`);
      return;
    }

    if (!commentText.trim()) {
      alert(t.community.enterCommentAlert);
      return;
    }

    setIsSubmittingComment(true);
    try {
      // game_users에서 닉네임 가져오기
      const { data: gameUser } = await supabase
        .from('game_users')
        .select('nickname')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      // users 테이블에서 nickname 가져오기
      const { data: userData } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', user.id)
        .maybeSingle();
      
      const author = userData?.nickname || gameUser?.nickname || user.id.substring(0, 8);

      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          content: commentText.trim(),
          author: author,
          user_id: user.id,
        });

      if (error) throw error;

      setCommentText('');
      await loadComments();
      
      // 댓글 수 직접 업데이트
      const { count: commentCount } = await supabase
        .from('post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);
      
      setPost(prev => prev ? { ...prev, comment_count: commentCount || 0 } : null);

      // 게시글 작성자에게 알림 생성
      if (post && post.user_id && post.user_id !== user.id) {
        const postTitle = post.title || (lang === 'ko' ? '게시글' : 'Post');
        await createNotification({
          userId: post.user_id,
          type: 'comment_on_post',
          title: lang === 'ko'
            ? `"${postTitle}"에 댓글이 달렸습니다`
            : `New comment on "${postTitle}"`,
          message: lang === 'ko'
            ? `${author}님이 댓글을 남겼습니다: ${commentText.trim().substring(0, 50)}${commentText.trim().length > 50 ? '...' : ''}`
            : `${author} commented: ${commentText.trim().substring(0, 50)}${commentText.trim().length > 50 ? '...' : ''}`,
          link: `/${lang}/community/${postId}`,
        });
      }
    } catch (error) {
      console.error('댓글 작성 오류:', error);
      alert(t.community.commentFailed);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(t.community.deleteComment)) return;

    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      await loadComments();
      
      // 댓글 수 직접 업데이트
      const { count: commentCount } = await supabase
        .from('post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);
      
      setPost(prev => prev ? { ...prev, comment_count: commentCount || 0 } : null);
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      alert(t.community.deleteCommentFailed);
    }
  };

  const handleTogglePinComment = async (commentId: string, currentPinned: boolean) => {
    if (!isAuthor) return;

    try {
      const { error } = await supabase
        .from('post_comments')
        .update({ is_pinned: !currentPinned })
        .eq('id', commentId);

      if (error) throw error;

      await loadComments();
    } catch (error) {
      console.error('댓글 고정 오류:', error);
      alert('댓글 고정에 실패했습니다.');
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleDeletePost = async () => {
    if (!confirm(lang === 'ko' ? '게시글을 삭제하시겠습니까?' : 'Are you sure you want to delete this post?')) return;
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      router.push(`/${lang}/community`);
    } catch (error) {
      console.error('게시글 삭제 오류:', error);
      alert(lang === 'ko' ? '게시글 삭제에 실패했습니다.' : 'Failed to delete post.');
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentText.trim()) {
      alert(t.community.enterCommentContent);
      return;
    }

    try {
      const { error } = await supabase
        .from('post_comments')
        .update({
          content: editingCommentText.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId);

      if (error) throw error;

      setEditingCommentId(null);
      setEditingCommentText('');
      await loadComments();
    } catch (error) {
      console.error('댓글 수정 오류:', error);
      alert(t.community.updateCommentFail);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    const y = date.getFullYear().toString().slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const sec = String(date.getSeconds()).padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${min}:${sec}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{t.community.loadingPost}</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{t.community.postNotFound}</p>
          <Link href={`/${lang}/community`}>
            <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg">
              {t.community.backToList}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const isAuthor = user && post.user_id === user.id;

  const sortedComments = [...comments].sort((a, b) => {
    const aPinned = (a as Comment).is_pinned === true;
    const bPinned = (b as Comment).is_pinned === true;
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    if (commentSort === 'newest') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const getCategoryInfo = (catId: string) => CATEGORIES[catId] || { label: catId, icon: 'ri-file-text-line', color: 'from-slate-500 to-slate-600' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
        <div className="mb-4">
          <Link href={`/${lang}/community`} className="text-slate-400 hover:text-white transition-colors text-sm">
            <i className="ri-arrow-left-line mr-2"></i>
            {t.community.backToList}
          </Link>
        </div>

        {/* 게시글 헤더 (디시 스타일) */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-t-xl p-4 sm:p-5 border border-slate-700/50 border-b-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {post.category && CATEGORIES[post.category] && (
              <span className={`px-2 py-0.5 rounded text-xs font-semibold bg-gradient-to-r ${CATEGORIES[post.category].color} text-white`}>
                {CATEGORIES[post.category].label}
              </span>
            )}
            <h1 className="text-lg sm:text-xl font-bold text-white break-words flex-1">
              {post.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-400">
            {authorGameUserId ? (
              <Link href={`/${lang}/profile/${authorGameUserId}`} className="hover:text-teal-400 transition-colors">
                {post.author}
              </Link>
            ) : (
              <span>{post.author}</span>
            )}
            <span>{formatDateShort(post.created_at)}</span>
            <span className="flex items-center gap-1">
              {lang === 'ko' ? '조회' : 'Views'} {post.view_count}
            </span>
            <span className="flex items-center gap-1">
              {lang === 'ko' ? '추천' : 'Likes'} {post.like_count}
            </span>
            <span className="flex items-center gap-1">
              {lang === 'ko' ? '댓글' : 'Comments'} {post.comment_count}
            </span>
          </div>
        </div>

        {/* 본문 */}
        <div className="bg-slate-800/30 backdrop-blur-md p-4 sm:p-6 border border-slate-700/50 border-t-0">
          <p className="text-sm sm:text-base text-slate-300 whitespace-pre-wrap leading-relaxed break-words mb-6">
            {post.content}
          </p>

          {/* 액션 버튼 (디시 스타일) */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-4 border-t border-slate-700/50">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-all ${
                isLiked
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <i className={`ri-heart-${isLiked ? 'fill' : 'line'}`}></i>
              {lang === 'ko' ? '추천' : 'Like'} {post.like_count}
            </button>
            <button
              onClick={async () => {
                const url = typeof window !== 'undefined' ? `${window.location.origin}/${lang}/community/${postId}` : '';
                try {
                  await navigator.clipboard.writeText(url);
                  alert(lang === 'ko' ? '링크가 복사되었습니다.' : 'Link copied.');
                } catch {
                  alert(lang === 'ko' ? '복사에 실패했습니다.' : 'Copy failed.');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              <i className="ri-share-line"></i>
              {lang === 'ko' ? '공유' : 'Share'}
            </button>
            {(isAuthor || isAdmin) && (
              <Link href={`/${lang}/community/${postId}/edit`}>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-slate-700 text-slate-300 hover:bg-slate-600">
                  <i className="ri-edit-line"></i>
                  {t.community.edit}
                </button>
              </Link>
            )}
            {(isAuthor || isAdmin) && (
              <button
                onClick={handleDeletePost}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50"
              >
                <i className="ri-delete-bin-line"></i>
                {t.common.delete}
              </button>
            )}
          </div>
        </div>

        {/* 댓글 섹션 (디시 스타일) */}
        <div className="mt-6 space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-slate-700">
            <h2 className="text-sm sm:text-base font-bold">
              {lang === 'ko' ? `전체 댓글 ${comments.length}개` : `All Comments (${comments.length})`}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                onClick={() => setCommentSort('oldest')}
                className={`px-2 py-1 rounded ${commentSort === 'oldest' ? 'bg-slate-600 text-white' : 'hover:bg-slate-700'}`}
              >
                {lang === 'ko' ? '등록순' : 'Oldest'}
              </button>
              <button
                onClick={() => setCommentSort('newest')}
                className={`px-2 py-1 rounded ${commentSort === 'newest' ? 'bg-slate-600 text-white' : 'hover:bg-slate-700'}`}
              >
                {lang === 'ko' ? '최신순' : 'Newest'}
              </button>
            </div>
          </div>
          {comments.length === 0 ? (
            <div className="text-center py-8 bg-slate-800/50 rounded-xl border border-slate-700">
              <p className="text-slate-400">{t.community.noComments}</p>
            </div>
          ) : (
            sortedComments.map((comment) => {
              const isCommentAuthor = user && comment.user_id === user.id;
              const isEditing = editingCommentId === comment.id;
              const isPinned = comment.is_pinned || false;
              return (
                <div
                  key={comment.id}
                  className={`bg-slate-800/50 backdrop-blur-md rounded-xl p-3 sm:p-4 lg:p-5 border ${
                    isPinned 
                      ? 'border-yellow-500/50 bg-yellow-500/5' 
                      : 'border-slate-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-400 flex-wrap min-w-0 flex-1">
                      {isPinned && (
                        <>
                          <i className="ri-pushpin-fill text-yellow-400"></i>
                          <span className="text-xs text-yellow-400 font-semibold">고정</span>
                          <span>·</span>
                        </>
                      )}
                      {commentGameUserIds.get(comment.id) ? (
                        <Link href={`/${lang}/profile/${commentGameUserIds.get(comment.id)}`} className="hover:opacity-80 transition-opacity">
                          <UserLabel
                            userId={commentGameUserIds.get(comment.id)!}
                            nickname={comment.author}
                            size="sm"
                          />
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-300">{comment.author}</span>
                      )}
                      <span>·</span>
                      <span>{formatDateShort(comment.created_at)}</span>
                      {comment.updated_at !== comment.created_at && (
                        <>
                          <span>·</span>
                          <span className="text-xs text-slate-500">
                            ({t.common.edited})
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isAuthor && !isEditing && (
                        <button
                          onClick={() => handleTogglePinComment(comment.id, isPinned)}
                          className={`text-xs transition-colors ${
                            isPinned 
                              ? 'text-yellow-400 hover:text-yellow-300' 
                              : 'text-slate-400 hover:text-yellow-400'
                          }`}
                          title={isPinned ? '고정 해제' : '고정'}
                        >
                          <i className={`ri-pushpin-${isPinned ? 'fill' : 'line'}`}></i>
                        </button>
                      )}
                      {isCommentAuthor && !isEditing && (
                        <button
                          onClick={() => handleStartEdit(comment)}
                          className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                          title={t.common.edit}
                        >
                          <i className="ri-edit-line"></i>
                        </button>
                      )}
                      {(isAuthor || isAdmin || isCommentAuthor) && !isEditing && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                          title={t.common.delete}
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        placeholder={t.community.enterComment}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                        maxLength={1000}
                        required
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{editingCommentText.length} / 1000</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all"
                          >
                            {t.common.cancel}
                          </button>
                          <button
                            onClick={() => handleUpdateComment(comment.id)}
                            disabled={!editingCommentText.trim()}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg text-sm transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t.common.save}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-300 whitespace-pre-wrap">{comment.content}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 댓글 작성 (디시 스타일 - 하단) */}
        {user ? (
          <div className="mt-6 bg-slate-800/50 backdrop-blur-md rounded-xl p-4 sm:p-5 border border-slate-700/50">
            <form onSubmit={handleSubmitComment}>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t.community.enterComment}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 sm:h-24 resize-none mb-2"
                maxLength={1000}
                required
              />
              <p className="text-xs text-slate-500 mb-2">
                {lang === 'ko' ? 'Shift+Enter로 줄바꿈' : 'Shift+Enter for new line'} · {commentText.length} / 1000
              </p>
              <button
                type="submit"
                disabled={isSubmittingComment || !commentText.trim()}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingComment ? (lang === 'ko' ? '작성 중...' : 'Submitting...') : t.community.writeComment}
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 text-center text-slate-400 text-sm">
            {t.community.loginToComment}
            <Link href={`/${lang}/auth/login`} className="ml-2 text-blue-400 hover:text-blue-300">
              {t.community.loginButton}
            </Link>
          </div>
        )}

        {/* 커뮤니티 리스트 (디시 스타일 - 하단 게시물 목록) */}
        {recentPosts.length > 0 && (
          <div className="mt-8 bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden">
            <h2 className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 text-sm font-semibold text-slate-300">
              {lang === 'ko' ? '커뮤니티 리스트' : 'Community List'}
            </h2>
            <div className="hidden sm:grid sm:grid-cols-[auto_auto_1fr_auto_auto_auto_auto] gap-2 sm:gap-4 px-4 py-2 bg-slate-800/60 border-b border-slate-700 text-xs font-semibold text-slate-400">
              <span className="w-10 text-center">{lang === 'ko' ? '번호' : '#'}</span>
              <span className="w-16">{lang === 'ko' ? '말머리' : 'Cat'}</span>
              <span>{lang === 'ko' ? '제목' : 'Title'}</span>
              <span className="w-20 truncate">{lang === 'ko' ? '글쓴이' : 'Author'}</span>
              <span className="w-16">{lang === 'ko' ? '작성일' : 'Date'}</span>
              <span className="w-12 text-center">{lang === 'ko' ? '조회' : 'Views'}</span>
              <span className="w-12 text-center">{lang === 'ko' ? '추천' : 'Likes'}</span>
            </div>
            {recentPosts.slice(0, 15).map((p, idx) => {
              const catInfo = getCategoryInfo(p.category);
              return (
                <Link
                  key={p.id}
                  href={`/${lang}/community/${p.id}`}
                  className={`flex flex-col sm:grid sm:grid-cols-[auto_auto_1fr_auto_auto_auto_auto] gap-1 sm:gap-4 px-4 py-2.5 sm:py-2 border-b border-slate-700/50 last:border-b-0 hover:bg-slate-700/30 transition-colors ${
                    p.id === postId ? 'bg-blue-500/10' : ''
                  }`}
                >
                  <span className="hidden sm:block w-10 text-center text-xs text-slate-500">{idx + 1}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold bg-gradient-to-r ${catInfo.color} text-white w-fit`}>
                    {catInfo.label.length > 4 ? catInfo.label.substring(0, 4) : catInfo.label}
                  </span>
                  <span className="text-sm font-medium text-slate-200 line-clamp-1 truncate min-w-0">
                    {p.title}
                    {p.comment_count > 0 && <span className="text-slate-500 ml-1">[{p.comment_count}]</span>}
                  </span>
                  <span className="text-xs text-slate-400 truncate max-w-[80px]">{p.author}</span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{formatDateShort(p.created_at).split(' ')[0]}</span>
                  <span className="hidden sm:block text-xs text-slate-500 text-center">{p.view_count}</span>
                  <span className="hidden sm:block text-xs text-slate-500 text-center">{p.like_count}</span>
                  <span className="sm:hidden flex gap-2 text-xs text-slate-500 mt-1">
                    <span><i className="ri-eye-line"></i> {p.view_count}</span>
                    <span><i className="ri-heart-line"></i> {p.like_count}</span>
                  </span>
                </Link>
              );
            })}
            <div className="px-4 py-3 border-t border-slate-700">
              <Link
                href={`/${lang}/community`}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                {lang === 'ko' ? '전체 목록 보기' : 'View All Posts'} →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

