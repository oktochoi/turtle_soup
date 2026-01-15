/**
 * 통합 에러 핸들링 유틸리티
 */

export interface AppError {
  code?: string;
  message: string;
  details?: any;
  hint?: string;
  userMessage?: string;
}

/**
 * Supabase 에러를 사용자 친화적인 메시지로 변환
 */
export function formatSupabaseError(error: any): AppError {
  if (!error) {
    return {
      message: '알 수 없는 오류가 발생했습니다.',
      userMessage: '알 수 없는 오류가 발생했습니다.',
    };
  }

  // AbortError는 무해한 에러 (컴포넌트 언마운트 시 발생)
  if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
    return {
      message: '요청이 취소되었습니다.',
      userMessage: '', // 사용자에게 표시하지 않음
    };
  }

  const code = error?.code;
  const message = error?.message || '알 수 없는 오류가 발생했습니다.';
  const details = error?.details;
  const hint = error?.hint;

  // 코드별 사용자 친화적 메시지
  let userMessage = message;

  switch (code) {
    case 'PGRST116': // Not found
      userMessage = '요청한 데이터를 찾을 수 없습니다.';
      break;
    case '23505': // Unique violation
      userMessage = '이미 존재하는 데이터입니다.';
      break;
    case '23503': // Foreign key violation
      userMessage = '관련된 데이터가 없습니다.';
      break;
    case '42501': // Insufficient privilege
      userMessage = '권한이 없습니다.';
      break;
    case '42703': // Undefined column
      userMessage = '데이터베이스 구조 오류가 발생했습니다. 관리자에게 문의하세요.';
      break;
    case '42P01': // Undefined table
      userMessage = '데이터베이스 구조 오류가 발생했습니다. 관리자에게 문의하세요.';
      break;
    case 'PGRST301': // JWT expired
      userMessage = '로그인이 만료되었습니다. 다시 로그인해주세요.';
      break;
    default:
      // 네트워크 에러
      if (message.includes('fetch') || message.includes('network') || message.includes('NetworkError')) {
        userMessage = '네트워크 연결을 확인해주세요.';
      }
      // 타임아웃
      else if (message.includes('timeout') || message.includes('Timeout')) {
        userMessage = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
      }
      // 일반적인 에러는 원본 메시지 사용
      break;
  }

  return {
    code,
    message,
    details,
    hint,
    userMessage,
  };
}

/**
 * 일반 에러를 AppError로 변환
 */
export function formatError(error: unknown): AppError {
  if (error instanceof Error) {
    return {
      message: error.message,
      userMessage: error.message,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      userMessage: error,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    return formatSupabaseError(err);
  }

  return {
    message: '알 수 없는 오류가 발생했습니다.',
    userMessage: '알 수 없는 오류가 발생했습니다.',
  };
}

/**
 * 에러를 로깅하고 사용자에게 표시
 */
export function handleError(
  error: unknown,
  context?: string,
  showToast: boolean = true
): AppError {
  const appError = formatError(error);

  // 콘솔에 상세 로그 출력
  if (context) {
    console.error(`[${context}]`, {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      hint: appError.hint,
      userMessage: appError.userMessage,
      originalError: error,
      errorType: error?.constructor?.name,
      errorString: String(error),
    });
  } else {
    console.error('Error:', {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      hint: appError.hint,
      userMessage: appError.userMessage,
      originalError: error,
      errorType: error?.constructor?.name,
      errorString: String(error),
    });
  }

  // 사용자에게 Toast 표시
  if (showToast && appError.userMessage && typeof window !== 'undefined') {
    const toastError = (window as any).toastError;
    if (toastError) {
      toastError(appError.userMessage);
    }
  }

  return appError;
}

/**
 * 비동기 함수를 에러 핸들링 래퍼로 감싸기
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      throw error; // 원래 에러를 다시 throw하여 호출자가 처리할 수 있게 함
    }
  }) as T;
}

/**
 * 재시도 로직이 포함된 함수 실행
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  context?: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(2, attempt); // Exponential backoff
        console.warn(
          `[${context || 'Retry'}] Attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`,
          error
        );
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // 모든 재시도 실패
  handleError(lastError, context || 'Retry');
  throw lastError;
}

