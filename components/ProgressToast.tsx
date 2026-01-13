'use client';

import { useEffect, useState } from 'react';
import LevelBadge from './LevelBadge';
import type { Title, Achievement } from '@/types/progress';

type ToastData = {
  type: 'levelup' | 'achievement' | 'title';
  level?: number;
  achievement?: Achievement;
  title?: Title;
};

type ProgressToastProps = {
  toast: ToastData | null;
  onClose: () => void;
};

export default function ProgressToast({ toast, onClose }: ProgressToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // 애니메이션 완료 후 제거
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="bg-slate-800/95 backdrop-blur-xl rounded-xl p-4 sm:p-6 border border-slate-700 shadow-2xl min-w-[280px] sm:min-w-[320px]">
        {toast.type === 'levelup' && toast.level && (
          <div className="flex items-center gap-3">
            <div className="text-4xl">🎉</div>
            <div className="flex-1">
              <div className="text-lg font-bold text-white mb-1">레벨업!</div>
              <LevelBadge level={toast.level} size="md" />
              <div className="text-sm text-slate-300 mt-1">축하합니다!</div>
            </div>
          </div>
        )}

        {toast.type === 'achievement' && toast.achievement && (
          <div className="flex items-center gap-3">
            <div className="text-4xl">{toast.achievement.icon || '🏆'}</div>
            <div className="flex-1">
              <div className="text-lg font-bold text-white mb-1">업적 달성!</div>
              <div className="text-sm font-semibold text-yellow-400 mb-1">
                {toast.achievement.name}
              </div>
              <div className="text-xs text-slate-300">
                {toast.achievement.description}
              </div>
              {(toast.achievement.reward_xp > 0 || toast.achievement.reward_points > 0) && (
                <div className="text-xs text-green-400 mt-1">
                  보상: +{toast.achievement.reward_xp} XP, +{toast.achievement.reward_points} P
                </div>
              )}
            </div>
          </div>
        )}

        {toast.type === 'title' && toast.title && (
          <div className="flex items-center gap-3">
            <div className="text-4xl">{toast.title.icon || '👑'}</div>
            <div className="flex-1">
              <div className="text-lg font-bold text-white mb-1">칭호 획득!</div>
              <div className="text-sm font-semibold text-purple-400 mb-1">
                {toast.title.name}
              </div>
              {toast.title.description && (
                <div className="text-xs text-slate-300">
                  {toast.title.description}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

