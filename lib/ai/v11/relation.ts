import { canonicalizeToken, extractFamilyMentions, normalizeText, PARENT_SPECIFICS } from './normalize';
import type { CaseKnowledge, ParsedQuestion, RelationReasonResult } from './types';

/**
 * Directed family/role reasoning.
 * 어머니 → 부모 (specific → general) can entail YES for "부모님"
 * 부모 → 어머니 (general → specific) does NOT auto-entail YES for "엄마"
 */
export function reasonFamilyRelation(
  knowledge: CaseKnowledge,
  parsed: ParsedQuestion
): RelationReasonResult {
  const qMentions = parsed.entitiesMentioned.length
    ? parsed.entitiesMentioned
    : extractFamilyMentions(parsed.normalized);

  if (!qMentions.length && !parsed.isFamilyQuery) {
    return { matched: false, direction: 'none', detail: 'no family mention' };
  }

  const answerN = normalizeText(knowledge.answer);
  const answerMentions = extractFamilyMentions(knowledge.answer);

  // Synonym: 엄마 ↔ 어머니 already canonicalized to 어머니
  for (const q of qMentions) {
    const cq = canonicalizeToken(q);

    // Directional mismatch before generic overlap
    if (cq === '아버지' && !answerMentions.includes('아버지') && answerMentions.includes('어머니')) {
      return {
        matched: false,
        direction: 'none',
        detail: '아버지 asked but only 어머니 in answer',
      };
    }
    if (cq === '어머니' && !answerMentions.includes('어머니') && answerMentions.includes('아버지')) {
      return {
        matched: false,
        direction: 'none',
        detail: '어머니 asked but only 아버지 in answer',
      };
    }

    if (answerMentions.includes(cq) || answerN.includes(cq)) {
      if (cq === '어머니' || cq === '아버지' || answerMentions.includes(cq)) {
        if (answerMentions.includes(cq) || (cq === '어머니' && answerMentions.includes('어머니'))) {
          return {
            matched: true,
            direction: 'synonym',
            detail: `entity ${cq} present in answer`,
          };
        }
      }
    }
  }

  // Spouse direction: 아내 in answer ≠ 남편 asked (and vice versa)
  const asksWife = qMentions.some((m) => canonicalizeToken(m) === '아내') || /아내|부인/.test(parsed.normalized);
  const asksHusband = qMentions.some((m) => canonicalizeToken(m) === '남편') || /남편/.test(parsed.normalized);
  const hasWife = answerMentions.includes('아내');
  const hasHusband = answerMentions.includes('남편');

  if (asksWife && hasWife && (/범인|가해|관련/.test(answerN) || /범인|가해|관련/.test(parsed.normalized))) {
    return { matched: true, direction: 'synonym', detail: 'wife entity in answer' };
  }
  if (asksHusband && hasWife && !hasHusband) {
    return {
      matched: false,
      direction: 'general_to_specific',
      detail: '아내 in answer but 남편 asked',
    };
  }
  if (asksWife && hasHusband && !hasWife) {
    return {
      matched: false,
      direction: 'general_to_specific',
      detail: '남편 in answer but 아내 asked',
    };
  }

  // "가족" query when any family member in answer
  if (/가족|혈연|친척/.test(parsed.normalized) && answerMentions.length > 0) {
    return {
      matched: true,
      direction: 'specific_to_general',
      detail: 'family member in answer entails 가족 query',
    };
  }

  // Asking 부모/부모님 while answer has 어머니 or 아버지 → YES (specific→general)
  const asksParentGeneral = qMentions.some((m) => {
    const c = canonicalizeToken(m);
    return c === '부모' || parsed.normalized.includes('부모');
  }) || /부모/.test(parsed.normalized);

  if (asksParentGeneral) {
    const hasSpecificParent = answerMentions.some((m) => PARENT_SPECIFICS.has(m) || m === '어머니' || m === '아버지');
    const parentRelated =
      hasSpecificParent &&
      (/관련|주문|전화|범인|가해|어머니|아버지|엄마|아빠/.test(answerN) ||
        knowledge.relations.some((r) => r.type === 'parent_of' || r.type === 'identity' || r.type === 'family'));

    if (parentRelated || hasSpecificParent) {
      return {
        matched: true,
        direction: 'specific_to_general',
        detail: 'specific parent in answer entails 부모 query',
      };
    }
  }

  // Asking 엄마 while answer only says 부모 generally (no specific) → NOT auto YES
  const asksMother = qMentions.some((m) => canonicalizeToken(m) === '어머니');
  const asksFather = qMentions.some((m) => canonicalizeToken(m) === '아버지');
  const answerOnlyGeneralParent =
    (answerMentions.includes('부모') || /부모/.test(answerN)) &&
    !answerMentions.includes('어머니') &&
    !answerMentions.includes('아버지');

  if ((asksMother || asksFather) && answerOnlyGeneralParent) {
    return {
      matched: false,
      direction: 'general_to_specific',
      detail: 'general 부모 does not entail specific 엄마/아빠',
    };
  }

  // parent_of graph
  if (asksParentGeneral || asksMother || asksFather) {
    const parentRels = knowledge.relations.filter((r) => r.type === 'parent_of' || r.type === 'family');
    if (parentRels.length && asksParentGeneral) {
      return {
        matched: true,
        direction: 'specific_to_general',
        detail: 'parent_of relation in knowledge',
      };
    }
  }

  return { matched: false, direction: 'none', detail: 'no relation match' };
}

export function isObviouslyUnrelated(question: string): boolean {
  const n = normalizeText(question);
  const unrelated =
    /날씨|대통령|1\s*\+\s*1|수도|축구|야구|주식|비트코인|점심\s*메뉴|오늘\s*몇\s*시/;
  return unrelated.test(n);
}
