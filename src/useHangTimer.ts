import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';

export type Phase = 'idle' | 'ready' | 'hang' | 'rest';

export const READY_MS = 3000;
const KEEP_AWAKE_TAG = 'hang-timer';

type State = { phase: Phase; startedAt: number; restFrom: number | null };

/**
 * 준비 카운트다운 → 매달리기 스톱워치 → 휴식 경과로 이어지는 세트 타이머.
 *
 * Args:
 *   onHangEnd: 매달리기를 멈췄을 때 매달린 시간(ms)과 종료 시각을 받는다.
 *
 * Returns:
 *   현재 단계, 단계 경과 ms, 시작·정지 함수.
 */
export function useHangTimer(onHangEnd: (durationMs: number, endedAt: number) => void) {
  const [state, setState] = useState<State>({ phase: 'idle', startedAt: 0, restFrom: null });
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

  const start = () => {
    const s = stateRef.current;
    if (s.phase === 'ready' || s.phase === 'hang') return;
    const t = Date.now();
    setNow(t);
    commit({ phase: 'ready', startedAt: t, restFrom: s.phase === 'rest' ? s.startedAt : null });
  };

  const stop = () => {
    const s = stateRef.current;
    const t = Date.now();
    setNow(t);
    if (s.phase === 'hang') {
      onHangEnd(t - s.startedAt, t);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      commit({ phase: 'rest', startedAt: t, restFrom: null });
    } else if (s.phase === 'ready') {
      commit(
        s.restFrom === null
          ? { phase: 'idle', startedAt: 0, restFrom: null }
          : { phase: 'rest', startedAt: s.restFrom, restFrom: null },
      );
    }
  };

  return { phase: state.phase, elapsedMs: Math.max(0, now - state.startedAt), start, stop };
}
