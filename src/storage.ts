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

export type TimerPrefs = {
  countdown: boolean;
  lastTargetS: number;
  targetsS: Record<string, number>;
};

export const DEFAULT_TIMER_PREFS: TimerPrefs = { countdown: false, lastTargetS: 10, targetsS: {} };

/**
 * 타이머 설정(카운트다운 모드, 마지막 목표 시간, 홀드별 목표 시간)을 읽는다.
 *
 * Returns:
 *   저장된 설정. 없으면 기본값.
 */
export async function loadTimerPrefs(): Promise<TimerPrefs> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  return raw === null ? DEFAULT_TIMER_PREFS : (JSON.parse(raw) as TimerPrefs);
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
