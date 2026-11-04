import { HandMode } from './boards';
import { HangSet } from './storage';

export const WEEKS = 8;

export type HoldStat = {
  key: string;
  boardId: string;
  holdIds: string[];
  mode: HandMode;
  weeks: number[];
  bestMs: number;
  lastAt: number;
};

/**
 * 같은 홀드 기록을 묶는 키를 만든다. 양손 쌍은 탭한 쪽과 무관하게 같은 키가 된다.
 *
 * Args:
 *   boardId: 보드 id.
 *   mode: 양손/한 손 모드.
 *   holdIds: 선택된 홀드 id 목록.
 *
 * Returns:
 *   'boardId|mode|id,id' 형식의 키.
 */
export function holdKey(boardId: string, mode: HandMode, holdIds: string[]): string {
  return `${boardId}|${mode}|${[...holdIds].sort().join(',')}`;
}

/**
 * 시각이 속한 주의 시작(월요일 0시, 기기 시간대)을 구한다.
 *
 * Args:
 *   epoch: 기준 시각(ms).
 *
 * Returns:
 *   주 시작 시각(ms).
 */
export function weekStart(epoch: number): number {
  const d = new Date(epoch);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/**
 * 이번 주를 마지막으로 하는 최근 주 시작 시각 목록을 만든다.
 *
 * Args:
 *   now: 현재 시각(ms).
 *   count: 주 개수.
 *
 * Returns:
 *   오래된 주부터 이번 주까지의 주 시작 시각(ms).
 */
export function weekStarts(now: number, count = WEEKS): number[] {
  const current = weekStart(now);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(current);
    d.setDate(d.getDate() - 7 * (count - 1 - i));
    return d.getTime();
  });
}

/**
 * 세트를 주별로 모아 매달린 시간을 합한다.
 *
 * Args:
 *   sets: 대상 세트.
 *   starts: weekStarts가 만든 주 시작 시각 목록.
 *
 * Returns:
 *   starts와 같은 순서의 주별 합계(ms). 범위 밖 세트는 제외한다.
 */
export function weeklyMs(sets: HangSet[], starts: number[]): number[] {
  const totals = starts.map(() => 0);
  for (const s of sets) {
    const i = starts.indexOf(weekStart(s.endedAt));
    if (i >= 0) totals[i] += s.durationMs;
  }
  return totals;
}

/**
 * 홀드별 주간 볼륨과 최장 기록을 구한다.
 *
 * Args:
 *   sets: 전체 세트.
 *   starts: weekStarts가 만든 주 시작 시각 목록.
 *
 * Returns:
 *   이번 주 볼륨이 큰 순, 같으면 최근 기록 순으로 정렬한 홀드별 지표.
 */
export function holdStats(sets: HangSet[], starts: number[]): HoldStat[] {
  const groups = new Map<string, HangSet[]>();
  for (const s of sets) {
    const key = holdKey(s.boardId, s.mode, s.holdIds);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const last = starts.length - 1;
  return [...groups]
    .map(([key, list]) => ({
      key,
      boardId: list[0].boardId,
      holdIds: list[0].holdIds,
      mode: list[0].mode,
      weeks: weeklyMs(list, starts),
      bestMs: Math.max(...list.map((s) => s.durationMs)),
      lastAt: Math.max(...list.map((s) => s.endedAt)),
    }))
    .sort((a, b) => b.weeks[last] - a.weeks[last] || b.lastAt - a.lastAt);
}

/**
 * 매달린 시간을 표시용 문자열로 바꾼다.
 *
 * Args:
 *   ms: 시간(ms).
 *
 * Returns:
 *   1분 미만은 '19.0초', 이상은 '1분 2초'.
 */
export function formatDuration(ms: number): string {
  if (Math.round(ms / 100) < 600) return `${(ms / 1000).toFixed(1)}초`;
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}분 ${total % 60}초`;
}

/**
 * 증감을 부호가 붙은 문자열로 바꾼다.
 *
 * Args:
 *   ms: 증감(ms).
 *
 * Returns:
 *   '+4.0초', '-1분 2초' 형식.
 */
export function formatDelta(ms: number): string {
  return `${ms < 0 ? '-' : '+'}${formatDuration(Math.abs(ms))}`;
}
