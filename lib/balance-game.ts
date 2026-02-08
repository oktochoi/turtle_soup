/**
 * 밸런스 게임 토너먼트: 라운드/매치 계산, 승자 추론
 * - 정답 없음, 선택만 기록
 */

export const TOURNAMENT_SIZES = [8, 16, 32, 64, 128] as const;
export type TournamentSize = (typeof TOURNAMENT_SIZES)[number];

/** 한 라운드의 매치: [optionIdA, optionIdB] */
export type Match = [string, string];

/** 라운드 수 (8→3, 16→4, 32→5, 64→6, 128→7) */
export function getTotalRounds(size: TournamentSize): number {
  return Math.log2(size);
}

/** 셔플된 옵션 ID 배열로 1라운드 매치 생성 */
export function getRound1Matches(shuffledOptionIds: string[]): Match[] {
  const matches: Match[] = [];
  for (let i = 0; i < shuffledOptionIds.length; i += 2) {
    matches.push([shuffledOptionIds[i], shuffledOptionIds[i + 1]]);
  }
  return matches;
}

/** 이전 라운드에서 선택된 승자들로 다음 라운드 매치 생성 */
export function getNextRoundMatches(winners: string[]): Match[] {
  const matches: Match[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    matches.push([winners[i], winners[i + 1]]);
  }
  return matches;
}

/** 1라운드 매치 수 */
export function getRound1MatchCount(size: TournamentSize): number {
  return size / 2;
}

/** 특정 라운드의 매치 수 */
export function getMatchCountInRound(roundNumber: number, size: TournamentSize): number {
  return size / Math.pow(2, roundNumber);
}

/** Fisher-Yates 셔플 (같은 배열 수정) */
export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
