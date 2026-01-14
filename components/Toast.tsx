'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

function ToastItem({ toast, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // 애니메이션을 위한 지연
    setTimeout(() => setIsVisible(true), 10);

    // 자동 닫기
    const duration = toast.duration || 3000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(toast.id), 300);
  };

  const typeStyles = {
    success: 'bg-green-500 border-green-400',
    error: 'bg-red-500 border-red-400',
    info: 'bg-blue-500 border-blue-400',
    warning: 'bg-yellow-500 border-yellow-400',
  };

  const icons = {
    success: 'ri-checkbox-circle-fill',
    error: 'ri-error-warning-fill',
    info: 'ri-information-fill',
    warning: 'ri-alert-fill',
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border-2
        ${typeStyles[toast.type]}
        text-white min-w-[280px] max-w-[400px]
        transition-all duration-300 ease-in-out
        ${isVisible && !isExiting ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
        ${isExiting ? 'opacity-0 translate-x-full' : ''}
      `}
    >
      <i className={`${icons[toast.type]} text-xl flex-shrink-0`}></i>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={handleClose}
        className="flex-shrink-0 text-white/80 hover:text-white transition-colors touch-manipulation"
        aria-label="Close"
      >
        <i className="ri-close-line text-lg"></i>
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // 전역 Toast 함수 등록
    if (typeof window !== 'undefined') {
      (window as any).showToast = (message: string, type: ToastType = 'info', duration?: number) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type, duration }]);
        return id;
      };

      // 편의 함수들
      (window as any).toastSuccess = (message: string, duration?: number) => {
        return (window as any).showToast(message, 'success', duration);
      };
      (window as any).toastError = (message: string, duration?: number) => {
        return (window as any).showToast(message, 'error', duration);
      };
      (window as any).toastInfo = (message: string, duration?: number) => {
        return (window as any).showToast(message, 'info', duration);
      };
      (window as any).toastWarning = (message: string, duration?: number) => {
        return (window as any).showToast(message, 'warning', duration);
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).showToast;
        delete (window as any).toastSuccess;
        delete (window as any).toastError;
        delete (window as any).toastInfo;
        delete (window as any).toastWarning;
      }
    };
  }, []);

  const handleClose = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onClose={handleClose} />
        </div>
      ))}
    </div>,
    document.body
  );
}

