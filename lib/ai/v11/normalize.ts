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
  const na = normalizeText(a).replace(/\s/g, '');
  const nb = normalizeText(b).replace(/\s/g, '');
  if (!na || !nb) return 0;

  const tokens = (s: string) =>
    new Set(
      normalizeText(s)
        .split(/\s+/)
        .flatMap((w) => w.match(/[가-힣a-z0-9]{2,}/g) || [])
        .filter(Boolean)
    );

  const ta = tokens(a);
  const tb = tokens(b);
  let wordScore = 0;
  if (ta.size && tb.size) {
    let inter = 0;
    for (const x of ta) if (tb.has(x)) inter++;
    wordScore = inter / Math.max(1, Math.min(ta.size, tb.size));
  }

  // Korean paraphrases rarely share exact tokens (아내가 vs 아내였다) — use n-grams.
  const ngrams = (s: string, n: number) => {
    const set = new Set<string>();
    for (let i = 0; i <= s.length - n; i++) set.add(s.slice(i, i + n));
    return set;
  };
  const ngramScore = (n: number) => {
    const ba = ngrams(na, n);
    const bb = ngrams(nb, n);
    if (!ba.size || !bb.size) return 0;
    let inter = 0;
    for (const x of ba) if (bb.has(x)) inter++;
    return inter / Math.max(1, Math.min(ba.size, bb.size));
  };

  const bi = ngramScore(2);
  const tri = ngramScore(3);

  // Containment bonus: shorter side largely appears in longer side
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  let contain = 0;
  if (shorter.length >= 4 && longer.includes(shorter)) {
    contain = 0.85;
  } else if (shorter.length >= 6) {
    // partial window containment
    let best = 0;
    const win = Math.min(6, shorter.length);
    for (let i = 0; i <= shorter.length - win; i++) {
      if (longer.includes(shorter.slice(i, i + win))) best += 1;
    }
    contain = Math.min(0.75, (best / Math.max(1, shorter.length - win + 1)) * 0.9);
  }

  return Math.min(
    1,
    Math.max(wordScore, bi, tri * 1.05, contain, wordScore * 0.4 + bi * 0.6)
  );
}

export function simpleHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
