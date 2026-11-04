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
