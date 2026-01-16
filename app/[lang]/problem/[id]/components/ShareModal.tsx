'use client';

import type { Problem } from '@/lib/types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  problem: Problem;
  problemId: string;
  lang: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  t: any;
}

export default function ShareModal({
  isOpen,
  onClose,
  problem,
  problemId,
  lang,
  showToast,
  t,
}: ShareModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full border border-slate-600 shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {t.problem.shareTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-2xl"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>

        {/* 문제 미리보기 카드 */}
        <div className="bg-slate-900/50 rounded-xl p-4 sm:p-5 mb-6 border border-slate-600/50">
          <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">
            {problem.title}
          </h3>
          <p className="text-sm text-slate-300 line-clamp-3 mb-3">
            {problem.content}
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <i className="ri-eye-line"></i>
              {problem.view_count || 0}
            </span>
            <span className="flex items-center gap-1">
              <i className="ri-heart-line"></i>
              {problem.like_count || 0}
            </span>
            <span className="flex items-center gap-1">
              <i className="ri-chat-3-line"></i>
              {problem.comment_count || 0}
            </span>
          </div>
        </div>

        {/* 공유 옵션 */}
        <div className="space-y-3">
          {/* URL 복사 (카카오스토리 공유 대체) */}
          <button
            onClick={async () => {
              const url = `${window.location.origin}/${lang}/problem/${problemId}`;
              try {
                await navigator.clipboard.writeText(url);
                showToast(lang === 'ko' ? '링크가 복사되었습니다! 카카오스토리에 직접 등록해보세요.' : 'Link copied! You can now paste it in KakaoStory.', 'success');
                onClose();
              } catch (error) {
                const textArea = document.createElement('textarea');
                textArea.value = url;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                  document.execCommand('copy');
                  showToast(lang === 'ko' ? '링크가 복사되었습니다! 카카오스토리에 직접 등록해보세요.' : 'Link copied! You can now paste it in KakaoStory.', 'success');
                  onClose();
                } catch (err) {
                  showToast(lang === 'ko' ? '링크 복사에 실패했습니다. URL을 직접 복사해주세요.' : 'Failed to copy link. Please copy the URL manually.', 'error');
                }
                document.body.removeChild(textArea);
              }
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-all font-medium shadow-lg"
          >
            <i className="ri-file-copy-line text-xl"></i>
            <span>{lang === 'ko' ? '링크 복사 (카카오스토리)' : 'Copy Link (KakaoStory)'}</span>
          </button>

          {/* 인스타그램 공유 */}
          <button
            onClick={() => {
              const url = `${window.location.origin}/${lang}/problem/${problemId}`;
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              
              if (isMobile) {
                const instagramUrl = `instagram://story-camera`;
                window.location.href = instagramUrl;
                
                setTimeout(() => {
                  navigator.clipboard.writeText(url).then(() => {
                    showToast(t.problem.instagramLinkCopied, 'success');
                  }).catch(() => {
                    showToast(`${t.problem.instagramCopyLink}\n${url}`, 'info');
                  });
                }, 2000);
              } else {
                navigator.clipboard.writeText(url).then(() => {
                  showToast(t.problem.linkCopiedInstagram, 'success');
                }).catch(() => {
                  showToast(`${t.problem.instagramCopyLink}\n${url}`, 'info');
                });
              }
              onClose();
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white rounded-lg transition-all font-medium shadow-lg"
          >
            <i className="ri-instagram-line text-xl"></i>
            <span>{t.problem.shareOnInstagram}</span>
          </button>

          {/* 트위터 공유 */}
          <button
            onClick={() => {
              const url = `${window.location.origin}/${lang}/problem/${problemId}`;
              const text = lang === 'ko' 
                ? `${problem.title} - 거북이 국물 문제를 풀어보세요!`
                : `${problem.title} - Try solving this Pelican Soup Riddle problem!`;
              const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
              window.open(twitterUrl, '_blank', 'width=550,height=420');
              onClose();
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-all font-medium"
          >
            <i className="ri-twitter-x-line text-xl"></i>
            <span>{t.problem.twitterShare}</span>
          </button>

          {/* 페이스북 공유 */}
          <button
            onClick={() => {
              const url = `${window.location.origin}/${lang}/problem/${problemId}`;
              const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
              window.open(facebookUrl, '_blank', 'width=550,height=420');
              onClose();
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium"
          >
            <i className="ri-facebook-line text-xl"></i>
            <span>{t.problem.facebookShare}</span>
          </button>

          {/* 링크 복사 */}
          <button
            onClick={async () => {
              const url = `${window.location.origin}/${lang}/problem/${problemId}`;
              try {
                await navigator.clipboard.writeText(url);
                showToast(t.problem.linkCopied, 'success');
                onClose();
              } catch (error) {
                const textArea = document.createElement('textarea');
                textArea.value = url;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                  document.execCommand('copy');
                  showToast(t.problem.linkCopied, 'success');
                  onClose();
                } catch (err) {
                  showToast(t.problem.copyLinkFail, 'error');
                }
                document.body.removeChild(textArea);
              }
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all font-medium border border-slate-600"
          >
            <i className="ri-file-copy-line text-xl"></i>
            <span>{t.problem.copyLink}</span>
          </button>
        </div>

        {/* URL 표시 */}
        <div className="mt-6 p-3 bg-slate-900/50 rounded-lg border border-slate-600/50">
          <p className="text-xs text-slate-400 mb-1">{t.problem.shareLink}</p>
          <p className="text-xs text-teal-400 break-all font-mono">
            {typeof window !== 'undefined' ? `${window.location.origin}/${lang}/problem/${problemId}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

