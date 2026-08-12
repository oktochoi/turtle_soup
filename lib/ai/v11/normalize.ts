/**
 * Minimal Korean canonicalization for investigation Q&A.
 * Not a full dictionary — only high-signal family / death / common roles.
 * Directional hypernyms are handled in relation.ts (not flattened here).
 */

const CANONICAL: Record<string, string> = {
  엄마: '어머니',
  어머니: '어머니',
  어머님: '어머니',
  모친: '어머니',
  아빠: '아버지',
  아버지: '아버지',
  아버님: '아버지',
  부친: '아버지',
  부모님: '부모',
  부모: '부모',
  아들: '아들',
  딸: '딸',
  자녀: '자녀',
  자식: '자녀',
  남편: '남편',
  아내: '아내',
  부인: '아내',
  배우자: '배우자',
  죽다: '사망',
  죽어: '사망',
  죽었다: '사망',
  사망: '사망',
  숨지: '사망',
  숨짐: '사망',
  살아: '생존',
  살았: '생존',
  생존: '생존',
  자동차: '차량',
  승용차: '차량',
  차: '차량',
  차량: '차량',
};

/** Family terms that can entail "부모" when asking upward (specific → general). */
export const PARENT_SPECIFICS = new Set(['어머니', '아버지', '엄마', '아빠', '모친', '부친']);

export const FAMILY_TERMS = [
  '어머니',
  '아버지',
  '엄마',
  '아빠',
  '부모',
  '부모님',
  '아들',
  '딸',
  '자녀',
  '남편',
  '아내',
  '부인',
  '배우자',
];

export function normalizeText(text: string): string {
  let t = (text || '').trim().toLowerCase();
  t = t.replace(/\s+/g, ' ');
  t = t.replace(/[?？!~…]+$/g, '');
  // light particle strip for matching
  t = t.replace(/(이|가|은|는|을|를|의|에|에서|으로|로|와|과|도|만|부터|까지)\s/g, ' ');
  for (const [from, to] of Object.entries(CANONICAL)) {
    if (t.includes(from)) t = t.split(from).join(to);
  }
  return t.trim();
}

export function canonicalizeToken(token: string): string {
  const t = token.trim().toLowerCase();
  return CANONICAL[t] || t;
}

export function extractFamilyMentions(text: string): string[] {
  const n = normalizeText(text);
  const found: string[] = [];
  for (const term of FAMILY_TERMS) {
    const c = canonicalizeToken(term);
    if (n.includes(canonicalizeToken(term)) || n.includes(term)) {
      if (!found.includes(c)) found.push(c);
    }
  }
  return found;
}

export function splitSentences(text: string): string[] {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/(?<=[.!?。！？\n])\s+|[,，]\s*(?=[가-힣A-Za-z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
  if (parts.length === 0 && cleaned.length >= 2) return [cleaned];
  return parts;
}

export function lexicalOverlap(a: string, b: string): number {
  const ta = new Set(
    normalizeText(a)
      .split(/\s+/)
      .flatMap((w) => w.match(/[가-힣a-z0-9]{2,}/g) || [])
      .filter(Boolean)
  );
  const tb = new Set(
    normalizeText(b)
      .split(/\s+/)
      .flatMap((w) => w.match(/[가-힣a-z0-9]{2,}/g) || [])
      .filter(Boolean)
  );
  if (!ta.size || !tb.size) {
    // character bigrams for short Korean
    const bigrams = (s: string) => {
      const n = normalizeText(s).replace(/\s/g, '');
      const set = new Set<string>();
      for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
      return set;
    };
    const ba = bigrams(a);
    const bb = bigrams(b);
    if (!ba.size || !bb.size) return 0;
    let inter = 0;
    for (const x of ba) if (bb.has(x)) inter++;
    return inter / Math.max(1, Math.min(ba.size, bb.size));
  }
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter++;
  return inter / Math.max(1, Math.min(ta.size, tb.size));
}

export function simpleHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
