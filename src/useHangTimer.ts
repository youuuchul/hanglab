import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';

export type Phase = 'idle' | 'hang' | 'rest';

const KEEP_AWAKE_TAG = 'hang-timer';

type State = { phase: Phase; startedAt: number; target: number | null };

/**
 * 매달리기(스톱워치 또는 목표 시간 카운트다운) → 휴식 경과로 이어지는 세트 타이머. 시작하면 바로 매달리기다.
 *
 * Args:
 *   onHangEnd: 매달리기가 끝났을 때 매달린 시간(ms)과 종료 시각을 받는다.
 *
 * Returns:
 *   현재 단계, 단계 경과 ms, 이번 매달리기 목표 ms(스톱워치면 null), 시작·정지 함수.
 */
export function useHangTimer(onHangEnd: (durationMs: number, endedAt: number) => void) {
  const [state, setState] = useState<State>({ phase: 'idle', startedAt: 0, target: null });
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

  const endHang = (endedAt: number) => {
    onHangEnd(endedAt - stateRef.current.startedAt, endedAt);
    commit({ phase: 'rest', startedAt: endedAt, target: null });
  };

  useEffect(() => {
    const s = stateRef.current;
    if (s.phase === 'hang' && s.target !== null && now - s.startedAt >= s.target) {
      endHang(s.startedAt + s.target);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  });

  /**
   * 매달리기를 시작한다.
   *
   * Args:
   *   target: 매달리기 목표 ms. 도달하면 자동으로 기록한다. null이면 스톱워치.
   */
  const start = (target: number | null) => {
    if (stateRef.current.phase === 'hang') return;
    const t = Date.now();
    setNow(t);
    commit({ phase: 'hang', startedAt: t, target });
  };

  const stop = () => {
    if (stateRef.current.phase !== 'hang') return;
    const t = Date.now();
    setNow(t);
    endHang(t);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return { phase: state.phase, elapsedMs: Math.max(0, now - state.startedAt), target: state.target, start, stop };
}
