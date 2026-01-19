'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import LevelBadge from '@/components/LevelBadge';
import type { UserProgress, Title, Achievement } from '@/types/progress';
import { requiredXP, xpToNextLevel } from '@/lib/progress';
import { useTranslations } from '@/hooks/useTranslations';
import { useAuth } from '@/lib/hooks/useAuth';
import { handleError } from '@/lib/error-handler';

export default function ProfilePage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const userId = resolvedParams.id;
  const router = useRouter();
  const t = useTranslations();

  const [user, setUser] = useState<any>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [titles, setTitles] = useState<Title[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userTitles, setUserTitles] = useState<number[]>([]);
  const [userAchievements, setUserAchievements] = useState<number[]>([]);
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actualSolveCount, setActualSolveCount] = useState<number>(0);
  const [receivedHearts, setReceivedHearts] = useState<number>(0);
  const [createdProblemsCount, setCreatedProblemsCount] = useState<number>(0);
  const { user: currentUser } = useAuth();
  
  // 문제 목록 및 정렬
  const [problems, setProblems] = useState<any[]>([]);
  const [filteredProblems, setFilteredProblems] = useState<any[]>([]);
  const [sortOption, setSortOption] = useState<'latest' | 'popular' | 'difficulty'>('latest');
  
  // 팔로우/팔로잉
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false);
  const [showFollowersModal, setShowFollowersModal] = useState<boolean>(false);
  const [showFollowingModal, setShowFollowingModal] = useState<boolean>(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [isLoadingFollowers, setIsLoadingFollowers] = useState<boolean>(false);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState<boolean>(false);
  
  // 프로필 사진 업로드
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 신고 관련 state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<'spam' | 'harassment' | 'inappropriate_content' | 'fake_account' | 'other'>('spam');
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  
  // 닉네임 수정 관련 state
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  
  // 계정 삭제 관련 state
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  // currentUser가 변경될 때마다 isOwnProfile 재확인
  useEffect(() => {
    if (user) {
      const ownProfile = (user.auth_user_id && currentUser?.id === user.auth_user_id) || 
                         (!user.auth_user_id && !currentUser);
      setIsOwnProfile(ownProfile);
    }
  }, [currentUser, user]);

  const loadProfile = async () => {
    try {
      // 유저 정보
      const { data: userData } = await supabase
        .from('game_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!userData) {
        router.push(`/${lang}`);
        return;
      }

      setUser(userData);

      // Progress
      const { data: progressData } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (progressData) {
        setProgress(progressData);
        setSelectedTitleId(progressData.selected_title_id);
      }

      // 모든 칭호
      const { data: allTitles } = await supabase
        .from('titles')
        .select('*')
        .order('id');

      if (allTitles) {
        setTitles(allTitles);
      }

      // 사용자 칭호
      const { data: userTitlesData } = await supabase
        .from('user_titles')
        .select('title_id')
        .eq('user_id', userId);

      if (userTitlesData) {
        setUserTitles(userTitlesData.map(t => t.title_id));
      }

      // 모든 업적
      const { data: allAchievements } = await supabase
        .from('achievements')
        .select('*')
        .order('id');

      if (allAchievements) {
        setAchievements(allAchievements);
      }

      // 사용자 업적
      const { data: userAchievementsData } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId);

      if (userAchievementsData) {
        setUserAchievements(userAchievementsData.map(a => a.achievement_id));
      }

      // 실제 해결한 문제 수 가져오기 (user_problem_solves에서)
      if (userData.auth_user_id) {
        const { count: solveCount } = await supabase
          .from('user_problem_solves')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userData.auth_user_id);

        setActualSolveCount(solveCount || 0);
      }

      // 받은 하트 수 계산 및 만든 문제 개수 계산
      // game_users의 auth_user_id로 problems 테이블에서 찾기
      if (userData.auth_user_id) {
        // 만든 문제 개수
        const { count: problemsCount } = await supabase
          .from('problems')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userData.auth_user_id);

        if (problemsCount !== null) {
          setCreatedProblemsCount(problemsCount);
        }

        // 받은 하트 수 (like_count 합계)
        const { data: userProblems } = await supabase
          .from('problems')
          .select('like_count')
          .eq('user_id', userData.auth_user_id);

        if (userProblems) {
          const totalHearts = userProblems.reduce((sum, p) => sum + (p.like_count || 0), 0);
          setReceivedHearts(totalHearts);
        }
      }

      // 자기 자신의 프로필인지 확인
      // currentUser가 로드될 때까지 기다려야 할 수 있으므로, useEffect로 업데이트
      const checkOwnProfile = () => {
        const ownProfile = (userData.auth_user_id && currentUser?.id === userData.auth_user_id) || 
                           (!userData.auth_user_id && !currentUser);
        console.log('Checking own profile:', { 
          auth_user_id: userData.auth_user_id, 
          currentUser_id: currentUser?.id, 
          ownProfile 
        });
        setIsOwnProfile(ownProfile);
      };
      checkOwnProfile();

      // 문제 목록 로드
      if (userData.auth_user_id) {
        await loadProblems(userData.auth_user_id);
      }

      // 팔로우/팔로잉 수 로드
      await loadFollowStats();

      // 현재 사용자가 이 프로필을 팔로우하는지 확인
      if (currentUser) {
        const currentGameUser = await supabase
          .from('game_users')
          .select('id')
          .eq('auth_user_id', currentUser.id)
          .single();
        
        if (currentGameUser.data) {
          const { data: followData } = await supabase
            .from('game_user_follows')
            .select('id')
            .eq('follower_id', currentGameUser.data.id)
            .eq('following_id', userId)
            .single();
          
          setIsFollowing(!!followData);
        }
      }
    } catch (error) {
      console.error('프로필 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProblems = async (authUserId: string) => {
    try {
      const { data: problemsData, error } = await supabase
        .from('problems')
        .select('*')
        .eq('user_id', authUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 각 문제에 평균 별점 추가
      const problemsWithRatings = await Promise.all(
        (problemsData || []).map(async (problem) => {
          const { data: ratings } = await supabase
            .from('problem_difficulty_ratings')
            .select('rating')
            .eq('problem_id', problem.id);

          let averageRating = 0;
          let ratingCount = 0;
          
          if (ratings && ratings.length > 0) {
            const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
            averageRating = Number((sum / ratings.length).toFixed(2));
            ratingCount = ratings.length;
          }

          return {
            ...problem,
            average_rating: averageRating,
            rating_count: ratingCount,
          };
        })
      );

      setProblems(problemsWithRatings);
      filterAndSortProblems(problemsWithRatings, sortOption);
    } catch (error) {
      console.error('문제 로드 오류:', error);
    }
  };

  const loadFollowStats = async () => {
    try {
      // 팔로워 수
      const { count: followersCount } = await supabase
        .from('game_user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId);
      
      setFollowersCount(followersCount || 0);

      // 팔로잉 수
      const { count: followingCount } = await supabase
        .from('game_user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId);
      
      setFollowingCount(followingCount || 0);
    } catch (error) {
      console.error('팔로우 통계 로드 오류:', error);
    }
  };

  const filterAndSortProblems = (problemsList: any[], sort: 'latest' | 'popular' | 'difficulty') => {
    // 최신순만 사용 (생성일 기준 내림차순)
    let sorted = [...problemsList];
    sorted.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setFilteredProblems(sorted);
  };

  useEffect(() => {
    if (problems.length > 0) {
      filterAndSortProblems(problems, 'latest');
    }
  }, [problems]);

  const loadFollowers = async () => {
    if (isLoadingFollowers) return;
    setIsLoadingFollowers(true);
    try {
      // 팔로워 목록 가져오기 (이 사용자를 팔로우하는 사람들)
      // 1단계: follower_id 목록 가져오기
      const { data: followsData, error: followsError } = await supabase
        .from('game_user_follows')
        .select('follower_id')
        .eq('following_id', userId);

      if (followsError) throw followsError;

      if (!followsData || followsData.length === 0) {
        setFollowersList([]);
        return;
      }

      // 2단계: 각 follower_id에 해당하는 사용자 정보 가져오기
      const followerIds = followsData.map(f => f.follower_id);
      const { data: usersData, error: usersError } = await supabase
        .from('game_users')
        .select('id, nickname, profile_image_url, referral_code')
        .in('id', followerIds);

      if (usersError) throw usersError;

      if (usersData) {
        setFollowersList(usersData);
      }
    } catch (error) {
      console.error('팔로워 목록 로드 오류:', error);
    } finally {
      setIsLoadingFollowers(false);
    }
  };

  const loadFollowing = async () => {
    if (isLoadingFollowing) return;
    setIsLoadingFollowing(true);
    try {
      // 팔로잉 목록 가져오기 (이 사용자가 팔로우하는 사람들)
      // 1단계: following_id 목록 가져오기
      const { data: followsData, error: followsError } = await supabase
        .from('game_user_follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (followsError) throw followsError;

      if (!followsData || followsData.length === 0) {
        setFollowingList([]);
        return;
      }

      // 2단계: 각 following_id에 해당하는 사용자 정보 가져오기
      const followingIds = followsData.map(f => f.following_id);
      const { data: usersData, error: usersError } = await supabase
        .from('game_users')
        .select('id, nickname, profile_image_url, referral_code')
        .in('id', followingIds);

      if (usersError) throw usersError;

      if (usersData) {
        setFollowingList(usersData);
      }
    } catch (error) {
      console.error('팔로잉 목록 로드 오류:', error);
    } finally {
      setIsLoadingFollowing(false);
    }
  };

  const handleShowFollowers = async () => {
    setShowFollowersModal(true);
    if (followersList.length === 0) {
      await loadFollowers();
    }
  };

  const handleShowFollowing = async () => {
    setShowFollowingModal(true);
    if (followingList.length === 0) {
      await loadFollowing();
    }
  };

  const handleFollow = async () => {
    if (!currentUser) {
      router.push(`/${lang}/auth/login`);
      return;
    }

    try {
      // 현재 사용자의 game_user_id 가져오기
      const { data: currentGameUser } = await supabase
        .from('game_users')
        .select('id')
        .eq('auth_user_id', currentUser.id)
        .single();

      if (!currentGameUser) {
        showToast(lang === 'ko' ? '사용자 정보를 찾을 수 없습니다.' : 'User not found.', 'error');
        return;
      }

      if (isFollowing) {
        // 언팔로우
        const { error } = await supabase
          .from('game_user_follows')
          .delete()
          .eq('follower_id', currentGameUser.id)
          .eq('following_id', userId);

        if (error) throw error;
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
        showToast(lang === 'ko' ? '언팔로우했습니다.' : 'Unfollowed.', 'success');
      } else {
        // 팔로우
        const { error } = await supabase
          .from('game_user_follows')
          .insert({
            follower_id: currentGameUser.id,
            following_id: userId,
          });

        if (error) throw error;
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        showToast(lang === 'ko' ? '팔로우했습니다.' : 'Followed.', 'success');

        // 팔로우 알림 생성 (팔로우당한 사람에게)
        try {
          // 현재 사용자의 닉네임 가져오기
          const { data: followerUser } = await supabase
            .from('game_users')
            .select('nickname')
            .eq('id', currentGameUser.id)
            .single();

          if (followerUser) {
            // 알림 생성
            await supabase
              .from('notifications')
              .insert({
                user_id: userId, // 팔로우당한 사람의 ID
                type: 'follow',
                title: lang === 'ko' ? '새 팔로워' : 'New Follower',
                message: lang === 'ko' 
                  ? `${followerUser.nickname}님이 팔로우했습니다.`
                  : `${followerUser.nickname} started following you.`,
                related_user_id: currentGameUser.id, // 팔로우한 사람의 ID
                is_read: false,
              });
          }
        } catch (notificationError) {
          // 알림 생성 실패는 무시 (중요한 기능이 아니므로)
          console.error('팔로우 알림 생성 오류:', notificationError);
        }
      }
    } catch (error) {
      console.error('팔로우 오류:', error);
      showToast(lang === 'ko' ? '팔로우 처리에 실패했습니다.' : 'Follow action failed.', 'error');
    }
  };

  // Toast 헬퍼 함수
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    if (typeof window !== 'undefined' && (window as any)[`toast${type.charAt(0).toUpperCase() + type.slice(1)}`]) {
      (window as any)[`toast${type.charAt(0).toUpperCase() + type.slice(1)}`](message);
    } else {
      alert(message);
    }
  };

  const handleProfileImageClick = () => {
    if (isOwnProfile && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleProfileImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isOwnProfile || !user) return;

    // 이미지 파일만 허용
    if (!file.type.startsWith('image/')) {
      showToast(lang === 'ko' ? '이미지 파일만 업로드 가능합니다.' : 'Only image files are allowed.', 'error');
      return;
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast(lang === 'ko' ? '파일 크기는 5MB 이하여야 합니다.' : 'File size must be less than 5MB.', 'error');
      return;
    }

    setIsUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const filePath = `profile-images/${fileName}`;

      // Supabase Storage에 업로드 (avatars bucket 사용)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        // 버킷이 없는 경우 명확한 오류 메시지 제공
        if (uploadError.message?.includes('Bucket') || uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
          showToast(
            lang === 'ko' 
              ? 'Storage 버킷이 설정되지 않았습니다. Supabase 대시보드에서 "avatars" 버킷을 생성해주세요.' 
              : 'Storage bucket not configured. Please create "avatars" bucket in Supabase dashboard.',
            'error'
          );
          console.error('Storage 버킷 오류:', uploadError);
          console.log('버킷 생성 방법: Supabase 대시보드 > Storage > New bucket > 이름: avatars, Public: 체크');
          return;
        }
        throw uploadError;
      }

      // Public URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // game_users 테이블 업데이트
      const { error: updateError } = await supabase
        .from('game_users')
        .update({ profile_image_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      // 로컬 상태 업데이트
      setUser({ ...user, profile_image_url: publicUrl });
      showToast(lang === 'ko' ? '프로필 사진이 업데이트되었습니다.' : 'Profile image updated.', 'success');
    } catch (error: any) {
      console.error('프로필 사진 업로드 오류:', error);
      showToast(lang === 'ko' ? '프로필 사진 업로드에 실패했습니다.' : 'Profile image upload failed.', 'error');
    } finally {
      setIsUploadingImage(false);
      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectTitle = async (titleId: number) => {
    if (!progress) return;

    try {
      const { error } = await supabase
        .from('user_progress')
        .update({ selected_title_id: titleId })
        .eq('user_id', userId);

      if (error) throw error;

      setSelectedTitleId(titleId);
      setProgress({ ...progress, selected_title_id: titleId });
      showToast(lang === 'ko' ? '칭호가 변경되었습니다.' : 'Title has been changed.', 'success');
    } catch (error) {
      console.error('칭호 선택 오류:', error);
      showToast(t.profile.selectTitleFail, 'error');
    }
  };

  // 닉네임 수정 함수
  const handleEditNickname = () => {
    if (!user) {
      console.error('handleEditNickname: user is null');
      return;
    }
    console.log('handleEditNickname called, current nickname:', user.nickname);
    setNewNickname(user.nickname);
    setIsEditingNickname(true);
  };
  
  const handleCancelEditNickname = () => {
    setIsEditingNickname(false);
    setNewNickname('');
  };
  
  // 계정 삭제 함수
  const handleDeleteAccount = async () => {
    if (confirmDeleteText !== '삭제') {
      showToast(lang === 'ko' ? '"삭제"를 정확히 입력해주세요.' : 'Please type "삭제" exactly.', 'error');
      return;
    }
    
    setIsDeletingAccount(true);
    try {
      const response = await fetch('/api/user/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '계정 삭제에 실패했습니다.');
      }
      
      showToast(lang === 'ko' ? '계정이 삭제되었습니다.' : 'Account has been deleted.', 'success');
      
      // 로그아웃 처리
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.signOut();
      
      // 홈으로 리다이렉트
      setTimeout(() => {
        router.push(`/${lang}`);
        router.refresh();
      }, 1000);
    } catch (error: any) {
      handleError(error, '계정 삭제', true);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleSaveNickname = async () => {
    if (!user || !newNickname.trim()) {
      showToast(lang === 'ko' ? '닉네임을 입력해주세요.' : 'Please enter a nickname.', 'error');
      return;
    }
    
    if (newNickname.trim().length < 2 || newNickname.trim().length > 20) {
      showToast(lang === 'ko' ? '닉네임은 2자 이상 20자 이하여야 합니다.' : 'Nickname must be between 2 and 20 characters.', 'error');
      return;
    }
    
    // 자기 자신의 프로필인지 확인
    const isOwnProfile = (user.auth_user_id && currentUser?.id === user.auth_user_id) || 
                         (!user.auth_user_id && !currentUser);
    
    if (!isOwnProfile) {
      showToast(lang === 'ko' ? '자신의 닉네임만 수정할 수 있습니다.' : 'You can only edit your own nickname.', 'error');
      return;
    }
    
    setIsSavingNickname(true);
    try {
      const { error } = await supabase
        .from('game_users')
        .update({ nickname: newNickname.trim() })
        .eq('id', userId);
      
      if (error) throw error;
      
      // users 테이블도 업데이트 (auth_user_id가 있는 경우)
      if (user.auth_user_id) {
        const { error: usersError } = await supabase
          .from('users')
          .update({ nickname: newNickname.trim() })
          .eq('id', user.auth_user_id);
        
        if (usersError) {
          console.error('users 테이블 업데이트 오류:', usersError);
        }
      }
      
      setUser({ ...user, nickname: newNickname.trim() });
      setIsEditingNickname(false);
      showToast(lang === 'ko' ? '닉네임이 변경되었습니다.' : 'Nickname has been changed.', 'success');
    } catch (error) {
      handleError(error, '닉네임 변경', true);
    } finally {
      setIsSavingNickname(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 to-amber-500 border-yellow-400';
      case 'epic': return 'from-purple-500 to-pink-500 border-purple-400';
      case 'rare': return 'from-blue-500 to-cyan-500 border-blue-400';
      default: return 'from-slate-500 to-slate-600 border-slate-400';
    }
  };

  const handleSubmitReport = async () => {
    if (!reportReason.trim()) {
      if (typeof window !== 'undefined' && (window as any).toastWarning) {
        (window as any).toastWarning(lang === 'ko' ? '신고 사유를 입력해주세요.' : 'Please enter a report reason.');
      }
      return;
    }

    // 자기 자신을 신고하는 것 방지
    if (user?.auth_user_id && currentUser?.id === user.auth_user_id) {
      if (typeof window !== 'undefined' && (window as any).toastWarning) {
        (window as any).toastWarning(lang === 'ko' ? '자기 자신을 신고할 수 없습니다.' : 'You cannot report yourself.');
      }
      return;
    }

    setIsSubmittingReport(true);
    try {
      // 게스트 사용자 식별자 가져오기
      let userIdentifier: string | null = null;
      if (!currentUser) {
        if (typeof window !== 'undefined') {
          userIdentifier = localStorage.getItem('guest_id') || `guest_${Date.now()}`;
          if (!localStorage.getItem('guest_id')) {
            localStorage.setItem('guest_id', userIdentifier);
          }
        }
      }

      const reportData = {
        reported_user_id: userId, // game_users의 id
        reporter_user_id: currentUser?.id || null,
        reporter_identifier: userIdentifier,
        report_type: reportType,
        reason: reportReason.trim(),
        description: reportDescription.trim() || null,
        status: 'pending',
      };

      const { error } = await supabase
        .from('user_reports')
        .insert(reportData);

      if (error) {
        // 중복 신고 에러 처리
        if (error.message?.includes('already reported') || error.message?.includes('24 hours')) {
          if (typeof window !== 'undefined' && (window as any).toastWarning) {
            (window as any).toastWarning(lang === 'ko' ? '24시간 이내에 같은 사유로 이미 신고하셨습니다.' : 'You have already reported this user for the same reason within the last 24 hours.');
          }
          return;
        }
        throw error;
      }

      if (typeof window !== 'undefined' && (window as any).toastSuccess) {
        (window as any).toastSuccess(lang === 'ko' ? '신고가 접수되었습니다. 검토 후 조치하겠습니다.' : 'Report submitted. We will review and take action.');
      }

      // 모달 닫기 및 상태 초기화
      setShowReportModal(false);
      setReportType('spam');
      setReportReason('');
      setReportDescription('');
    } catch (error) {
      handleError(error, '유저 신고', true);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{t.profile.loadingProfile}</p>
        </div>
      </div>
    );
  }

  if (!user || !progress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{t.profile.profileNotFound}</p>
          <Link href={`/${lang}`}>
            <button className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg">
              {t.common.home}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // 현재 레벨에서의 XP 계산
  let totalRequiredForCurrentLevel = 0;
  for (let i = 1; i < progress.level; i++) {
    totalRequiredForCurrentLevel += requiredXP(i);
  }
  
  const currentLevelXP = progress.xp - totalRequiredForCurrentLevel;
  const nextLevelXP = requiredXP(progress.level);
  const xpProgress = Math.min(100, Math.max(0, (currentLevelXP / nextLevelXP) * 100));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
        <div className="mb-6">
          <Link href={`/${lang}`}>
            <button className="text-slate-400 hover:text-white transition-colors text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>

        {/* 프로필 헤더 - Instagram 스타일 */}
        <div className="bg-slate-900 border-b border-slate-800 mb-6">
          <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
              {/* 프로필 사진 */}
              <div className="flex-shrink-0 flex justify-center sm:justify-start">
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageUpload}
                    className="hidden"
                    disabled={!isOwnProfile || isUploadingImage}
                  />
                  {user.profile_image_url ? (
                    <div
                      onClick={handleProfileImageClick}
                      className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-slate-700 ${
                        isOwnProfile ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
                      } relative group`}
                    >
                      <img
                        src={user.profile_image_url}
                        alt={user.nickname}
                        className="w-full h-full object-cover"
                      />
                      {isOwnProfile && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <i className="ri-camera-line text-white text-xl"></i>
                        </div>
                      )}
                      {isUploadingImage && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={handleProfileImageClick}
                      className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center text-3xl sm:text-4xl font-bold border-2 border-slate-700 ${
                        isOwnProfile ? 'cursor-pointer hover:opacity-80 transition-opacity relative group' : ''
                      }`}
                    >
                      {(isEditingNickname ? newNickname : user.nickname).charAt(0).toUpperCase()}
                      {isOwnProfile && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                          <i className="ri-camera-line text-white text-xl"></i>
                        </div>
                      )}
                      {isUploadingImage && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* 프로필 정보 */}
              <div className="flex-1 min-w-0">
                {/* 사용자 이름 및 버튼 */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
                  <div className="flex-1">
                    {isEditingNickname ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newNickname}
                          onChange={(e) => setNewNickname(e.target.value)}
                          className="text-xl sm:text-2xl font-semibold bg-slate-800 border border-slate-600 rounded px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                          maxLength={20}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNickname();
                            else if (e.key === 'Escape') handleCancelEditNickname();
                          }}
                        />
                        <button
                          onClick={handleSaveNickname}
                          disabled={isSavingNickname}
                          className="px-3 py-1 bg-teal-500 hover:bg-teal-600 text-white rounded text-sm font-semibold disabled:opacity-50"
                        >
                          {lang === 'ko' ? '저장' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelEditNickname}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-semibold"
                        >
                          {lang === 'ko' ? '취소' : 'Cancel'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h1 
                          onClick={isOwnProfile ? handleEditNickname : undefined}
                          className={`text-xl sm:text-2xl font-semibold ${isOwnProfile ? 'cursor-pointer hover:text-teal-400 transition-colors' : ''}`}
                          title={isOwnProfile ? (lang === 'ko' ? '클릭하여 닉네임 수정' : 'Click to edit nickname') : undefined}
                        >
                          {user.nickname}
                        </h1>
                      </div>
                    )}
                  </div>
                  
                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2">
                    {isOwnProfile ? (
                      <>
                        <Link href={`/${lang}/create-problem`}>
                          <button className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors">
                            {lang === 'ko' ? '문제 만들기' : 'Create Problem'}
                          </button>
                        </Link>
                        <button
                          onClick={handleEditNickname}
                          className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                          {lang === 'ko' ? '프로필 편집' : 'Edit Profile'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleFollow}
                          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                            isFollowing
                              ? 'bg-slate-800 hover:bg-slate-700 text-white'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                        >
                          {isFollowing ? (lang === 'ko' ? '팔로잉' : 'Following') : (lang === 'ko' ? '팔로우' : 'Follow')}
                        </button>
                        <button
                          onClick={() => setShowReportModal(true)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors"
                          title={lang === 'ko' ? '신고하기' : 'Report'}
                        >
                          <i className="ri-flag-line"></i>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 통계 */}
                <div className="flex items-center gap-4 sm:gap-6 mb-4">
                  <div className="text-center">
                    <span className="text-base sm:text-lg font-semibold">{createdProblemsCount}</span>
                    <span className="text-sm text-slate-400 ml-1">{lang === 'ko' ? '게시물' : 'posts'}</span>
                  </div>
                  <button
                    onClick={handleShowFollowers}
                    className="text-center hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <span className="text-base sm:text-lg font-semibold">{followersCount}</span>
                    <span className="text-sm text-slate-400 ml-1">{lang === 'ko' ? '팔로워' : 'followers'}</span>
                  </button>
                  <button
                    onClick={handleShowFollowing}
                    className="text-center hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <span className="text-base sm:text-lg font-semibold">{followingCount}</span>
                    <span className="text-sm text-slate-400 ml-1">{lang === 'ko' ? '팔로잉' : 'following'}</span>
                  </button>
                </div>

                {/* 사용자 설명 */}
                <div className="mb-4 space-y-2">
                  <div className="text-sm text-white">
                    <LevelBadge level={progress.level} size="md" />
                  </div>
                  {/* 추천인 코드 */}
                  {user.referral_code && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-400">{lang === 'ko' ? '추천인 코드:' : 'Referral Code:'}</span>
                      <code className="bg-slate-800 px-2 py-1 rounded text-cyan-400 font-mono font-semibold">
                        {user.referral_code}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(user.referral_code);
                          showToast(lang === 'ko' ? '추천인 코드가 복사되었습니다.' : 'Referral code copied.', 'success');
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                        title={lang === 'ko' ? '복사하기' : 'Copy'}
                      >
                        <i className="ri-file-copy-line"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 문제 목록 - Thread 스타일 (최신순만) */}
        {filteredProblems.length > 0 ? (
          <div className="container mx-auto px-4 max-w-4xl space-y-4">
            {filteredProblems.map((problem) => (
              <Link key={problem.id} href={`/${lang}/problem/${problem.id}`}>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:bg-slate-800 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-white mb-2 line-clamp-2">
                        {problem.title}
                      </h3>
                      {problem.content && (
                        <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                          {problem.content.replace(/<[^>]*>/g, '').substring(0, 150)}...
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <i className="ri-heart-line"></i>
                          {problem.like_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-chat-3-line"></i>
                          {problem.comment_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-eye-line"></i>
                          {problem.view_count || 0}
                        </span>
                        <span className="text-slate-500">
                          {new Date(problem.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : createdProblemsCount > 0 ? (
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center py-12">
              <p className="text-slate-400">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</p>
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center py-12">
              <div className="text-4xl mb-4 text-slate-600">
                <i className="ri-image-add-line"></i>
              </div>
              <p className="text-slate-400 mb-2">
                {isOwnProfile 
                  ? (lang === 'ko' ? '아직 만든 문제가 없습니다.' : 'No problems created yet.')
                  : (lang === 'ko' ? '아직 만든 문제가 없습니다.' : 'No problems yet.')
                }
              </p>
              {isOwnProfile && (
                <Link href={`/${lang}/create-problem`}>
                  <button className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors">
                    {lang === 'ko' ? '첫 문제 만들기' : 'Create First Problem'}
                  </button>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* 칭호 섹션 - Thread 스타일 */}
        {userTitles.length > 0 && (
          <div className="container mx-auto px-4 max-w-4xl mt-6">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <i className="ri-medal-line text-purple-400"></i>
                {lang === 'ko' ? '칭호' : 'Titles'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {titles
                  .filter(t => userTitles.includes(t.id))
                  .map((title) => (
                    <button
                      key={title.id}
                      onClick={() => handleSelectTitle(title.id)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        selectedTitleId === title.id
                          ? `bg-gradient-to-r ${getRarityColor(title.rarity)} text-white border-transparent ring-2 ring-white/50`
                          : `bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600`
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {title.icon && <span className="text-xl">{title.icon}</span>}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {lang === 'en' && (title as any).name_en ? (title as any).name_en : title.name}
                          </div>
                          {title.description && (
                            <div className="text-xs opacity-75 mt-1 truncate">
                              {lang === 'en' && (title as any).description_en ? (title as any).description_en : title.description}
                            </div>
                          )}
                        </div>
                        {selectedTitleId === title.id && (
                          <i className="ri-check-line text-white"></i>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* 업적 섹션 - Thread 스타일 */}
        {userAchievements.length > 0 && (
          <div className="container mx-auto px-4 max-w-4xl mt-6">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <i className="ri-award-line text-yellow-400"></i>
                {lang === 'ko' ? '업적' : 'Achievements'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {achievements
                  .filter(a => userAchievements.includes(a.id))
                  .slice(0, 6)
                  .map((achievement) => (
                    <div
                      key={achievement.id}
                      className={`p-3 rounded-lg border-2 bg-gradient-to-r ${getRarityColor(achievement.rarity)} text-white border-transparent`}
                    >
                      <div className="flex items-center gap-2">
                        {achievement.icon && <span className="text-xl">{achievement.icon}</span>}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {lang === 'en' && (achievement as any).name_en ? (achievement as any).name_en : achievement.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              {userAchievements.length > 6 && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-slate-400">
                    {lang === 'ko' 
                      ? `+ ${userAchievements.length - 6}개의 업적 더보기`
                      : `+ ${userAchievements.length - 6} more achievements`
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 계정 삭제 섹션 (자기 자신의 프로필일 때만 표시) */}
        {((user.auth_user_id && currentUser?.id === user.auth_user_id) || (!user.auth_user_id && !currentUser)) && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-red-700/50 mt-6">
            <h2 className="text-xl font-bold mb-4 text-red-400">
              <i className="ri-error-warning-line mr-2"></i>
              {lang === 'ko' ? '계정 삭제' : 'Delete Account'}
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              {lang === 'ko' 
                ? '계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.' 
                : 'Deleting your account will permanently delete all your data and cannot be recovered.'}
            </p>
            <button
              onClick={() => setShowDeleteAccountModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all font-semibold"
            >
              <i className="ri-delete-bin-line mr-2"></i>
              {lang === 'ko' ? '계정 삭제하기' : 'Delete Account'}
            </button>
          </div>
        )}
      </div>

      {/* 신고 모달 */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl p-6 sm:p-8 border border-slate-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {lang === 'ko' ? '유저 신고하기' : 'Report User'}
              </h2>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportType('spam');
                  setReportReason('');
                  setReportDescription('');
                }}
                className="text-slate-400 hover:text-white transition-colors text-2xl"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              {/* 신고 유형 선택 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {lang === 'ko' ? '신고 유형' : 'Report Type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'spam', label: lang === 'ko' ? '스팸' : 'Spam', icon: 'ri-spam-line' },
                    { value: 'harassment', label: lang === 'ko' ? '괴롭힘' : 'Harassment', icon: 'ri-user-forbid-line' },
                    { value: 'inappropriate_content', label: lang === 'ko' ? '부적절한 내용' : 'Inappropriate', icon: 'ri-prohibited-line' },
                    { value: 'fake_account', label: lang === 'ko' ? '가짜 계정' : 'Fake Account', icon: 'ri-user-unfollow-line' },
                    { value: 'other', label: lang === 'ko' ? '기타' : 'Other', icon: 'ri-more-line' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setReportType(type.value as any)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        reportType === type.value
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <i className={type.icon}></i>
                      <span>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 신고 사유 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {lang === 'ko' ? '신고 사유 *' : 'Reason *'}
                </label>
                <input
                  type="text"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder={lang === 'ko' ? '신고 사유를 입력하세요' : 'Enter report reason'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  maxLength={200}
                />
              </div>

              {/* 상세 설명 (선택사항) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {lang === 'ko' ? '상세 설명 (선택사항)' : 'Description (Optional)'}
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder={lang === 'ko' ? '추가 설명을 입력하세요' : 'Enter additional details'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {reportDescription.length} / 500
                </p>
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setReportType('spam');
                    setReportReason('');
                    setReportDescription('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all font-semibold"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleSubmitReport}
                  disabled={!reportReason.trim() || isSubmittingReport}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-semibold"
                >
                  {isSubmittingReport 
                    ? (lang === 'ko' ? '제출 중...' : 'Submitting...')
                    : (lang === 'ko' ? '신고하기' : 'Submit Report')
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 계정 삭제 확인 모달 */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl p-6 sm:p-8 border border-red-700 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-red-400">
                <i className="ri-error-warning-line mr-2"></i>
                {lang === 'ko' ? '계정 삭제 확인' : 'Confirm Account Deletion'}
              </h2>
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setConfirmDeleteText('');
                }}
                className="text-slate-400 hover:text-white transition-colors text-2xl"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <p className="text-sm text-red-300 font-semibold mb-2">
                  {lang === 'ko' ? '⚠️ 경고' : '⚠️ Warning'}
                </p>
                <ul className="text-xs text-red-200 space-y-1 list-disc list-inside">
                  <li>{lang === 'ko' ? '계정이 영구적으로 삭제됩니다.' : 'Your account will be permanently deleted.'}</li>
                  <li>{lang === 'ko' ? '모든 데이터(문제, 댓글, 기록 등)가 삭제됩니다.' : 'All data (problems, comments, records, etc.) will be deleted.'}</li>
                  <li>{lang === 'ko' ? '이 작업은 되돌릴 수 없습니다.' : 'This action cannot be undone.'}</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {lang === 'ko' ? '확인을 위해 "삭제"를 입력하세요' : 'Type "삭제" to confirm'}
                </label>
                <input
                  type="text"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder="삭제"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDeleteAccountModal(false);
                    setConfirmDeleteText('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all font-semibold"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={confirmDeleteText !== '삭제' || isDeletingAccount}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-semibold"
                >
                  {isDeletingAccount 
                    ? (lang === 'ko' ? '삭제 중...' : 'Deleting...')
                    : (lang === 'ko' ? '계정 삭제' : 'Delete Account')
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 팔로워 목록 모달 */}
      {showFollowersModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl p-6 sm:p-8 border border-slate-700 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {lang === 'ko' ? '팔로워' : 'Followers'}
              </h2>
              <button
                onClick={() => setShowFollowersModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-2xl"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-3">
              {isLoadingFollowers ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                  <p className="text-slate-400 mt-2">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</p>
                </div>
              ) : followersList.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400">{lang === 'ko' ? '팔로워가 없습니다.' : 'No followers yet.'}</p>
                </div>
              ) : (
                followersList.map((follower) => (
                  <Link
                    key={follower.id}
                    href={`/${lang}/profile/${follower.id}`}
                    onClick={() => setShowFollowersModal(false)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    {follower.profile_image_url ? (
                      <img
                        src={follower.profile_image_url}
                        alt={follower.nickname}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                        {follower.nickname.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{follower.nickname}</div>
                      {follower.referral_code && (
                        <div className="text-xs text-slate-400 truncate">{follower.referral_code}</div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 팔로잉 목록 모달 */}
      {showFollowingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl p-6 sm:p-8 border border-slate-700 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {lang === 'ko' ? '팔로잉' : 'Following'}
              </h2>
              <button
                onClick={() => setShowFollowingModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-2xl"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-3">
              {isLoadingFollowing ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                  <p className="text-slate-400 mt-2">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</p>
                </div>
              ) : followingList.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400">{lang === 'ko' ? '팔로잉 중인 사용자가 없습니다.' : 'Not following anyone yet.'}</p>
                </div>
              ) : (
                followingList.map((following) => (
                  <Link
                    key={following.id}
                    href={`/${lang}/profile/${following.id}`}
                    onClick={() => setShowFollowingModal(false)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    {following.profile_image_url ? (
                      <img
                        src={following.profile_image_url}
                        alt={following.nickname}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                        {following.nickname.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{following.nickname}</div>
                      {following.referral_code && (
                        <div className="text-xs text-slate-400 truncate">{following.referral_code}</div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

