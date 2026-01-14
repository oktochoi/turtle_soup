'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { formatError } from '@/lib/error-handler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 에러 리포팅 서비스에 전송 (선택사항)
    // 예: Sentry, LogRocket 등
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const appError = formatError(this.state.error);

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-slate-800 rounded-xl p-6 sm:p-8 border border-slate-700 text-center">
            <div className="mb-4">
              <i className="ri-error-warning-line text-5xl text-red-500"></i>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
              오류가 발생했습니다
            </h2>
            <p className="text-sm sm:text-base text-slate-300 mb-6">
              {appError.userMessage || appError.message}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-all"
              >
                다시 시도
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all"
              >
                홈으로 가기
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-slate-400 cursor-pointer mb-2">
                  개발자 정보 (개발 모드에서만 표시)
                </summary>
                <pre className="text-xs text-slate-500 bg-slate-900 p-3 rounded overflow-auto max-h-40">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

