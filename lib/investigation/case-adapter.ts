import type { Problem } from '@/lib/types';
import { INVESTIGATION_CONFIG } from './config';
import {
  CATEGORY_LABELS,
  type CaseCategory,
  type InvestigationCase,
  type KeyClue,
  type SolutionElement,
} from './types';

function splitSentences(text: string): string[] {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/(?<=[.!?。！？\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  if (parts.length === 0 && cleaned.length >= 4) return [cleaned];
  return parts;
}

export function caseNumberFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const n = (h % 900) + 100;
  return String(n).padStart(3, '0');
}

function detectCategory(tags: string[] = [], difficulty?: string): CaseCategory {
  const joined = tags.map((t) => t.toLowerCase()).join(' ');
  if (/공포|scary|horror|소름/.test(joined)) return 'horror';
  if (/반전|twist|레전드|legend/.test(joined)) return 'twist';
  if (/감동|emotional|슬픈/.test(joined)) return 'emotional';
  if (/극악|extreme|최상/.test(joined) || difficulty === 'hard') return 'extreme';
  if (/범죄|crime|살인|시체/.test(joined)) return 'crime';
  if (/미스터리|mystery/.test(joined)) return 'mystery';
  return 'mystery';
}

/**
 * No curated keyClues → empty list (never use answer sentences as unlockable clues;
 * that would spoil the solution when “discovered”).
 */
function buildFallbackClues(): KeyClue[] {
  return [];
}

/** Solution elements may fall back to answer sentences (used only for scoring, never shown). */
function buildSolutionElements(answer: string, clues: KeyClue[]): SolutionElement[] {
  if (clues.length > 0) {
    const weight = Math.max(1, Math.round(100 / clues.length));
    return clues.map((c, i) => ({
      id: `sol_${c.id}`,
      text: c.text,
      weight: i === clues.length - 1 ? 100 - weight * (clues.length - 1) : weight,
    }));
  }
  const sentences = splitSentences(answer);
  if (sentences.length === 0) {
    return [{ id: 'sol_full', text: answer || '', weight: 100 }];
  }
  const weight = Math.max(1, Math.round(100 / sentences.length));
  return sentences.map((text, i) => ({
    id: `sol_${i + 1}`,
    text,
    weight: i === sentences.length - 1 ? 100 - weight * (sentences.length - 1) : weight,
  }));
}

function estimatedMinutes(difficulty: string, clueCount: number): number {
  const base = difficulty === 'hard' ? 15 : difficulty === 'easy' ? 8 : 12;
  return base + Math.min(8, clueCount);
}

/**
 * Existing Problem → InvestigationCase.
 * Supports optional JSON fields on problem: key_clues / keyClues, solution_elements, category.
 * Falls back safely when missing.
 */
export function problemToCase(problem: Problem): InvestigationCase {
  const raw = problem as any;
  const difficulty = (problem.difficulty || 'medium') as 'easy' | 'medium' | 'hard';

  let keyClues: KeyClue[] = [];
  const rawClues = raw.key_clues || raw.keyClues;
  if (Array.isArray(rawClues) && rawClues.length > 0) {
    keyClues = rawClues.map((c: any, i: number) => ({
      id: String(c.id || `clue_${i + 1}`),
      text: String(c.text || ''),
      keywords: Array.isArray(c.keywords) ? c.keywords : undefined,
      concepts: Array.isArray(c.concepts) ? c.concepts : undefined,
      importance: (c.importance as KeyClue['importance']) || 'important',
      xp: typeof c.xp === 'number' ? c.xp : INVESTIGATION_CONFIG.XP_USEFUL,
    })).filter((c: KeyClue) => c.text.trim().length > 0);
  }
  if (keyClues.length === 0) {
    keyClues = buildFallbackClues();
  }

  let solutionElements: SolutionElement[] = [];
  const rawSol = raw.solution_elements || raw.solutionElements;
  if (Array.isArray(rawSol) && rawSol.length > 0) {
    solutionElements = rawSol.map((s: any, i: number) => ({
      id: String(s.id || `sol_${i + 1}`),
      text: String(s.text || ''),
      weight: typeof s.weight === 'number' ? s.weight : 1,
    })).filter((s: SolutionElement) => s.text.trim().length > 0);
  }
  if (solutionElements.length === 0) {
    solutionElements = buildSolutionElements(problem.answer || '', keyClues);
  }

  const category =
    (raw.category as CaseCategory) ||
    detectCategory(problem.tags || [], difficulty);

  const hints = Array.isArray(problem.hints)
    ? problem.hints.filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
    : [];

  return {
    id: problem.id,
    caseNumber: caseNumberFromId(problem.id),
    title: problem.title,
    briefing: (problem.content || '').slice(0, 220),
    content: problem.content || '',
    answer: problem.answer || '',
    difficulty,
    category,
    categoryLabel: CATEGORY_LABELS[category] || CATEGORY_LABELS.unknown,
    estimatedMinutes: estimatedMinutes(difficulty, keyClues.length),
    playCount: problem.view_count || 0,
    keyClues,
    solutionElements,
    hints,
  };
}

export function difficultyStars(difficulty: 'easy' | 'medium' | 'hard'): string {
  if (difficulty === 'easy') return '★★☆☆☆';
  if (difficulty === 'hard') return '★★★★☆';
  return '★★★☆☆';
}
