import { SCORE_CONFIG, INVESTIGATION_CONFIG } from './config';
import type { CaseResult, ElementMatch, InvestigationSession } from './types';

function gradeFromScore(score: number, solutionScore: number): string {
  if (score >= 9200 && solutionScore >= INVESTIGATION_CONFIG.SOLVE_PERFECT) return 'S';
  if (score >= 7800 && solutionScore >= INVESTIGATION_CONFIG.SOLVE_GOOD) return 'A+';
  if (score >= 6500) return 'A';
  if (score >= 4800) return 'B';
  return 'C';
}

function detectStyle(session: InvestigationSession): { style: string; description: string } {
  const total = Math.max(1, session.questionCount);
  const irrRate = session.irrelevantQuestionCount / total;
  const criticalQs = session.questions.filter((q) => q.importance === 'critical').length;
  const durationSec = Math.max(1, Math.round(((session.closedAt || Date.now()) - session.startedAt) / 1000));
  const avgPerQ = durationSec / total;

  if (criticalQs >= 2 && irrRate < 0.2) {
    return {
      style: '핵심 저격형',
      description: '불필요한 질문을 줄이고 사건의 핵심 원인을 직접 파고드는 질문을 많이 사용했습니다.',
    };
  }
  if (session.questionCount >= 12 && session.discoveredClueIds.length >= 3) {
    return {
      style: '팩트 수집형',
      description: '여러 각도의 질문으로 사실을 차곡차곡 모아가며 수사를 진행했습니다.',
    };
  }
  if (session.irrelevantQuestionCount >= 4) {
    return {
      style: '집요한 수사관',
      description: '다양한 가설을 넓게 던지며 집요하게 사건을 탐색했습니다.',
    };
  }
  if (avgPerQ < 25 && session.questionCount <= 8) {
    return {
      style: '속전속결형',
      description: '짧은 시간에 핵심 질문으로 빠르게 결론을 향해 달렸습니다.',
    };
  }
  if (session.hypothesisCount >= 2) {
    return {
      style: '신중한 분석형',
      description: '가설을 세우고 다듬으며 신중하게 진실에 접근했습니다.',
    };
  }
  return {
    style: '역발상형',
    description: '예상과 다른 각도에서 질문을 던지며 사건을 풀어갔습니다.',
  };
}

export function calculateCaseScore(args: {
  session: InvestigationSession;
  finalSolutionScore: number;
  cluesTotal: number;
  elementMatches: ElementMatch[];
}): CaseResult {
  const { session, finalSolutionScore, cluesTotal, elementMatches } = args;
  const durationSec = Math.max(
    1,
    Math.round(((session.closedAt || Date.now()) - session.startedAt) / 1000)
  );

  const solutionPart = (finalSolutionScore / 100) * SCORE_CONFIG.SOLUTION_WEIGHT * 100;
  const clueRatio = cluesTotal > 0 ? session.discoveredClueIds.length / cluesTotal : 0;
  const cluePart = clueRatio * SCORE_CONFIG.CLUE_WEIGHT * 100;

  const usefulRate =
    session.questionCount > 0
      ? session.questions.filter((q) => q.importance === 'useful' || q.importance === 'critical').length /
        session.questionCount
      : 0;
  const efficiencyPart = usefulRate * SCORE_CONFIG.EFFICIENCY_WEIGHT * 100;

  const energyPart =
    (session.investigationEnergy / INVESTIGATION_CONFIG.INITIAL_ENERGY) *
    SCORE_CONFIG.ENERGY_WEIGHT *
    100;

  const hintPenalty = session.hintCount * SCORE_CONFIG.HINT_PENALTY_EACH;
  const timeBonus = Math.max(
    0,
    SCORE_CONFIG.TIME_BONUS_MAX *
      (1 - Math.min(1, durationSec / SCORE_CONFIG.TIME_SOFT_CAP_SEC))
  );

  // Parts already scale toward ~0–10_000 when weights sum to 100
  const raw = solutionPart + cluePart + efficiencyPart + energyPart + timeBonus - hintPenalty;
  const score = Math.max(0, Math.round(raw));
  const grade = gradeFromScore(score, finalSolutionScore);
  const { style, description } = detectStyle(session);

  const highlight = session.questions.find((q) => q.importance === 'critical')?.question;

  return {
    score,
    grade,
    finalSolutionScore,
    truthScore: session.truthScore,
    cluesFound: session.discoveredClueIds.length,
    cluesTotal,
    questionCount: session.questionCount,
    irrelevantQuestionCount: session.irrelevantQuestionCount,
    hintCount: session.hintCount,
    durationSec,
    energyRemaining: session.investigationEnergy,
    detectiveStyle: style,
    styleDescription: description,
    elementMatches,
    highlightQuestion: highlight,
  };
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
