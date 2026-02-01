'use client';

import LevelBadge from './LevelBadge';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Title } from '@/types/progress';

type UserLabelProps = {
  userId: string;
  nickname?: string;
  level?: number;
  titleId?: number | null;
  showBadge?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showProfileImage?: boolean;
  profileImageUrl?: string | null;
};

export default function UserLabel({
  userId,
  nickname,
  level,
  titleId,
  showBadge = true,
  size = 'md',
  className = '',
  showProfileImage = false,
  profileImageUrl,
}: UserLabelProps) {
  const [userLevel, setUserLevel] = useState<number>(level || 1);
  const [userTitle, setUserTitle] = useState<Title | null>(null);
  const [displayName, setDisplayName] = useState<string>(nickname || '사용자');
  const [userProfileImage, setUserProfileImage] = useState<string | null>(profileImageUrl || null);

  const loadTitleById = async (id: number) => {
    try {
      const { data: title } = await supabase
        .from('titles')
        .select('*')
        .eq('id', id)
        .single();

      if (title) {
        setUserTitle(title);
      }
    } catch (error) {
      console.error('칭호 로드 오류:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const { data: progress } = await supabase
        .from('user_progress')
        .select('level, selected_title_id')
        .eq('user_id', userId)
        .single();

      if (progress) {
        setUserLevel(progress.level);
        if (progress.selected_title_id && !titleId) {
          loadTitleById(progress.selected_title_id);
        }
      }
    } catch (error) {
      console.error('유저 데이터 로드 오류:', error);
    }
  };

  const loadTitle = async () => {
    if (!titleId) return;

    try {
      const { data: title } = await supabase
        .from('titles')
        .select('*')
        .eq('id', titleId)
        .single();

      if (title) {
        setUserTitle(title);
      }
    } catch (error) {
      console.error('칭호 로드 오류:', error);
    }
  };

  useEffect(() => {
    // level이 제공되지 않은 경우 가져오기
    if (!level) {
      loadUserData();
    }

    // titleId가 제공된 경우 칭호 가져오기
    if (titleId) {
      loadTitle();
    }
  }, [userId, level, titleId]);

  const loadNickname = async () => {
    try {
      const { data: user } = await supabase
        .from('game_users')
        .select('nickname')
        .eq('id', userId)
        .single();

      if (user) {
        setDisplayName(user.nickname);
      }
    } catch (error) {
      console.error('닉네임 로드 오류:', error);
    }
  };

  useEffect(() => {
    if (!nickname) {
      loadNickname();
    }
  }, [userId, nickname]);

  const loadProfileImage = async () => {
    try {
      const { data: user } = await supabase
        .from('game_users')
        .select('profile_image_url, nickname')
        .eq('id', userId)
        .single();

      if (user) {
        setUserProfileImage(user.profile_image_url);
        if (!nickname && user.nickname) {
          setDisplayName(user.nickname);
        }
      }
    } catch (error) {
      console.error('프로필 이미지 로드 오류:', error);
    }
  };

  useEffect(() => {
    if (showProfileImage && !profileImageUrl) {
      loadProfileImage();
    } else if (profileImageUrl) {
      setUserProfileImage(profileImageUrl);
    }
  }, [userId, showProfileImage, profileImageUrl]);

  const imageSize = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {showProfileImage && (
        <div className={`${imageSize} rounded-full flex-shrink-0 overflow-hidden border border-slate-600`}>
          {userProfileImage ? (
            <img
              src={userProfileImage}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      {showBadge && (
        <LevelBadge level={userLevel} size={size} />
      )}
      <span className={`font-medium text-white ${textSize}`}>
        {displayName}
      </span>
      {userTitle && (
        <span className="text-xs sm:text-sm text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded">
          {userTitle.icon && <span className="mr-1">{userTitle.icon}</span>}
          {userTitle.name}
        </span>
      )}
    </div>
  );
}

