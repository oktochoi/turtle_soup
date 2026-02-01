'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import { handleError } from '@/lib/error-handler';

type BugReport = {
  id: string;
  problem_id: string | null;
  user_id: string | null;
  user_identifier: string | null;
  bug_type: 'wrong_answer' | 'wrong_yes_no' | 'wrong_irrelevant' | 'wrong_similarity' | 'other';
  question_text: string;
  ai_suggested_answer: string;
  expected_answer: string | null;
  user_answer: string | null;
  correct_answer: string;
  similarity_score: number | null;
  problem_content: string | null;
  hints: string[] | null;
  language: 'ko' | 'en';
  status: 'pending' | 'reviewed' | 'fixed' | 'rejected';
  admin_notes: string | null;
  ignore_for_learning: boolean;
  studied: boolean;
  created_at: string;
  updated_at: string;
};

export default function AdminBugReportsPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const supabase = createClient();
  const t = useTranslations();
  
  const [reports, setReports] = useState<BugReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLearning, setFilterLearning] = useState<string>('all'); // 'all', 'include', 'exclude'
  const [hideProcessed, setHideProcessed] = useState(true); // 학습 처리된 리포트 숨기기
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRunningLearning, setIsRunningLearning] = useState(false);
  const [learningResult, setLearningResult] = useState<any>(null);
  const [isRunningAutoFilter, setIsRunningAutoFilter] = useState(false);
  const [autoFilterResult, setAutoFilterResult] = useState<any>(null);
  const [showAutoFilterPreview, setShowAutoFilterPreview] = useState(false);
  const [autoFilterPreview, setAutoFilterPreview] = useState<any>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [hasLearned, setHasLearned] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      checkAdminAccess();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      loadReports();
      checkLearningStatus();
    }
  }, [user, filterStatus, filterLearning, hideProcessed]);

  const checkLearningStatus = async () => {
    // 24시간 제한 제거: 관리자가 원할 때 언제든지 학습 실행 가능
    // 이 함수는 더 이상 사용하지 않지만 호환성을 위해 유지
    setHasLearned(false);
  };

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
        .from('ai_bug_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (filterLearning === 'include') {
        query = query.eq('ignore_for_learning', false);
      } else if (filterLearning === 'exclude') {
        query = query.eq('ignore_for_learning', true);
      }

      // 학습된 리포트 숨기기 (기본값: true)
      if (hideProcessed) {
        query = query.eq('studied', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      handleError(error, '버그 리포트 로드', true);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLearningExclusion = async (reportId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('ai_bug_reports')
        .update({ ignore_for_learning: !currentValue })
        .eq('id', reportId);

      if (error) throw error;

      // 로컬 상태 업데이트
      setReports(prev => prev.map(r => 
        r.id === reportId ? { ...r, ignore_for_learning: !currentValue } : r
      ));

      if (typeof window !== 'undefined' && (window as any).toastSuccess) {
        (window as any).toastSuccess(
          lang === 'ko' 
            ? (!currentValue ? '학습에서 제외되었습니다.' : '학습에 포함되었습니다.')
            : (!currentValue ? 'Excluded from learning.' : 'Included in learning.')
        );
      }
    } catch (error) {
      handleError(error, '학습 제외 토글', true);
    }
  };

  const updateReportStatus = async () => {
    if (!selectedReport) return;

    try {
      setIsUpdating(true);
      const { error } = await supabase
        .from('ai_bug_reports')
        .update({
          status: selectedReport.status,
          admin_notes: adminNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      setReports(prev => prev.map(r => 
        r.id === selectedReport.id 
          ? { ...r, status: selectedReport.status, admin_notes: adminNotes || null }
          : r
      ));

      setShowDetailModal(false);
      if (typeof window !== 'undefined' && (window as any).toastSuccess) {
        (window as any).toastSuccess(lang === 'ko' ? '업데이트되었습니다.' : 'Updated.');
      }
    } catch (error) {
      handleError(error, '리포트 업데이트', true);
    } finally {
      setIsUpdating(false);
    }
  };

  const runLearningCycle = async () => {
    try {
      setIsRunningLearning(true);
      setLearningResult(null);

      console.log('학습 사이클 시작...');
      const { data, error } = await supabase.rpc('run_ai_learning_cycle');

      if (error) {
        console.error('학습 사이클 RPC 오류 상세:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          errorString: JSON.stringify(error, null, 2),
        });
        throw error;
      }

      console.log('학습 사이클 결과:', data);

      if (!data) {
        throw new Error('학습 사이클 실행 결과가 없습니다.');
      }

      setLearningResult(data);
      setHasLearned(false); // 24시간 제한 제거로 항상 false
      
      if (typeof window !== 'undefined' && (window as any).toastSuccess) {
        (window as any).toastSuccess(
          lang === 'ko' 
            ? `✅ 학습 완료! ${data?.patterns_found || 0}개 패턴 발견, ${data?.patterns_applied || 0}개 적용, ${data?.errors_synced || 0}개 오류 패턴 동기화, ${data?.reports_marked || 0}개 리포트 학습 완료 표시.`
            : `✅ Learning complete! ${data?.patterns_found || 0} patterns found, ${data?.patterns_applied || 0} applied, ${data?.errors_synced || 0} error patterns synced, ${data?.reports_marked || 0} reports marked as studied.`
        );
      }
      // 리포트 다시 로드
      loadReports();
      // 학습 상태 다시 확인
      checkLearningStatus();
    } catch (error: any) {
      console.error('학습 실행 오류 상세:', {
        error,
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorDetails: error?.details,
        errorHint: error?.hint,
        errorString: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
        stack: error?.stack,
      });
      // 더 자세한 오류 메시지 표시
      const errorMessage = error?.message || error?.details || error?.hint || '알 수 없는 오류가 발생했습니다.';
      if (typeof window !== 'undefined' && (window as any).toastError) {
        (window as any).toastError(
          lang === 'ko' 
            ? `학습 실행 실패: ${errorMessage}`
            : `Learning failed: ${errorMessage}`
        );
      }
      handleError(error, '학습 실행', true);
    } finally {
      setIsRunningLearning(false);
    }
  };

  const previewAutoFilter = async () => {
    try {
      setIsRunningAutoFilter(true);
      setAutoFilterPreview(null);

      const { data, error } = await supabase.rpc('run_auto_filter_bug_reports', {
        dry_run: true
      });

      if (error) throw error;

      setAutoFilterPreview(data);
      setShowAutoFilterPreview(true);
    } catch (error) {
      handleError(error, '자동 필터링 미리보기', true);
    } finally {
      setIsRunningAutoFilter(false);
    }
  };

  const runAutoFilter = async () => {
    try {
      setIsRunningAutoFilter(true);
      setAutoFilterResult(null);

      const { data, error } = await supabase.rpc('run_auto_filter_bug_reports', {
        dry_run: false
      });

      if (error) throw error;

      setAutoFilterResult(data);
      if (typeof window !== 'undefined' && (window as any).toastSuccess) {
        (window as any).toastSuccess(
          lang === 'ko' 
            ? `자동 필터링 완료: ${data?.filtered_count || 0}개 리포트가 학습에서 제외되었습니다.`
            : `Auto filter complete: ${data?.filtered_count || 0} reports excluded from learning.`
        );
      }
      // 리포트 다시 로드
      loadReports();
      setShowAutoFilterPreview(false);
    } catch (error) {
      handleError(error, '자동 필터링 실행', true);
    } finally {
      setIsRunningAutoFilter(false);
    }
  };

  const bulkIncludeAll = async () => {
    try {
      setIsBulkUpdating(true);
      
      const { error } = await supabase
        .from('ai_bug_reports')
        .update({ ignore_for_learning: false })
        .eq('status', 'pending')
        .eq('ignore_for_learning', true);

      if (error) throw error;

      if (typeof window !== 'undefined' && (window as any).toastSuccess) {
        (window as any).toastSuccess(
          lang === 'ko' 
            ? '모든 리포트가 학습에 포함되었습니다.'
            : 'All reports have been included in learning.'
        );
      }
      loadReports();
    } catch (error) {
      handleError(error, '일괄 포함', true);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const bulkExcludeAll = async () => {
    try {
      setIsBulkUpdating(true);
      
      const { error } = await supabase
        .from('ai_bug_reports')
        .update({ ignore_for_learning: true })
        .eq('status', 'pending')
        .eq('ignore_for_learning', false);

      if (error) throw error;

      if (typeof window !== 'undefined' && (window as any).toastSuccess) {
        (window as any).toastSuccess(
          lang === 'ko' 
            ? '모든 리포트가 학습에서 제외되었습니다.'
            : 'All reports have been excluded from learning.'
        );
      }
      loadReports();
    } catch (error) {
      handleError(error, '일괄 제외', true);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const getBugTypeLabel = (type: string) => {
    const labels: Record<string, { ko: string; en: string }> = {
      wrong_answer: { ko: '정답 오류', en: 'Wrong Answer' },
      wrong_yes_no: { ko: '예/아니오 오류', en: 'Yes/No Error' },
      wrong_irrelevant: { ko: '무관 판단 오류', en: 'Irrelevant Error' },
      wrong_similarity: { ko: '유사도 오류', en: 'Similarity Error' },
      other: { ko: '기타', en: 'Other' }
    };
    const langKey = lang as 'ko' | 'en';
    return labels[type]?.[langKey] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { ko: string; en: string }> = {
      pending: { ko: '대기중', en: 'Pending' },
      reviewed: { ko: '검토됨', en: 'Reviewed' },
      fixed: { ko: '수정됨', en: 'Fixed' },
      rejected: { ko: '거부됨', en: 'Rejected' }
    };
    const langKey = lang as 'ko' | 'en';
    return labels[status]?.[langKey] || status;
  };

  const validReportsCount = reports.filter(r => !r.ignore_for_learning && !r.studied && r.status === 'pending').length;
  // 관리자가 원할 때 언제든지 학습 실행 가능
  const canRunLearning = validReportsCount > 0;

  if (isLoading && reports.length === 0) {
    return (
      <div className="max-w-7xl">
        <div className="text-center py-20">
          <i className="ri-loader-4-line text-4xl animate-spin text-teal-400"></i>
          <p className="mt-4 text-slate-400">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {lang === 'ko' ? 'AI 버그 리포트 검수' : 'AI Bug Reports Review'}
          </h1>
          <p className="text-slate-400">
            {lang === 'ko' 
              ? '버그 리포트를 검토하고 학습 포함/제외를 설정하세요.'
              : 'Review bug reports and set learning inclusion/exclusion.'}
          </p>
        </div>

        {/* 통계 및 학습 실행 */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-4">
              <div className="text-sm">
                <span className="text-slate-400">{lang === 'ko' ? '전체 리포트:' : 'Total Reports:'} </span>
                <span className="font-bold text-teal-400">{reports.length}</span>
              </div>
              <div className="text-sm">
                <span className="text-slate-400">{lang === 'ko' ? '학습 가능 리포트:' : 'Valid for Learning:'} </span>
                <span className="font-bold text-green-400">
                  {validReportsCount}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-slate-400">{lang === 'ko' ? '학습 제외:' : 'Excluded:'} </span>
                <span className="font-bold text-red-400">
                  {reports.filter(r => r.ignore_for_learning).length}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={bulkIncludeAll}
                disabled={isBulkUpdating}
                className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/50 rounded-lg font-semibold hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title={lang === 'ko' ? '모든 리포트를 학습에 포함' : 'Include all reports in learning'}
              >
                {isBulkUpdating ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    {lang === 'ko' ? '처리 중...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <i className="ri-checkbox-circle-line mr-2"></i>
                    {lang === 'ko' ? '모두 포함' : 'Include All'}
                  </>
                )}
              </button>
              <button
                onClick={bulkExcludeAll}
                disabled={isBulkUpdating}
                className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg font-semibold hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title={lang === 'ko' ? '모든 리포트를 학습에서 제외' : 'Exclude all reports from learning'}
              >
                {isBulkUpdating ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    {lang === 'ko' ? '처리 중...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <i className="ri-close-circle-line mr-2"></i>
                    {lang === 'ko' ? '모두 제외' : 'Exclude All'}
                  </>
                )}
              </button>
              <button
                onClick={previewAutoFilter}
                disabled={isRunningAutoFilter}
                className="px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/50 rounded-lg font-semibold hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isRunningAutoFilter ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    {lang === 'ko' ? '분석 중...' : 'Analyzing...'}
                  </>
                ) : (
                  <>
                    <i className="ri-filter-line mr-2"></i>
                    {lang === 'ko' ? '자동 필터링 미리보기' : 'Preview Auto Filter'}
                  </>
                )}
              </button>
              {canRunLearning && (
                <button
                  onClick={runLearningCycle}
                  disabled={isRunningLearning}
                  className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  title={lang === 'ko' 
                    ? `학습 가능한 리포트: ${validReportsCount}개` 
                    : `Valid reports for learning: ${validReportsCount}`}
                >
                  {isRunningLearning ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      {lang === 'ko' ? '학습 실행 중...' : 'Running...'}
                    </>
                  ) : (
                    <>
                      <i className="ri-brain-line mr-2"></i>
                      {lang === 'ko' ? 'AI 학습 실행' : 'Run AI Learning'}
                    </>
                  )}
                </button>
              )}
              {!canRunLearning && (
                <div className="px-4 py-2 bg-slate-700/50 text-slate-400 rounded-lg font-semibold border border-slate-600">
                  <i className="ri-information-line mr-2"></i>
                  {lang === 'ko' ? '학습 가능한 리포트가 없습니다' : 'No reports available for learning'}
                </div>
              )}
            </div>
          </div>
          {learningResult && (
            <div className="mt-4 p-3 bg-slate-700 rounded border border-teal-500/50">
              <p className="text-sm text-teal-400">
                {lang === 'ko' 
                  ? `✅ 학습 완료: ${learningResult.patterns_found || 0}개 패턴 발견, ${learningResult.patterns_applied || 0}개 적용됨`
                  : `✅ Learning complete: ${learningResult.patterns_found || 0} patterns found, ${learningResult.patterns_applied || 0} applied`}
              </p>
            </div>
          )}
          {autoFilterResult && (
            <div className="mt-4 p-3 bg-slate-700 rounded border border-purple-500/50">
              <p className="text-sm text-purple-400">
                {lang === 'ko' 
                  ? `✅ 자동 필터링 완료: ${autoFilterResult.filtered_count || 0}개 리포트가 학습에서 제외되었습니다.`
                  : `✅ Auto filter complete: ${autoFilterResult.filtered_count || 0} reports excluded from learning.`}
              </p>
            </div>
          )}
        </div>

        {/* 필터 */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                {lang === 'ko' ? '상태' : 'Status'}
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
              >
                <option value="all">{lang === 'ko' ? '전체' : 'All'}</option>
                <option value="pending">{lang === 'ko' ? '대기중' : 'Pending'}</option>
                <option value="reviewed">{lang === 'ko' ? '검토됨' : 'Reviewed'}</option>
                <option value="fixed">{lang === 'ko' ? '수정됨' : 'Fixed'}</option>
                <option value="rejected">{lang === 'ko' ? '거부됨' : 'Rejected'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                {lang === 'ko' ? '학습 포함' : 'Learning'}
              </label>
              <select
                value={filterLearning}
                onChange={(e) => setFilterLearning(e.target.value)}
                className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
              >
                <option value="all">{lang === 'ko' ? '전체' : 'All'}</option>
                <option value="include">{lang === 'ko' ? '학습 포함' : 'Included'}</option>
                <option value="exclude">{lang === 'ko' ? '학습 제외' : 'Excluded'}</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hideProcessed"
                checked={hideProcessed}
                onChange={(e) => setHideProcessed(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-teal-500 focus:ring-teal-500"
              />
              <label htmlFor="hideProcessed" className="text-sm text-slate-400 cursor-pointer">
                {lang === 'ko' ? '학습된 리포트 숨기기' : 'Hide studied reports'}
              </label>
            </div>
          </div>
        </div>

        {/* 리포트 목록 */}
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
              <i className="ri-file-list-line text-4xl text-slate-600 mb-4"></i>
              <p className="text-slate-400">{lang === 'ko' ? '버그 리포트가 없습니다.' : 'No bug reports found.'}</p>
            </div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-teal-500/50 transition-all"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        report.bug_type === 'wrong_answer' ? 'bg-red-500/20 text-red-400' :
                        report.bug_type === 'wrong_yes_no' ? 'bg-yellow-500/20 text-yellow-400' :
                        report.bug_type === 'wrong_irrelevant' ? 'bg-blue-500/20 text-blue-400' :
                        report.bug_type === 'wrong_similarity' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {getBugTypeLabel(report.bug_type)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        report.status === 'reviewed' ? 'bg-blue-500/20 text-blue-400' :
                        report.status === 'fixed' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {getStatusLabel(report.status)}
                      </span>
                      {report.ignore_for_learning && (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400">
                          {lang === 'ko' ? '학습 제외' : 'Excluded'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 mb-2 break-words">
                      <span className="text-slate-400">{lang === 'ko' ? '질문:' : 'Question:'} </span>
                      {report.question_text}
                    </p>
                    <div className="text-xs text-slate-500 space-y-1">
                      <div>
                        <span className="text-slate-400">{lang === 'ko' ? 'AI 제안:' : 'AI Suggested:'} </span>
                        {report.ai_suggested_answer}
                      </div>
                      {report.expected_answer && (
                        <div>
                          <span className="text-slate-400">{lang === 'ko' ? '기대 답변:' : 'Expected:'} </span>
                          {report.expected_answer}
                        </div>
                      )}
                      {report.similarity_score !== null && (
                        <div>
                          <span className="text-slate-400">{lang === 'ko' ? '유사도:' : 'Similarity:'} </span>
                          {(report.similarity_score * 100).toFixed(1)}%
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400">{lang === 'ko' ? '생성일:' : 'Created:'} </span>
                        {new Date(report.created_at).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => toggleLearningExclusion(report.id, report.ignore_for_learning)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                        report.ignore_for_learning
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      }`}
                    >
                      <i className={`ri-${report.ignore_for_learning ? 'check' : 'close'}-line mr-1`}></i>
                      {report.ignore_for_learning 
                        ? (lang === 'ko' ? '학습 포함' : 'Include')
                        : (lang === 'ko' ? '학습 제외' : 'Exclude')
                      }
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReport(report);
                        setAdminNotes(report.admin_notes || '');
                        setShowDetailModal(true);
                      }}
                      className="px-3 py-1.5 bg-teal-500/20 text-teal-400 rounded text-xs font-semibold hover:bg-teal-500/30 transition-all"
                    >
                      <i className="ri-eye-line mr-1"></i>
                      {lang === 'ko' ? '상세보기' : 'Details'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 자동 필터링 미리보기 모달 */}
        {showAutoFilterPreview && autoFilterPreview && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-purple-400">
                    {lang === 'ko' ? '자동 필터링 미리보기' : 'Auto Filter Preview'}
                  </h2>
                  <button
                    onClick={() => setShowAutoFilterPreview(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <i className="ri-close-line text-2xl"></i>
                  </button>
                </div>

                <div className="mb-4 p-4 bg-slate-700 rounded border border-purple-500/50">
                  <p className="text-sm text-purple-300">
                    {lang === 'ko' 
                      ? `총 ${autoFilterPreview.preview_count || 0}개의 리포트가 자동 필터링 대상입니다.`
                      : `${autoFilterPreview.preview_count || 0} reports will be filtered automatically.`}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    {lang === 'ko' 
                      ? '아래 리포트들은 학습에 부적합하다고 판단되어 자동으로 제외됩니다.'
                      : 'The following reports will be automatically excluded from learning.'}
                  </p>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                  {autoFilterPreview.preview_data && Array.isArray(autoFilterPreview.preview_data) && autoFilterPreview.preview_data.length > 0 ? (
                    autoFilterPreview.preview_data.map((item: any, index: number) => (
                      <div key={index} className="bg-slate-700 rounded p-3 border border-slate-600">
                        <p className="text-sm text-white break-words">
                          <span className="text-slate-400">#{index + 1} </span>
                          {item.question_text || 'N/A'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {item.bug_type} - {item.reason}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-center py-4">
                      {lang === 'ko' ? '필터링 대상 리포트가 없습니다.' : 'No reports to filter.'}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={runAutoFilter}
                    disabled={isRunningAutoFilter || (autoFilterPreview.preview_count || 0) === 0}
                    className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isRunningAutoFilter ? (
                      <>
                        <i className="ri-loader-4-line animate-spin mr-2"></i>
                        {lang === 'ko' ? '필터링 중...' : 'Filtering...'}
                      </>
                    ) : (
                      <>
                        <i className="ri-check-line mr-2"></i>
                        {lang === 'ko' ? '자동 필터링 실행' : 'Run Auto Filter'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowAutoFilterPreview(false)}
                    className="px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition-all"
                  >
                    {lang === 'ko' ? '취소' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 상세 모달 */}
        {showDetailModal && selectedReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-teal-400">
                    {lang === 'ko' ? '버그 리포트 상세' : 'Bug Report Details'}
                  </h2>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <i className="ri-close-line text-2xl"></i>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      {lang === 'ko' ? '버그 유형' : 'Bug Type'}
                    </label>
                    <p className="text-white">{getBugTypeLabel(selectedReport.bug_type)}</p>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      {lang === 'ko' ? '질문' : 'Question'}
                    </label>
                    <p className="text-white bg-slate-700 p-3 rounded break-words">
                      {selectedReport.question_text}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        {lang === 'ko' ? 'AI 제안 답변' : 'AI Suggested'}
                      </label>
                      <p className="text-white">{selectedReport.ai_suggested_answer}</p>
                    </div>
                    {selectedReport.expected_answer && (
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">
                          {lang === 'ko' ? '기대 답변' : 'Expected Answer'}
                        </label>
                        <p className="text-white">{selectedReport.expected_answer}</p>
                      </div>
                    )}
                  </div>

                  {selectedReport.problem_content && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        {lang === 'ko' ? '문제 내용' : 'Problem Content'}
                      </label>
                      <p className="text-white bg-slate-700 p-3 rounded text-sm max-h-40 overflow-y-auto">
                        {selectedReport.problem_content}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      {lang === 'ko' ? '관리자 메모' : 'Admin Notes'}
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full bg-slate-700 text-white p-3 rounded border border-slate-600 focus:border-teal-500 focus:outline-none"
                      rows={3}
                      placeholder={lang === 'ko' ? '메모를 입력하세요...' : 'Enter notes...'}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={updateReportStatus}
                      disabled={isUpdating}
                      className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 disabled:opacity-50 transition-all"
                    >
                      {isUpdating 
                        ? (lang === 'ko' ? '저장 중...' : 'Saving...')
                        : (lang === 'ko' ? '저장' : 'Save')
                      }
                    </button>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition-all"
                    >
                      {lang === 'ko' ? '닫기' : 'Close'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

