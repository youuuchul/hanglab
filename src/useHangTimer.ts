import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';

export type Phase = 'idle' | 'ready' | 'hang' | 'rest';

export const READY_MS = 3000;
const KEEP_AWAKE_TAG = 'hang-timer';

type State = { phase: Phase; startedAt: number; restFrom: number | null; target: number | null };

const IDLE: State = { phase: 'idle', startedAt: 0, restFrom: null, target: null };

/**
 * 준비 카운트다운 → 매달리기(스톱워치 또는 목표 시간 카운트다운) → 휴식 경과로 이어지는 세트 타이머.
 *
 * Args:
 *   onHangEnd: 매달리기가 끝났을 때 매달린 시간(ms)과 종료 시각을 받는다.
 *
 * Returns:
 *   현재 단계, 단계 경과 ms, 이번 매달리기 목표 ms(스톱워치면 null), 시작·정지 함수.
 */
export function useHangTimer(onHangEnd: (durationMs: number, endedAt: number) => void) {
  const [state, setState] = useState<State>(IDLE);
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);
  const commit = (next: State) => {
    stateRef.current = next;
    setState(next);
  };

  const active = state.phase !== 'idle';

  useEffect(() => {
    if (!active) return;
    const activation = activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => {
      clearInterval(id);
      activation.then(() => deactivateKeepAwake(KEEP_AWAKE_TAG));
    };
  }, [active]);

  useEffect(() => {
    if (state.phase === 'ready' && now - state.startedAt >= READY_MS) {
      commit({ ...stateRef.current, phase: 'hang', startedAt: state.startedAt + READY_MS });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [now, state.phase, state.startedAt]);

  const endHang = (endedAt: number) => {
    onHangEnd(endedAt - stateRef.current.startedAt, endedAt);
    commit({ phase: 'rest', startedAt: endedAt, restFrom: null, target: null });
  };

  useEffect(() => {
    const s = stateRef.current;
    if (s.phase === 'hang' && s.target !== null && now - s.startedAt >= s.target) {
      endHang(s.startedAt + s.target);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  });

  /**
   * 준비 카운트다운을 시작한다.
   *
   * Args:
   *   target: 매달리기 목표 ms. 도달하면 자동으로 기록한다. null이면 스톱워치.
   */
  const start = (target: number | null) => {
    const s = stateRef.current;
    if (s.phase === 'ready' || s.phase === 'hang') return;
    const t = Date.now();
    setNow(t);
    commit({ phase: 'ready', startedAt: t, restFrom: s.phase === 'rest' ? s.startedAt : null, target });
  };

  const stop = () => {
    const s = stateRef.current;
    const t = Date.now();
    setNow(t);
    if (s.phase === 'hang') {
      endHang(t);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (s.phase === 'ready') {
      commit(s.restFrom === null ? IDLE : { phase: 'rest', startedAt: s.restFrom, restFrom: null, target: null });
    }
  };

  return { phase: state.phase, elapsedMs: Math.max(0, now - state.startedAt), target: state.target, start, stop };
}
