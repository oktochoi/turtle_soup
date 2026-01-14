'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import { handleError } from '@/lib/error-handler';

type UserReport = {
  id: string;
  reported_user_id: string;
  reporter_user_id: string | null;
  reporter_identifier: string | null;
  report_type: 'spam' | 'harassment' | 'inappropriate_content' | 'fake_account' | 'other';
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  reported_user_nickname?: string;
  reporter_nickname?: string;
};

export default function AdminReportsPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations();
  
  const [reports, setReports] = useState<UserReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState<'pending' | 'reviewed' | 'resolved' | 'dismissed'>('pending');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user, selectedStatus]);

  const checkAdminAccess = async () => {
    if (!user) {
      router.push(`/${lang}/auth/login`);
      return;
    }

    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (error || !userData || !userData.is_admin) {
        if (typeof window !== 'undefined' && (window as any).toastError) {
          (window as any).toastError(lang === 'ko' ? '관리자 권한이 필요합니다.' : 'Admin access required.');
        }
        router.push(`/${lang}`);
        return;
      }
    } catch (error) {
      handleError(error, '권한 확인', true);
      router.push(`/${lang}`);
    }
  };

  const loadReports = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('user_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      // 신고당한 유저와 신고한 유저의 닉네임 가져오기
      const reportsWithNicknames = await Promise.all((data || []).map(async (report) => {
        const reportData: UserReport = { ...report } as UserReport;

        // 신고당한 유저 닉네임
        if (report.reported_user_id) {
          const { data: reportedUser } = await supabase
            .from('game_users')
            .select('nickname')
            .eq('id', report.reported_user_id)
            .single();
          
          if (reportedUser) {
            reportData.reported_user_nickname = reportedUser.nickname;
          }
        }

        // 신고한 유저 닉네임
        if (report.reporter_user_id) {
          const { data: reporterUser } = await supabase
            .from('game_users')
            .select('nickname')
            .eq('auth_user_id', report.reporter_user_id)
            .single();
          
          if (reporterUser) {
            reportData.reporter_nickname = reporterUser.nickname;
          }
        }

        return reportData;
      }));

      setReports(reportsWithNicknames);
    } catch (error) {
      handleError(error, '신고 목록 로드', true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedReport) return;

    setIsUpdating(true);
    try {
      const updateData: any = {
        status: newStatus,
        admin_notes: adminNotes.trim() || null,
        reviewed_by: user?.id || null,
        reviewed_at: newStatus !== 'pending' ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('user_reports')
        .update(updateData)
        .eq('id', selectedReport.id);

      if (error) throw error;

      if (typeof window !== 'undefined' && (window as any).toastSuccess) {
        (window as any).toastSuccess(lang === 'ko' ? '신고 상태가 업데이트되었습니다.' : 'Report status updated.');
      }

      setShowDetailModal(false);
      setSelectedReport(null);
      setAdminNotes('');
      setNewStatus('pending');
      loadReports();
    } catch (error) {
      handleError(error, '신고 상태 업데이트', true);
    } finally {
      setIsUpdating(false);
    }
  };

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, { ko: string; en: string }> = {
      spam: { ko: '스팸', en: 'Spam' },
      harassment: { ko: '괴롭힘', en: 'Harassment' },
      inappropriate_content: { ko: '부적절한 내용', en: 'Inappropriate Content' },
      fake_account: { ko: '가짜 계정', en: 'Fake Account' },
      other: { ko: '기타', en: 'Other' },
    };
    return labels[type]?.[lang] || type;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      reviewed: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      resolved: 'bg-green-500/20 text-green-400 border-green-500/50',
      dismissed: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
    };
    return colors[status] || colors.pending;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { ko: string; en: string }> = {
      pending: { ko: '대기중', en: 'Pending' },
      reviewed: { ko: '검토됨', en: 'Reviewed' },
      resolved: { ko: '해결됨', en: 'Resolved' },
      dismissed: { ko: '기각됨', en: 'Dismissed' },
    };
    return labels[status]?.[lang] || status;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl">
        <div className="mb-6">
          <button
            onClick={() => router.push(`/${lang}`)}
            className="text-slate-400 hover:text-white transition-colors text-sm mb-4"
          >
            <i className="ri-arrow-left-line mr-2"></i>
            {t.common.back}
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            {lang === 'ko' ? '유저 신고 관리' : 'User Reports Management'}
          </h1>
          <p className="text-slate-400 text-sm">
            {lang === 'ko' ? '신고된 유저들을 검토하고 조치하세요.' : 'Review and take action on reported users.'}
          </p>
        </div>

        {/* 필터 */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {['all', 'pending', 'reviewed', 'resolved', 'dismissed'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                selectedStatus === status
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {status === 'all' 
                ? (lang === 'ko' ? '전체' : 'All')
                : getStatusLabel(status)
              }
            </button>
          ))}
        </div>

        {/* 신고 목록 */}
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-8 border border-slate-700/50 text-center">
              <p className="text-slate-400">
                {lang === 'ko' ? '신고가 없습니다.' : 'No reports found.'}
              </p>
            </div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                onClick={() => {
                  setSelectedReport(report);
                  setAdminNotes(report.admin_notes || '');
                  setNewStatus(report.status);
                  setShowDetailModal(true);
                }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 sm:p-6 border border-slate-700/50 hover:border-blue-500/50 transition-all cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStatusColor(report.status)}`}>
                        {getStatusLabel(report.status)}
                      </span>
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/50">
                        {getReportTypeLabel(report.report_type)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300 mb-1">
                      <span className="text-slate-400">{lang === 'ko' ? '신고당한 유저:' : 'Reported User:'}</span>{' '}
                      <span className="font-semibold">{report.reported_user_nickname || report.reported_user_id}</span>
                    </div>
                    <div className="text-sm text-slate-300 mb-1">
                      <span className="text-slate-400">{lang === 'ko' ? '신고 사유:' : 'Reason:'}</span>{' '}
                      {report.reason}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDate(report.created_at)}
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all text-sm font-semibold whitespace-nowrap">
                    {lang === 'ko' ? '상세보기' : 'View Details'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 상세 모달 */}
      {showDetailModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl p-6 sm:p-8 border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {lang === 'ko' ? '신고 상세 정보' : 'Report Details'}
              </h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedReport(null);
                  setAdminNotes('');
                }}
                className="text-slate-400 hover:text-white transition-colors text-2xl"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              {/* 신고 정보 */}
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                <div>
                  <span className="text-sm text-slate-400">{lang === 'ko' ? '신고 유형:' : 'Report Type:'}</span>
                  <div className="mt-1 font-semibold">{getReportTypeLabel(selectedReport.report_type)}</div>
                </div>
                <div>
                  <span className="text-sm text-slate-400">{lang === 'ko' ? '신고당한 유저:' : 'Reported User:'}</span>
                  <div className="mt-1 font-semibold">{selectedReport.reported_user_nickname || selectedReport.reported_user_id}</div>
                </div>
                <div>
                  <span className="text-sm text-slate-400">{lang === 'ko' ? '신고한 유저:' : 'Reporter:'}</span>
                  <div className="mt-1 font-semibold">
                    {selectedReport.reporter_nickname || selectedReport.reporter_identifier || (lang === 'ko' ? '익명' : 'Anonymous')}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-slate-400">{lang === 'ko' ? '신고 사유:' : 'Reason:'}</span>
                  <div className="mt-1">{selectedReport.reason}</div>
                </div>
                {selectedReport.description && (
                  <div>
                    <span className="text-sm text-slate-400">{lang === 'ko' ? '상세 설명:' : 'Description:'}</span>
                    <div className="mt-1 whitespace-pre-wrap">{selectedReport.description}</div>
                  </div>
                )}
                <div>
                  <span className="text-sm text-slate-400">{lang === 'ko' ? '신고 일시:' : 'Reported At:'}</span>
                  <div className="mt-1 text-sm">{formatDate(selectedReport.created_at)}</div>
                </div>
              </div>

              {/* 상태 업데이트 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {lang === 'ko' ? '상태 변경' : 'Change Status'}
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">{getStatusLabel('pending')}</option>
                  <option value="reviewed">{getStatusLabel('reviewed')}</option>
                  <option value="resolved">{getStatusLabel('resolved')}</option>
                  <option value="dismissed">{getStatusLabel('dismissed')}</option>
                </select>
              </div>

              {/* 관리자 메모 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {lang === 'ko' ? '관리자 메모' : 'Admin Notes'}
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={lang === 'ko' ? '관리자 메모를 입력하세요...' : 'Enter admin notes...'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={4}
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedReport(null);
                    setAdminNotes('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all font-semibold"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-semibold"
                >
                  {isUpdating 
                    ? (lang === 'ko' ? '업데이트 중...' : 'Updating...')
                    : (lang === 'ko' ? '상태 업데이트' : 'Update Status')
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

