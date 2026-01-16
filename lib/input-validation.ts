/**
 * 입력 검증 유틸리티
 * XSS, SQL Injection, 입력 길이 제한 등
 */

// 허용된 HTML 태그 (필요한 경우)
const ALLOWED_HTML_TAGS = ['b', 'i', 'u', 'strong', 'em', 'br', 'p'];

/**
 * XSS 방지를 위한 HTML 이스케이프
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * 텍스트 정리 (앞뒤 공백 제거, 연속 공백 정리)
 */
export function sanitizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * 닉네임 검증
 */
export function validateNickname(nickname: string): { valid: boolean; error?: string } {
  if (!nickname || nickname.trim().length === 0) {
    return { valid: false, error: '닉네임을 입력해주세요.' };
  }

  const trimmed = nickname.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: '닉네임은 2자 이상이어야 합니다.' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: '닉네임은 50자 이하여야 합니다.' };
  }

  // 특수문자 제한 (한글, 영문, 숫자, 일부 특수문자만 허용)
  if (!/^[가-힣a-zA-Z0-9\s._-]+$/.test(trimmed)) {
    return { valid: false, error: '닉네임에 사용할 수 없는 문자가 포함되어 있습니다.' };
  }

  return { valid: true };
}

/**
 * 문제 제목 검증
 */
export function validateProblemTitle(title: string): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: '제목을 입력해주세요.' };
  }

  const trimmed = title.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: '제목은 3자 이상이어야 합니다.' };
  }

  if (trimmed.length > 200) {
    return { valid: false, error: '제목은 200자 이하여야 합니다.' };
  }

  return { valid: true };
}

/**
 * 문제 내용 검증
 */
export function validateProblemContent(content: string): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: '내용을 입력해주세요.' };
  }

  const trimmed = content.trim();

  if (trimmed.length < 10) {
    return { valid: false, error: '내용은 10자 이상이어야 합니다.' };
  }

  if (trimmed.length > 10000) {
    return { valid: false, error: '내용은 10,000자 이하여야 합니다.' };
  }

  return { valid: true };
}

/**
 * 댓글 검증
 */
export function validateComment(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: '댓글을 입력해주세요.' };
  }

  const trimmed = text.trim();

  if (trimmed.length < 1) {
    return { valid: false, error: '댓글을 입력해주세요.' };
  }

  if (trimmed.length > 2000) {
    return { valid: false, error: '댓글은 2,000자 이하여야 합니다.' };
  }

  return { valid: true };
}

/**
 * 방 코드 검증
 */
export function validateRoomCode(code: string): { valid: boolean; error?: string } {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: '방 코드를 입력해주세요.' };
  }

  const trimmed = code.trim().toUpperCase();

  // 영문 대문자와 숫자만 허용, 4-8자
  if (!/^[A-Z0-9]{4,8}$/.test(trimmed)) {
    return { valid: false, error: '방 코드는 4-8자의 영문 대문자와 숫자만 사용할 수 있습니다.' };
  }

  return { valid: true };
}

/**
 * 질문/추측 텍스트 검증
 */
export function validateQuestionOrGuess(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: '내용을 입력해주세요.' };
  }

  const trimmed = text.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: '내용은 3자 이상이어야 합니다.' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: '내용은 500자 이하여야 합니다.' };
  }

  return { valid: true };
}

/**
 * 채팅 메시지 검증
 */
export function validateChatMessage(message: string): { valid: boolean; error?: string } {
  if (!message || message.trim().length === 0) {
    return { valid: false, error: '메시지를 입력해주세요.' };
  }

  const trimmed = message.trim();

  if (trimmed.length > 1000) {
    return { valid: false, error: '메시지는 1,000자 이하여야 합니다.' };
  }

  return { valid: true };
}

/**
 * SQL Injection 방지: 특수문자 제거
 */
export function sanitizeForSQL(text: string): string {
  // SQL 특수문자 제거 (Supabase는 파라미터화된 쿼리를 사용하므로 실제로는 필요 없지만 방어적 코딩)
  return text.replace(/['";\\]/g, '');
}

/**
 * URL 검증
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    // http, https만 허용
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'http 또는 https URL만 허용됩니다.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: '유효한 URL이 아닙니다.' };
  }
}

/**
 * 이메일 검증
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: '유효한 이메일 주소를 입력해주세요.' };
  }
  return { valid: true };
}

