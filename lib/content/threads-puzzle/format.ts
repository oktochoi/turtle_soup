/**
 * Threads post body: title + blank + content + blank + "왜 그랬을까?"
 * No answer, hints, ads, hashtags, or clickbait.
 */
export function formatThreadsPost(title: string, content: string): string {
  const cleanTitle = title.trim();
  const cleanBody = content
    .trim()
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s*왜 그랬을까\??\s*$/u, '')
    .trim();

  return `${cleanTitle}\n\n${cleanBody}\n\n왜 그랬을까?`;
}

export function validateThreadsFormat(text: string): string | null {
  if (!text.trim().endsWith('왜 그랬을까?')) {
    return 'Threads 게시글은 "왜 그랬을까?"로 끝나야 합니다.';
  }
  const banned = [
    /99%\s*가?\s*못/,
    /천재\s*테스트/,
    /충격적인\s*반전/,
    /소름\s*돋는/,
    /맞혀보세요/,
    /정답은/,
    /#\w+/,
  ];
  for (const re of banned) {
    if (re.test(text)) return `금지 표현이 포함되어 있습니다: ${re}`;
  }
  if (text.length > 500) return 'Threads 본문은 500자를 넘을 수 없습니다.';
  return null;
}

export function countSentences(content: string): number {
  return content
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4).length;
}
