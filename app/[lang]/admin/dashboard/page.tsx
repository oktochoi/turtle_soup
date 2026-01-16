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

      // 이벤트 통계
      const [eventsTotal, eventsToday, eventsWeek] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      // 전환율 계산
      const { data: conversionData } = await supabase.rpc('get_conversion_funnel');
      const conversionRate = conversionData && conversionData.length > 0 
        ? conversionData[conversionData.length - 1]?.conversion_rate || 0 
        : 0;

      // AI 학습 통계
      const [aiReportsTotal, aiReportsValid, aiPatterns, aiPatternsApplied] = await Promise.all([
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

  if (!stats) {
    return null;
  }

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
                <span className="text-2xl font-bold">{stats.users.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '오늘 가입' : 'Today'}</span>
                <span className="text-xl font-semibold">{stats.users.active_today.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '이번 주' : 'This Week'}</span>
                <span className="text-xl font-semibold">{stats.users.active_week.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '이번 달' : 'This Month'}</span>
                <span className="text-xl font-semibold">{stats.users.active_month.toLocaleString()}</span>
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
                <span className="text-2xl font-bold">{stats.rooms.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '활성' : 'Active'}</span>
                <span className="text-xl font-semibold text-green-400">{stats.rooms.active.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '오늘 생성' : 'Created Today'}</span>
                <span className="text-xl font-semibold">{stats.rooms.created_today.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '이번 주' : 'This Week'}</span>
                <span className="text-xl font-semibold">{stats.rooms.created_week.toLocaleString()}</span>
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
                <span className="text-2xl font-bold">{stats.problems.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '오늘 생성' : 'Created Today'}</span>
                <span className="text-xl font-semibold">{stats.problems.created_today.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '이번 주' : 'This Week'}</span>
                <span className="text-xl font-semibold">{stats.problems.created_week.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '총 좋아요' : 'Total Likes'}</span>
                <span className="text-xl font-semibold text-pink-400">{stats.problems.total_likes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '총 조회수' : 'Total Views'}</span>
                <span className="text-xl font-semibold text-cyan-400">{stats.problems.total_views.toLocaleString()}</span>
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
                <span className="text-2xl font-bold">{stats.events.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '오늘' : 'Today'}</span>
                <span className="text-xl font-semibold">{stats.events.today.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '이번 주' : 'This Week'}</span>
                <span className="text-xl font-semibold">{stats.events.week.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '전환율' : 'Conversion Rate'}</span>
                <span className="text-xl font-semibold text-green-400">{stats.events.conversion_rate.toFixed(2)}%</span>
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
                <span className="text-2xl font-bold">{stats.ai_learning.total_reports.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '학습 가능' : 'Valid for Learning'}</span>
                <span className="text-xl font-semibold text-green-400">{stats.ai_learning.valid_for_learning.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '발견된 패턴' : 'Patterns Found'}</span>
                <span className="text-xl font-semibold">{stats.ai_learning.patterns_found.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{lang === 'ko' ? '적용된 패턴' : 'Patterns Applied'}</span>
                <span className="text-xl font-semibold text-teal-400">{stats.ai_learning.patterns_applied.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 빠른 링크 */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-bold mb-4">
            {lang === 'ko' ? '빠른 링크' : 'Quick Links'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href={`/${lang}/admin/bug-reports`}
              className="p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-all text-center"
            >
              <i className="ri-bug-line text-2xl mb-2 block text-red-400"></i>
              <span className="text-sm">{lang === 'ko' ? '버그 리포트' : 'Bug Reports'}</span>
            </a>
            <a
              href={`/${lang}/admin/reports`}
              className="p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-all text-center"
            >
              <i className="ri-flag-line text-2xl mb-2 block text-orange-400"></i>
              <span className="text-sm">{lang === 'ko' ? '사용자 신고' : 'User Reports'}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

