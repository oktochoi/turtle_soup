'use client';

import { use, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import { handleError } from '@/lib/error-handler';

type DashboardStats = {
  users: {
    total: number;
    active_today: number;
    active_week: number;
    active_month: number;
  };
  rooms: {
    total: number;
    active: number;
    created_today: number;
    created_week: number;
  };
  problems: {
    total: number;
    created_today: number;
    created_week: number;
    total_likes: number;
    total_views: number;
  };
  events: {
    total: number;
    today: number;
    week: number;
    conversion_rate: number;
  };
  ai_learning: {
    total_reports: number;
    valid_for_learning: number;
    patterns_found: number;
    patterns_applied: number;
  };
  bug_reports: {
    total: number;
    pending: number;
    reviewed: number;
    fixed: number;
    rejected: number;
  };
  user_reports: {
    total: number;
    pending: number;
    reviewed: number;
    resolved: number;
    dismissed: number;
  };
};

export default function AdminDashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const { user, isLoading: authLoading } = useAuth();
  const supabase = createClient();
  const t = useTranslations();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
      // 30초마다 통계 새로고침
      const interval = setInterval(loadStats, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const checkAdmin = async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.is_admin || false);
    } catch (error) {
      console.error('관리자 확인 오류:', error);
      setIsAdmin(false);
    }
  };

  const loadStats = async () => {
    try {
      setIsLoading(true);

      // 사용자 통계
      const [usersTotal, usersToday, usersWeek, usersMonth] = await Promise.all([
        supabase.from('game_users').select('id', { count: 'exact', head: true }),
        supabase
          .from('game_users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('game_users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('game_users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      // 방 통계
      const [roomsTotal, roomsActive, roomsToday, roomsWeek] = await Promise.all([
        supabase.from('rooms').select('id', { count: 'exact', head: true }),
        supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase
          .from('rooms')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('rooms')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      // 문제 통계
      const [problemsTotal, problemsToday, problemsWeek, problemsLikes, problemsViews] = await Promise.all([
        supabase.from('problems').select('id', { count: 'exact', head: true }),
        supabase
          .from('problems')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('problems')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('problems').select('like_count'),
        supabase.from('problems').select('view_count'),
      ]);

      const totalLikes = problemsLikes.data?.reduce((sum, p) => sum + (p.like_count || 0), 0) || 0;
      const totalViews = problemsViews.data?.reduce((sum, p) => sum + (p.view_count || 0), 0) || 0;

      // 이벤트 통계 (테이블이 있는 경우에만)
      let eventsTotal = { count: 0 };
      let eventsToday = { count: 0 };
      let eventsWeek = { count: 0 };
      try {
        // 오늘 날짜 계산 (UTC 기준)
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const [eventsTotalRes, eventsTodayRes, eventsWeekRes] = await Promise.all([
          supabase.from('events').select('*', { count: 'exact', head: true }),
          supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString()),
          supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', weekStart.toISOString()),
        ]);
        
        // count 값 확인 및 디버깅
        if (process.env.NODE_ENV === 'development') {
          console.log('이벤트 통계 디버그:', {
            total: { count: eventsTotalRes.count, error: eventsTotalRes.error },
            today: { count: eventsTodayRes.count, error: eventsTodayRes.error },
            week: { count: eventsWeekRes.count, error: eventsWeekRes.error },
          });
        }
        
        // count가 숫자 타입인지 확인하고 설정
        if (!eventsTotalRes.error) {
          const totalCount = typeof eventsTotalRes.count === 'number' ? eventsTotalRes.count : 0;
          eventsTotal = { count: totalCount };
        } else {
          console.warn('이벤트 전체 통계 오류:', eventsTotalRes.error);
        }
        
        if (!eventsTodayRes.error) {
          const todayCount = typeof eventsTodayRes.count === 'number' ? eventsTodayRes.count : 0;
          eventsToday = { count: todayCount };
        } else {
          console.warn('이벤트 오늘 통계 오류:', eventsTodayRes.error);
        }
        
        if (!eventsWeekRes.error) {
          const weekCount = typeof eventsWeekRes.count === 'number' ? eventsWeekRes.count : 0;
          eventsWeek = { count: weekCount };
        } else {
          console.warn('이벤트 이번 주 통계 오류:', eventsWeekRes.error);
        }
      } catch (err) {
        console.warn('이벤트 통계를 가져올 수 없습니다:', err);
      }

      // 전환율 계산 (함수가 있는 경우에만)
      let conversionRate = 0;
      try {
        // 함수는 DATE 타입을 받지만, Supabase RPC는 파라미터를 명시적으로 전달해야 함
        // 빈 객체로 호출하면 기본값(NULL)이 사용됨
        const { data: conversionData, error: conversionError } = await supabase.rpc('get_conversion_funnel', {});
        
        if (conversionError) {
          // 400 에러는 함수가 없거나 파라미터 문제일 수 있음
          if (conversionError.code === 'PGRST116' || conversionError.code === '42883') {
            // 함수가 없거나 찾을 수 없음 - 무시
            if (process.env.NODE_ENV === 'development') {
              console.log('전환율 함수를 사용할 수 없습니다 (함수가 없거나 권한 없음)');
            }
          } else {
            console.warn('전환율 계산 함수 오류:', conversionError);
          }
        } else if (conversionData && conversionData.length > 0) {
          // 마지막 단계(정답 제출)의 전환율 사용
          const lastStep = conversionData[conversionData.length - 1];
          conversionRate = Number(lastStep?.conversion_rate) || 0;
          
          if (process.env.NODE_ENV === 'development') {
            console.log('전환율 데이터:', conversionData, '최종 전환율:', conversionRate);
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('전환율 데이터가 없습니다 (이벤트 데이터 없음)');
          }
        }
      } catch (err: any) {
        // 네트워크 오류나 기타 예외 처리
        if (err?.code === 'PGRST116' || err?.message?.includes('function') || err?.message?.includes('not found')) {
          // 함수가 없음 - 무시
          if (process.env.NODE_ENV === 'development') {
            console.log('전환율 함수를 사용할 수 없습니다 (함수 없음)');
          }
        } else {
          console.warn('전환율 계산 함수를 사용할 수 없습니다:', err);
        }
      }

      // AI 학습 통계 (테이블이 있는 경우에만)
      let aiReportsTotal = { count: 0 };
      let aiReportsValid = { count: 0 };
      let aiPatterns = { count: 0 };
      let aiPatternsApplied = { count: 0 };
      try {
        const [aiReportsTotalRes, aiReportsValidRes, aiPatternsRes, aiPatternsAppliedRes] = await Promise.all([
          supabase
            .from('ai_bug_reports')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('ai_bug_reports')
            .select('id', { count: 'exact', head: true })
            .eq('ignore_for_learning', false)
            .eq('studied', false),
          supabase
            .from('ai_learning_patterns')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('ai_learning_patterns')
            .select('id', { count: 'exact', head: true })
            .eq('applied', true),
        ]);
        if (!aiReportsTotalRes.error) aiReportsTotal = { count: aiReportsTotalRes.count ?? 0 };
        if (!aiReportsValidRes.error) aiReportsValid = { count: aiReportsValidRes.count ?? 0 };
        if (!aiPatternsRes.error) aiPatterns = { count: aiPatternsRes.count ?? 0 };
        if (!aiPatternsAppliedRes.error) aiPatternsApplied = { count: aiPatternsAppliedRes.count ?? 0 };
      } catch (err) {
        console.warn('AI 학습 통계를 가져올 수 없습니다:', err);
      }

      // 버그 리포트 통계
      let bugReportsTotal = { count: 0 };
      let bugReportsPending = { count: 0 };
      let bugReportsReviewed = { count: 0 };
      let bugReportsFixed = { count: 0 };
      let bugReportsRejected = { count: 0 };
      try {
        const [bugReportsTotalRes, bugReportsPendingRes, bugReportsReviewedRes, bugReportsFixedRes, bugReportsRejectedRes] = await Promise.all([
          supabase.from('ai_bug_reports').select('id', { count: 'exact', head: true }),
          supabase.from('ai_bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('ai_bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'reviewed'),
          supabase.from('ai_bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'fixed'),
          supabase.from('ai_bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        ]);
        if (bugReportsTotalRes.error) {
          console.error('버그 리포트 전체 통계 오류:', bugReportsTotalRes.error);
        } else {
          bugReportsTotal = { count: bugReportsTotalRes.count ?? 0 };
        }
        if (bugReportsPendingRes.error) {
          console.error('버그 리포트 대기중 통계 오류:', bugReportsPendingRes.error);
        } else {
          bugReportsPending = { count: bugReportsPendingRes.count ?? 0 };
        }
        if (bugReportsReviewedRes.error) {
          console.error('버그 리포트 검토됨 통계 오류:', bugReportsReviewedRes.error);
        } else {
          bugReportsReviewed = { count: bugReportsReviewedRes.count ?? 0 };
        }
        if (bugReportsFixedRes.error) {
          console.error('버그 리포트 수정됨 통계 오류:', bugReportsFixedRes.error);
        } else {
          bugReportsFixed = { count: bugReportsFixedRes.count ?? 0 };
        }
        if (bugReportsRejectedRes.error) {
          console.error('버그 리포트 거부됨 통계 오류:', bugReportsRejectedRes.error);
        } else {
          bugReportsRejected = { count: bugReportsRejectedRes.count ?? 0 };
        }
      } catch (err) {
        console.error('버그 리포트 통계를 가져올 수 없습니다:', err);
      }

      // 사용자 신고 통계
      let userReportsTotal = { count: 0 };
      let userReportsPending = { count: 0 };
      let userReportsReviewed = { count: 0 };
      let userReportsResolved = { count: 0 };
      let userReportsDismissed = { count: 0 };
      try {
        const [userReportsTotalRes, userReportsPendingRes, userReportsReviewedRes, userReportsResolvedRes, userReportsDismissedRes] = await Promise.all([
          supabase.from('user_reports').select('id', { count: 'exact', head: true }),
          supabase.from('user_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('user_reports').select('id', { count: 'exact', head: true }).eq('status', 'reviewed'),
          supabase.from('user_reports').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
          supabase.from('user_reports').select('id', { count: 'exact', head: true }).eq('status', 'dismissed'),
        ]);
        if (userReportsTotalRes.error) {
          console.error('사용자 신고 전체 통계 오류:', userReportsTotalRes.error);
        } else {
          userReportsTotal = { count: userReportsTotalRes.count ?? 0 };
        }
        if (userReportsPendingRes.error) {
          console.error('사용자 신고 대기중 통계 오류:', userReportsPendingRes.error);
        } else {
          userReportsPending = { count: userReportsPendingRes.count ?? 0 };
        }
        if (userReportsReviewedRes.error) {
          console.error('사용자 신고 검토됨 통계 오류:', userReportsReviewedRes.error);
        } else {
          userReportsReviewed = { count: userReportsReviewedRes.count ?? 0 };
        }
        if (userReportsResolvedRes.error) {
          console.error('사용자 신고 해결됨 통계 오류:', userReportsResolvedRes.error);
        } else {
          userReportsResolved = { count: userReportsResolvedRes.count ?? 0 };
        }
        if (userReportsDismissedRes.error) {
          console.error('사용자 신고 기각됨 통계 오류:', userReportsDismissedRes.error);
        } else {
          userReportsDismissed = { count: userReportsDismissedRes.count ?? 0 };
        }
      } catch (err) {
        console.error('사용자 신고 통계를 가져올 수 없습니다:', err);
      }

      setStats({
        users: {
          total: usersTotal.count || 0,
          active_today: usersToday.count || 0,
          active_week: usersWeek.count || 0,
          active_month: usersMonth.count || 0,
        },
        rooms: {
          total: roomsTotal.count || 0,
          active: roomsActive.count || 0,
          created_today: roomsToday.count || 0,
          created_week: roomsWeek.count || 0,
        },
        problems: {
          total: problemsTotal.count || 0,
          created_today: problemsToday.count || 0,
          created_week: problemsWeek.count || 0,
          total_likes: totalLikes,
          total_views: totalViews,
        },
        events: {
          total: eventsTotal.count || 0,
          today: eventsToday.count || 0,
          week: eventsWeek.count || 0,
          conversion_rate: conversionRate,
        },
        ai_learning: {
          total_reports: aiReportsTotal.count || 0,
          valid_for_learning: aiReportsValid.count || 0,
          patterns_found: aiPatterns.count || 0,
          patterns_applied: aiPatternsApplied.count || 0,
        },
        bug_reports: {
          total: bugReportsTotal.count || 0,
          pending: bugReportsPending.count || 0,
          reviewed: bugReportsReviewed.count || 0,
          fixed: bugReportsFixed.count || 0,
          rejected: bugReportsRejected.count || 0,
        },
        user_reports: {
          total: userReportsTotal.count || 0,
          pending: userReportsPending.count || 0,
          reviewed: userReportsReviewed.count || 0,
          resolved: userReportsResolved.count || 0,
          dismissed: userReportsDismissed.count || 0,
        },
      });
    } catch (error) {
      handleError(error, '통계 로드', true);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{lang === 'ko' ? '접근 권한이 없습니다.' : 'Access Denied'}</p>
          <p className="text-slate-400">{lang === 'ko' ? '관리자만 접근할 수 있습니다.' : 'Only administrators can access this page.'}</p>
        </div>
      </div>
    );
  }

  // stats가 없으면 기본값 사용
  const displayStats = stats || {
    users: { total: 0, active_today: 0, active_week: 0, active_month: 0 },
    rooms: { total: 0, active: 0, created_today: 0, created_week: 0 },
    problems: { total: 0, created_today: 0, created_week: 0, total_likes: 0, total_views: 0 },
    events: { total: 0, today: 0, week: 0, conversion_rate: 0 },
    ai_learning: { total_reports: 0, valid_for_learning: 0, patterns_found: 0, patterns_applied: 0 },
    bug_reports: { total: 0, pending: 0, reviewed: 0, fixed: 0, rejected: 0 },
    user_reports: { total: 0, pending: 0, reviewed: 0, resolved: 0, dismissed: 0 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8">
          {lang === 'ko' ? '관리자 대시보드' : 'Admin Dashboard'}
        </h1>

        {/* 통계 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          {/* 사용자 통계 */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-xl font-bold mb-4 text-teal-400">
              <i className="ri-user-line mr-2"></i>
              {lang === 'ko' ? '사용자' : 'Users'}
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '전체' : 'Total'}</span>
                <span className="text-2xl font-bold">{displayStats.users.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '오늘 가입' : 'Today'}</span>
                <span className="text-xl font-semibold">{displayStats.users.active_today.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '이번 주' : 'This Week'}</span>
                <span className="text-xl font-semibold">{displayStats.users.active_week.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '이번 달' : 'This Month'}</span>
                <span className="text-xl font-semibold">{displayStats.users.active_month.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 방 통계 */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-xl font-bold mb-4 text-blue-400">
              <i className="ri-door-open-line mr-2"></i>
              {lang === 'ko' ? '방' : 'Rooms'}
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '전체' : 'Total'}</span>
                <span className="text-2xl font-bold">{displayStats.rooms.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '활성' : 'Active'}</span>
                <span className="text-xl font-semibold text-green-400">{displayStats.rooms.active.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '오늘 생성' : 'Created Today'}</span>
                <span className="text-xl font-semibold">{displayStats.rooms.created_today.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '이번 주' : 'This Week'}</span>
                <span className="text-xl font-semibold">{displayStats.rooms.created_week.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 문제 통계 */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-xl font-bold mb-4 text-purple-400">
              <i className="ri-question-line mr-2"></i>
              {lang === 'ko' ? '문제' : 'Problems'}
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '전체' : 'Total'}</span>
                <span className="text-2xl font-bold">{displayStats.problems.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '오늘 생성' : 'Created Today'}</span>
                <span className="text-xl font-semibold">{displayStats.problems.created_today.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '이번 주' : 'This Week'}</span>
                <span className="text-xl font-semibold">{displayStats.problems.created_week.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '총 좋아요' : 'Total Likes'}</span>
                <span className="text-xl font-semibold text-pink-400">{displayStats.problems.total_likes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '총 조회수' : 'Total Views'}</span>
                <span className="text-xl font-semibold text-cyan-400">{displayStats.problems.total_views.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 이벤트 통계 */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">
              <i className="ri-bar-chart-line mr-2"></i>
              {lang === 'ko' ? '이벤트' : 'Events'}
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '전체' : 'Total'}</span>
                <span className="text-2xl font-bold">{displayStats.events.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '오늘' : 'Today'}</span>
                <span className="text-xl font-semibold">{displayStats.events.today.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '이번 주' : 'This Week'}</span>
                <span className="text-xl font-semibold">{displayStats.events.week.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '전환율' : 'Conversion Rate'}</span>
                <span className="text-xl font-semibold text-green-400">{displayStats.events.conversion_rate.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* AI 학습 통계 */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-xl font-bold mb-4 text-orange-400">
              <i className="ri-brain-line mr-2"></i>
              {lang === 'ko' ? 'AI 학습' : 'AI Learning'}
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '전체 리포트' : 'Total Reports'}</span>
                <span className="text-2xl font-bold">{displayStats.ai_learning.total_reports.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '학습 가능' : 'Valid for Learning'}</span>
                <span className="text-xl font-semibold text-green-400">{displayStats.ai_learning.valid_for_learning.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '발견된 패턴' : 'Patterns Found'}</span>
                <span className="text-xl font-semibold">{displayStats.ai_learning.patterns_found.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '적용된 패턴' : 'Patterns Applied'}</span>
                <span className="text-xl font-semibold text-teal-400">{displayStats.ai_learning.patterns_applied.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 버그 리포트 및 사용자 신고 요약 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
          {/* 버그 리포트 요약 */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50 hover:border-red-500/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-red-400">
                <i className="ri-bug-line mr-2"></i>
                {lang === 'ko' ? '버그 리포트' : 'Bug Reports'}
              </h2>
              <a
                href={`/${lang}/admin/bug-reports`}
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                {lang === 'ko' ? '전체 보기' : 'View All'} <i className="ri-arrow-right-line"></i>
              </a>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '전체' : 'Total'}</span>
                <span className="text-2xl font-bold">{displayStats.bug_reports.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '대기중' : 'Pending'}</span>
                <span className="text-xl font-semibold text-yellow-400">{displayStats.bug_reports.pending.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '검토됨' : 'Reviewed'}</span>
                <span className="text-xl font-semibold text-blue-400">{displayStats.bug_reports.reviewed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '수정됨' : 'Fixed'}</span>
                <span className="text-xl font-semibold text-green-400">{displayStats.bug_reports.fixed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '거부됨' : 'Rejected'}</span>
                <span className="text-xl font-semibold text-red-400">{displayStats.bug_reports.rejected.toLocaleString()}</span>
              </div>
            </div>
            {displayStats.bug_reports.pending > 0 && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  <i className="ri-alert-line mr-2"></i>
                  {lang === 'ko' 
                    ? `${displayStats.bug_reports.pending}개의 대기중인 버그 리포트가 있습니다.`
                    : `${displayStats.bug_reports.pending} bug reports are pending review.`}
                </p>
              </div>
            )}
          </div>

          {/* 사용자 신고 요약 */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50 hover:border-orange-500/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-orange-400">
                <i className="ri-flag-line mr-2"></i>
                {lang === 'ko' ? '사용자 신고' : 'User Reports'}
              </h2>
              <a
                href={`/${lang}/admin/reports`}
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                {lang === 'ko' ? '전체 보기' : 'View All'} <i className="ri-arrow-right-line"></i>
              </a>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '전체' : 'Total'}</span>
                <span className="text-2xl font-bold">{displayStats.user_reports.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '대기중' : 'Pending'}</span>
                <span className="text-xl font-semibold text-yellow-400">{displayStats.user_reports.pending.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '검토됨' : 'Reviewed'}</span>
                <span className="text-xl font-semibold text-blue-400">{displayStats.user_reports.reviewed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '해결됨' : 'Resolved'}</span>
                <span className="text-xl font-semibold text-green-400">{displayStats.user_reports.resolved.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '기각됨' : 'Dismissed'}</span>
                <span className="text-xl font-semibold text-slate-400">{displayStats.user_reports.dismissed.toLocaleString()}</span>
              </div>
            </div>
            {displayStats.user_reports.pending > 0 && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  <i className="ri-alert-line mr-2"></i>
                  {lang === 'ko' 
                    ? `${displayStats.user_reports.pending}개의 대기중인 사용자 신고가 있습니다.`
                    : `${displayStats.user_reports.pending} user reports are pending review.`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 빠른 링크 */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-bold mb-4">
            <i className="ri-links-line mr-2"></i>
            {lang === 'ko' ? '빠른 링크' : 'Quick Links'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href={`/${lang}/admin/bug-reports`}
              className="p-4 bg-slate-700/50 hover:bg-red-500/20 border border-slate-600 hover:border-red-500/50 rounded-lg transition-all text-center group"
            >
              <i className="ri-bug-line text-3xl mb-2 block text-red-400 group-hover:scale-110 transition-transform"></i>
              <span className="text-sm font-semibold">{lang === 'ko' ? '버그 리포트' : 'Bug Reports'}</span>
              {displayStats.bug_reports.pending > 0 && (
                <span className="block mt-1 text-xs text-yellow-400">
                  {displayStats.bug_reports.pending} {lang === 'ko' ? '대기중' : 'pending'}
                </span>
              )}
            </a>
            <a
              href={`/${lang}/admin/reports`}
              className="p-4 bg-slate-700/50 hover:bg-orange-500/20 border border-slate-600 hover:border-orange-500/50 rounded-lg transition-all text-center group"
            >
              <i className="ri-flag-line text-3xl mb-2 block text-orange-400 group-hover:scale-110 transition-transform"></i>
              <span className="text-sm font-semibold">{lang === 'ko' ? '사용자 신고' : 'User Reports'}</span>
              {displayStats.user_reports.pending > 0 && (
                <span className="block mt-1 text-xs text-yellow-400">
                  {displayStats.user_reports.pending} {lang === 'ko' ? '대기중' : 'pending'}
                </span>
              )}
            </a>
            <a
              href={`/${lang}/admin/dashboard`}
              className="p-4 bg-slate-700/50 hover:bg-teal-500/20 border border-slate-600 hover:border-teal-500/50 rounded-lg transition-all text-center group"
            >
              <i className="ri-dashboard-line text-3xl mb-2 block text-teal-400 group-hover:scale-110 transition-transform"></i>
              <span className="text-sm font-semibold">{lang === 'ko' ? '대시보드' : 'Dashboard'}</span>
            </a>
            <a
              href={`/${lang}`}
              className="p-4 bg-slate-700/50 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 rounded-lg transition-all text-center group"
            >
              <i className="ri-home-line text-3xl mb-2 block text-slate-400 group-hover:scale-110 transition-transform"></i>
              <span className="text-sm font-semibold">{lang === 'ko' ? '홈으로' : 'Home'}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

