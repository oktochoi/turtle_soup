'use client';

import React from 'react';
import Link from 'next/link';
import UserLabel from '@/components/UserLabel';
import type { ProblemComment } from '@/lib/types';

interface CommentsSectionProps {
  lang: string;
  user: any;
  comments: ProblemComment[];
  commentText: string;
  isSpoiler: boolean;
  replyingToId: string | null;
  replyText: string;
  editingCommentId: string | null;
  editCommentText: string;
  editCommentIsSpoiler: boolean;
  revealedSpoilers: Set<string>;
  commentGameUserIds: Map<string, string>;
  commentProfileImages: Map<string, string | null>;
  onCommentTextChange: (value: string) => void;
  onSpoilerChange: (value: boolean) => void;
  onReplyToChange: (commentId: string | null) => void;
  onReplyTextChange: (value: string) => void;
  onSubmitComment: (parentId?: string | null) => void;
  onEditComment: (comment: ProblemComment) => void;
  onEditCommentTextChange: (value: string) => void;
  onEditCommentSpoilerChange: (value: boolean) => void;
  onSaveEditComment: () => void;
  onCancelEditComment: () => void;
  onDeleteComment: (commentId: string) => void;
  onRevealSpoiler: (commentId: string) => void;
  t: any;
}

export default function CommentsSection({
  lang,
  user,
  comments,
  commentText,
  isSpoiler,
  replyingToId,
  replyText,
  editingCommentId,
  editCommentText,
  editCommentIsSpoiler,
  revealedSpoilers,
  commentGameUserIds,
  commentProfileImages,
  onCommentTextChange,
  onSpoilerChange,
  onReplyToChange,
  onReplyTextChange,
  onSubmitComment,
  onEditComment,
  onEditCommentTextChange,
  onEditCommentSpoilerChange,
  onSaveEditComment,
  onCancelEditComment,
  onDeleteComment,
  onRevealSpoiler,
  t,
}: CommentsSectionProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 sm:p-6 lg:p-8 border border-slate-700">
      <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
        <i className="ri-chat-3-line text-teal-400"></i>
        댓글
      </h2>
      <div className="space-y-3 mb-4">
        {!user && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 rounded-lg p-3 text-sm">
            {t.problem.loginToComment}{' '}
            <Link href={`/${lang}/auth/login`} className="underline hover:text-yellow-300">
              {t.problem.loginButton}
            </Link>
          </div>
        )}
        <textarea
          placeholder={user ? t.problem.commentPlaceholder : t.problem.loginRequired}
          value={commentText}
          onChange={(e) => onCommentTextChange(e.target.value)}
          disabled={!user}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 h-24 resize-none text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          maxLength={500}
        />
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="spoiler-checkbox"
            checked={isSpoiler}
            onChange={(e) => onSpoilerChange(e.target.checked)}
            disabled={!user}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label 
            htmlFor="spoiler-checkbox" 
            className={`text-xs sm:text-sm cursor-pointer ${!user ? 'opacity-50 cursor-not-allowed' : 'text-slate-300 hover:text-red-400'} transition-colors flex items-center gap-1`}
          >
            <i className="ri-eye-off-line text-red-400"></i>
            {lang === 'ko' ? '스포일러 표시' : 'Mark as spoiler'}
          </label>
        </div>
        <button
          onClick={() => onSubmitComment()}
          disabled={!commentText.trim() || !user}
          className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2.5 sm:py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
        >
          {t.problem.writeComment}
        </button>
      </div>

      {/* 댓글 목록 */}
      <div className="space-y-2 sm:space-y-3 mt-4 sm:mt-6">
        {comments.length === 0 ? (
          <p className="text-slate-400 text-xs sm:text-sm">{t.problem.noComments}</p>
        ) : (
          <>
            {comments
              .filter((c) => !c.parent_id)
              .map((comment) => {
              const isCommentOwner = user && comment.user_id === user.id;
              const isEditingThis = editingCommentId === comment.id;
              const isReplying = replyingToId === comment.id;
              const replies = comments.filter((c) => c.parent_id === comment.id);
              
              return (
                <React.Fragment key={comment.id}>
                  <div className="bg-slate-900 rounded-lg p-3 sm:p-4 border border-slate-700">
                    <div className="flex items-start gap-3">
                      {/* 프로필 이미지 - 댓글 왼쪽에 크게 표시 */}
                      <div className="flex-shrink-0">
                        {commentGameUserIds.get(comment.id) ? (
                          <Link href={`/${lang}/profile/${commentGameUserIds.get(comment.id)}`} className="hover:opacity-80 transition-opacity block">
                            {commentProfileImages.get(comment.id) ? (
                              <img
                                src={commentProfileImages.get(comment.id)!}
                                alt={comment.nickname}
                                className="w-10 h-10 rounded-full object-cover border border-slate-600"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-base border border-slate-600">
                                {comment.nickname.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </Link>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-base border border-slate-600">
                            {comment.nickname.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* 댓글 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {commentGameUserIds.get(comment.id) ? (
                              <Link href={`/${lang}/profile/${commentGameUserIds.get(comment.id)}`} className="hover:opacity-80 transition-opacity">
                                <UserLabel
                                  userId={commentGameUserIds.get(comment.id)!}
                                  nickname={comment.nickname}
                                  size="sm"
                                  showProfileImage={false}
                                />
                              </Link>
                            ) : (
                              <span className="text-xs sm:text-sm font-semibold text-cyan-400 break-words">{comment.nickname}</span>
                            )}
                            <span className="text-xs text-slate-500">·</span>
                            <span className="text-xs text-slate-500">
                              {new Date(comment.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                            </span>
                            {comment.updated_at && comment.updated_at !== comment.created_at && (
                              <>
                                <span className="text-xs text-slate-500">·</span>
                                <span className="text-xs text-slate-500">({t.common.edited})</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {user && !isEditingThis && (
                              <button
                                onClick={() => onReplyToChange(isReplying ? null : comment.id)}
                                className="text-xs text-slate-400 hover:text-teal-400 transition-colors p-1"
                                title={t.problem.replyToComment}
                              >
                                <i className="ri-chat-3-line"></i>
                              </button>
                            )}
                            {isCommentOwner && !isEditingThis && (
                              <>
                                <button
                                  onClick={() => onEditComment(comment)}
                                  className="text-xs text-slate-400 hover:text-teal-400 transition-colors p-1"
                                  title={t.common.edit}
                                >
                                  <i className="ri-edit-line"></i>
                                </button>
                                <button
                                  onClick={() => onDeleteComment(comment.id)}
                                  className="text-xs text-slate-400 hover:text-red-400 transition-colors p-1"
                                  title={t.common.delete}
                                >
                                  <i className="ri-delete-bin-line"></i>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {isEditingThis ? (
                      <div className="space-y-2">
                        <textarea
                          value={editCommentText}
                          onChange={(e) => onEditCommentTextChange(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm resize-none"
                          rows={3}
                          maxLength={500}
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="edit-spoiler-checkbox"
                            checked={editCommentIsSpoiler}
                            onChange={(e) => onEditCommentSpoilerChange(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500 focus:ring-2"
                          />
                          <label 
                            htmlFor="edit-spoiler-checkbox" 
                            className="text-xs sm:text-sm cursor-pointer text-slate-300 hover:text-red-400 transition-colors flex items-center gap-1"
                          >
                            <i className="ri-eye-off-line text-red-400"></i>
                            {lang === 'ko' ? '스포일러 표시' : 'Mark as spoiler'}
                          </label>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">{editCommentText.length} / 500</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={onCancelEditComment}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition-all"
                            >
                              {t.common.cancel}
                            </button>
                            <button
                              onClick={onSaveEditComment}
                              disabled={!editCommentText.trim()}
                              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {t.common.save}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {comment.is_spoiler && !revealedSpoilers.has(comment.id) ? (
                          <div
                            onClick={() => onRevealSpoiler(comment.id)}
                            className="bg-red-500/20 border-2 border-red-500/50 border-dashed rounded-lg p-4 cursor-pointer hover:bg-red-500/30 transition-all group"
                          >
                            <div className="flex items-center justify-center gap-2 text-red-400">
                              <i className="ri-eye-off-line text-lg group-hover:scale-110 transition-transform"></i>
                              <span className="text-xs sm:text-sm font-semibold">
                                {lang === 'ko' ? '스포일러가 포함된 댓글입니다. 클릭하여 보기' : 'Spoiler comment. Click to reveal'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-xs sm:text-sm break-words whitespace-pre-wrap ${comment.is_spoiler ? 'text-red-300' : 'text-white'}`}>
                            {comment.text}
                            {comment.is_spoiler && (
                              <span className="ml-2 text-xs text-red-400 opacity-70">
                                <i className="ri-eye-off-line"></i>
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                      </div>
                    </div>
                  </div>

                  {/* 답글 입력 */}
                  {isReplying && (
                    <div className="ml-6 sm:ml-8 mt-2 pl-4 border-l-2 border-slate-700">
                      <textarea
                        value={replyText}
                        onChange={(e) => onReplyTextChange(e.target.value)}
                        placeholder={t.problem.replyPlaceholder}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm resize-none"
                        rows={2}
                        maxLength={500}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => { onReplyToChange(null); onReplyTextChange(''); }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold"
                        >
                          {t.common.cancel}
                        </button>
                        <button
                          onClick={() => onSubmitComment(comment.id)}
                          disabled={!replyText.trim()}
                          className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                        >
                          {t.problem.writeReply}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 대댓글 목록 */}
                  {replies.length > 0 && (
                    <div className="ml-6 sm:ml-8 space-y-2 border-l-2 border-slate-700 pl-4">
                      {replies.map((reply) => {
                        const isReplyOwner = user && reply.user_id === user.id;
                        const isEditingReply = editingCommentId === reply.id;
                        return (
                          <div key={reply.id} className="bg-slate-800/50 rounded-lg p-2 sm:p-3 border border-slate-700/50">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {commentGameUserIds.get(reply.id) ? (
                                    <Link href={`/${lang}/profile/${commentGameUserIds.get(reply.id)}`} className="hover:opacity-80">
                                      <span className="text-xs font-semibold text-cyan-400">{reply.nickname}</span>
                                    </Link>
                                  ) : (
                                    <span className="text-xs font-semibold text-cyan-400">{reply.nickname}</span>
                                  )}
                                  <span className="text-xs text-slate-500">
                                    {new Date(reply.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                                  </span>
                                </div>
                                {isEditingReply ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={editCommentText}
                                      onChange={(e) => onEditCommentTextChange(e.target.value)}
                                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs resize-none"
                                      rows={2}
                                      maxLength={500}
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={onCancelEditComment} className="px-2 py-1 bg-slate-700 rounded text-xs">{t.common.cancel}</button>
                                      <button onClick={onSaveEditComment} disabled={!editCommentText.trim()} className="px-2 py-1 bg-teal-500 rounded text-xs">{t.common.save}</button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-300 break-words whitespace-pre-wrap">{reply.text}</p>
                                )}
                              </div>
                              {isReplyOwner && !isEditingReply && (
                                <div className="flex gap-1">
                                  <button onClick={() => onEditComment(reply)} className="text-xs text-slate-400 hover:text-teal-400 p-1"><i className="ri-edit-line"></i></button>
                                  <button onClick={() => onDeleteComment(reply.id)} className="text-xs text-slate-400 hover:text-red-400 p-1"><i className="ri-delete-bin-line"></i></button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

