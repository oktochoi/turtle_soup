/** Public listing / visibility rules for UGC problems (cases). */

export const PUBLIC_PROBLEM_STATUSES = ['published', 'featured'] as const;
export type PublicProblemStatus = (typeof PUBLIC_PROBLEM_STATUSES)[number];

export function normalizeProblemStatus(status?: string | null): string {
  return status || 'published';
}

export function isPublicProblemStatus(status?: string | null): boolean {
  return PUBLIC_PROBLEM_STATUSES.includes(normalizeProblemStatus(status) as PublicProblemStatus);
}

/** Author or admin may preview pending/draft before public release. */
export function canViewNonPublicProblem(args: {
  status?: string | null;
  authorUserId?: string | null;
  viewerUserId?: string | null;
  viewerIsAdmin?: boolean;
}): boolean {
  const status = normalizeProblemStatus(args.status);
  if (isPublicProblemStatus(status)) return true;
  if (args.viewerIsAdmin) return true;
  if (args.viewerUserId && args.authorUserId && args.viewerUserId === args.authorUserId) {
    return status === 'pending' || status === 'draft';
  }
  return false;
}

/** Client-side filter when status column missing or mixed legacy rows. */
export function filterPublicProblems<T extends { status?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => isPublicProblemStatus(r.status));
}

/** Basic pre-submit content guard (AdSense / community policy). */
const BLOCKED_CONTENT =
  /강간|성폭력|아동\s*포르노|아동\s*학대|고어|잔인\s*살해|테러\s*방법|자해\s*방법|자살\s*방법/i;

export function findBlockedContentReason(text: string): string | null {
  const hit = text.match(BLOCKED_CONTENT);
  if (!hit) return null;
  return '과도한 폭력·성적·자해 묘사 등 정책에 맞지 않는 표현이 포함되어 있습니다. 표현을 완화해 주세요.';
}
