import { buildCaseKnowledge } from './knowledge';
import { simpleHash } from './normalize';
import type { CaseKnowledge } from './types';

const memory = new Map<string, CaseKnowledge>();

export function getOrBuildCaseKnowledge(args: {
  caseId: string;
  content: string;
  answer: string;
}): CaseKnowledge {
  const hash = simpleHash(args.answer + '|' + args.content);
  const key = `${args.caseId}:${hash}`;
  const hit = memory.get(key);
  if (hit) return hit;

  // Invalidate older hashes for same case
  for (const k of [...memory.keys()]) {
    if (k.startsWith(args.caseId + ':') && k !== key) memory.delete(k);
  }

  const built = buildCaseKnowledge(args);
  memory.set(key, built);
  if (memory.size > 40) {
    const first = memory.keys().next().value;
    if (first) memory.delete(first);
  }
  return built;
}

export function clearCaseKnowledgeCache(): void {
  memory.clear();
}
