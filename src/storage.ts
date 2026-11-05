import AsyncStorage from '@react-native-async-storage/async-storage';

import { HandMode } from './boards';

export type HangSet = {
  id: string;
  boardId: string;
  holdIds: string[];
  mode: HandMode;
  durationMs: number;
  endedAt: number;
};

const KEY = 'hanglab.sets.v1';
const PREFS_KEY = 'hanglab.timer.v1';

/**
 * 저장된 세트 기록을 읽는다.
 *
 * Returns:
 *   저장 순서대로의 세트 목록. 저장된 값이 없으면 빈 배열.
 */
export async function loadSets(): Promise<HangSet[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === null ? [] : (JSON.parse(raw) as HangSet[]);
}

/**
 * 세트 기록 전체를 저장한다.
 *
 * Args:
 *   sets: 저장할 세트 목록.
 */
export async function saveSets(sets: HangSet[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(sets));
}

export type TimerTab = 'stopwatch' | 'timer' | 'interval';

export type IntervalPrefs = { workS: number; restS: number; sets: number };

export type TimerPrefs = {
  tab: TimerTab;
  lastTargetS: number;
  targetsS: Record<string, number>;
  interval: IntervalPrefs;
};

export const DEFAULT_TIMER_PREFS: TimerPrefs = {
  tab: 'stopwatch',
  lastTargetS: 10,
  targetsS: {},
  interval: { workS: 7, restS: 3, sets: 6 },
};

/**
 * 타이머 설정(탭, 마지막 목표 시간, 홀드별 목표 시간, 인터벌 설정)을 읽는다.
 * 탭 대신 카운트다운 여부만 저장하던 이전 형식은 스톱워치/타이머 탭으로 옮긴다.
 *
 * Returns:
 *   저장된 설정. 없거나 빠진 항목은 기본값.
 */
export async function loadTimerPrefs(): Promise<TimerPrefs> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (raw === null) return DEFAULT_TIMER_PREFS;
  const { countdown, ...saved } = JSON.parse(raw) as Partial<TimerPrefs> & { countdown?: boolean };
  return {
    ...DEFAULT_TIMER_PREFS,
    ...saved,
    tab: saved.tab ?? (countdown ? 'timer' : 'stopwatch'),
  };
}

/**
 * 타이머 설정 전체를 저장한다.
 *
 * Args:
 *   prefs: 저장할 설정.
 */
export async function saveTimerPrefs(prefs: TimerPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export type Selection = { boardId: string; mode: HandMode; holdId: string | null };

const SELECTION_KEY = 'hanglab.selection.v1';

/**
 * 마지막으로 고른 보드·손 모드·홀드를 읽는다.
 *
 * Returns:
 *   저장된 선택. 없으면 null.
 */
export async function loadSelection(): Promise<Selection | null> {
  const raw = await AsyncStorage.getItem(SELECTION_KEY);
  return raw === null ? null : (JSON.parse(raw) as Selection);
}

/**
 * 현재 선택을 저장한다.
 *
 * Args:
 *   selection: 보드 id, 손 모드, 기준 홀드 id(미선택이면 null).
 */
export async function saveSelection(selection: Selection): Promise<void> {
  await AsyncStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
}
