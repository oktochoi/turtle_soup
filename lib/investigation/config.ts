/** Investigation game — CONFIG (single source of truth) */

export const INVESTIGATION_CONFIG = {
  INITIAL_ENERGY: 100,

  COST_CRITICAL: 2,
  COST_USEFUL: 2,
  COST_NORMAL: 5,
  COST_IRRELEVANT: 8,
  COST_HINT: 15,

  XP_IRRELEVANT: 0,
  XP_NORMAL: 10,
  XP_USEFUL: 50,
  XP_CRITICAL: 300,

  /** clue unlock: embedding similarity threshold */
  CLUE_UNLOCK_SIM: 0.58,
  /** only unlock the single best matching clue per question */
  CLUE_MIN_MARGIN: 0.03,

  /** hypothesis / solution element match */
  ELEMENT_MATCH_SIM: 0.55,
  ELEMENT_PARTIAL_SIM: 0.42,

  /** clear thresholds */
  SOLVE_MIN: 70,
  SOLVE_GOOD: 85,
  SOLVE_PERFECT: 95,

  /** question importance vs answer/clues */
  USEFUL_SIM: 0.48,
  CRITICAL_SIM: 0.58,

  CASE_BRIEFING_MS: 1400,
} as const;

export const SCORE_CONFIG = {
  SOLUTION_WEIGHT: 55,
  CLUE_WEIGHT: 20,
  EFFICIENCY_WEIGHT: 15,
  ENERGY_WEIGHT: 10,
  HINT_PENALTY_EACH: 120,
  TIME_BONUS_MAX: 400,
  TIME_SOFT_CAP_SEC: 600,
} as const;
