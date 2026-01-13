'use client';

import { use } from 'react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import UserLabel from '@/components/UserLabel';
import { useTranslations } from '@/hooks/useTranslations';

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
};

export default function PostDetailPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolvedParams = use(params);
  const postId = resolvedParams.id;
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations();
  
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [authorGameUserId, setAuthorGameUserId] = useState<string | null>(null);
  const [commentGameUserIds, setCommentGameUserIds] = useState<Map<string, string>>(new Map());
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

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
    loadPost();
    loadComments();
    checkLike();
    
    // 조회수는 한 번만 증가
    if (!hasIncrementedView.current) {
      incrementViewCount();
      hasIncrementedView.current = true;
    }
  }, [postId, user]);

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

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);

      // 각 댓글 작성자의 game_user_id 찾기
      const userIds = new Map<string, string>();
      for (const comment of data || []) {
        if (comment.user_id) {
          const { data: gameUser } = await supabase
            .from('game_users')
            .select('id')
            .eq('auth_user_id', comment.user_id)
            .maybeSingle();

          if (gameUser) {
            userIds.set(comment.id, gameUser.id);
          }
        }
      }
      setCommentGameUserIds(userIds);
    } catch (error) {
      console.error('댓글 로드 오류:', error);
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
      await supabase.rpc('increment_post_view_count', { post_uuid: postId });
      // 조회수 업데이트 후 게시글 다시 로드
      loadPost();
    } catch (error) {
      console.error('조회수 증가 오류:', error);
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

      // 최신 좋아요 수 로드 (트리거로 업데이트된 like_count 반영)
      await loadPost();
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

      const author = gameUser?.nickname || user.email?.split('@')[0] || user.id.substring(0, 8);

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
      await loadPost(); // 댓글 수 업데이트
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
      await loadPost();
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      alert(t.community.deleteCommentFailed);
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

  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentText.trim()) {
      alert(lang === 'ko' ? '댓글 내용을 입력해주세요.' : 'Please enter comment content.');
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
      alert(lang === 'ko' ? '댓글 수정에 실패했습니다.' : 'Failed to update comment.');
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

        {/* 게시글 */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 sm:p-8 border border-slate-700/50 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {post.category && CATEGORIES[post.category] && (
                  <span className={`px-3 py-1 rounded-md text-sm font-semibold bg-gradient-to-r ${CATEGORIES[post.category].color} text-white`}>
                    <i className={`${CATEGORIES[post.category].icon} mr-1`}></i>
                    {CATEGORIES[post.category].label}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {post.title}
              </h1>
            </div>
            {isAuthor && (
              <Link href={`/${lang}/community/${postId}/edit`}>
                <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
                  <i className="ri-edit-line mr-1"></i>
                  {t.community.edit}
                </button>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-400 mb-6">
            {authorGameUserId ? (
              <Link href={`/${lang}/profile/${authorGameUserId}`} className="hover:opacity-80 transition-opacity">
                <UserLabel
                  userId={authorGameUserId}
                  nickname={post.author}
                  size="sm"
                />
              </Link>
            ) : (
              <span className="flex items-center gap-1">
                <i className="ri-user-line"></i>
                {post.author}
              </span>
            )}
            <span>{formatDate(post.created_at)}</span>
            <span className="flex items-center gap-1">
              <i className="ri-eye-line"></i>
              {post.view_count}
            </span>
          </div>

          <div className="prose prose-invert max-w-none mb-6">
            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
              {post.content}
            </p>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-slate-700">
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isLiked
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <i className={`ri-heart-${isLiked ? 'fill' : 'line'}`}></i>
              <span>{post.like_count}</span>
            </button>
            <div className="flex items-center gap-2 text-slate-400">
              <i className="ri-chat-3-line"></i>
              <span>{post.comment_count}</span>
            </div>
          </div>
        </div>

        {/* 댓글 작성 */}
        {user && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50 mb-6">
            <h2 className="text-lg font-bold mb-4">{t.community.writeCommentTitle}</h2>
            <form onSubmit={handleSubmitComment}>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t.community.enterComment}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none mb-3"
                maxLength={1000}
                required
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{commentText.length} / 1000</span>
                <button
                  type="submit"
                  disabled={isSubmittingComment || !commentText.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingComment ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      {t.community.creating}
                    </>
                  ) : (
                    <>
                      <i className="ri-send-plane-line mr-2"></i>
                      {t.community.writeComment}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 댓글 목록 */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold">{t.community.commentsCount} ({comments.length})</h2>
          {comments.length === 0 ? (
            <div className="text-center py-8 bg-slate-800/50 rounded-xl border border-slate-700">
              <p className="text-slate-400">{t.community.noComments}</p>
            </div>
          ) : (
            comments.map((comment) => {
              const isCommentAuthor = user && comment.user_id === user.id;
              const isEditing = editingCommentId === comment.id;
              return (
                <div
                  key={comment.id}
                  className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 sm:p-5 border border-slate-700/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
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
                      <span>{formatDate(comment.created_at)}</span>
                      {comment.updated_at !== comment.created_at && (
                        <>
                          <span>·</span>
                          <span className="text-xs text-slate-500">
                            {lang === 'ko' ? '(수정됨)' : '(edited)'}
                          </span>
                        </>
                      )}
                    </div>
                    {isCommentAuthor && !isEditing && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartEdit(comment)}
                          className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                          title={lang === 'ko' ? '수정' : 'Edit'}
                        >
                          <i className="ri-edit-line"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                          title={lang === 'ko' ? '삭제' : 'Delete'}
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    )}
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
                            {lang === 'ko' ? '저장' : 'Save'}
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
      </div>
    </div>
  );
}

