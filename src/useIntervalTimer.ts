import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';

export const READY_MS = 3000;
const KEEP_AWAKE_TAG = 'interval-timer';

export type IntervalPhase = 'ready' | 'work' | 'rest';
export type IntervalPlan = { workMs: number; restMs: number; sets: number };

type Run = IntervalPlan & { startedAt: number; recorded: number };
type Position = { phase: IntervalPhase; remainingMs: number; setsLeft: number; phaseStart: number };

/**
 * 시작 시각부터의 경과로 현재 단계를 구한다. 마지막 운동 뒤에는 휴식 없이 끝난다.
 *
 * Returns:
 *   현재 단계·남은 ms·남은 세트 수(진행 중인 운동 포함)·단계 시작 시각. 끝났으면 null.
 */
function locate(run: Run, now: number): Position | null {
  const elapsed = now - run.startedAt;
  if (elapsed < READY_MS) {
    return { phase: 'ready', remainingMs: READY_MS - elapsed, setsLeft: run.sets, phaseStart: run.startedAt };
  }
  const w = elapsed - READY_MS;
  const cycle = run.workMs + run.restMs;
  const k = Math.floor(w / cycle);
  const within = w - k * cycle;
  if (k >= run.sets || (k === run.sets - 1 && within >= run.workMs)) return null;
  const base = run.startedAt + READY_MS + k * cycle;
  if (within < run.workMs) {
    return { phase: 'work', remainingMs: run.workMs - within, setsLeft: run.sets - k, phaseStart: base };
  }
  return { phase: 'rest', remainingMs: cycle - within, setsLeft: run.sets - k - 1, phaseStart: base + run.workMs };
}

function repEnd(run: Run, index: number): number {
  return run.startedAt + READY_MS + index * (run.workMs + run.restMs) + run.workMs;
}

function completedReps(run: Run, now: number): number {
  const w = now - repEnd(run, 0);
  return w < 0 ? 0 : Math.min(run.sets, Math.floor(w / (run.workMs + run.restMs)) + 1);
}

/**
 * 처음 한 번 준비 카운트다운 뒤 운동·휴식을 세트 수만큼 번갈아 세는 인터벌 타이머.
 * 단계는 시작 시각 기준으로 계산하므로 앱이 잠시 멈췄다 돌아와도 끝난 운동을 빠짐없이 기록한다.
 *
 * Args:
 *   onRep: 운동 한 번이 끝날 때마다 운동 시간(ms)과 종료 시각을 받는다. 중간 정지면 실제 시간.
 *
 * Returns:
 *   진행 여부, 현재 단계, 단계 남은 ms, 남은 세트 수, 시작·정지 함수.
 */
export function useIntervalTimer(onRep: (durationMs: number, endedAt: number) => void) {
  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const runRef = useRef(run);
  const phaseRef = useRef<IntervalPhase | null>(null);
  const commit = (next: Run | null) => {
    runRef.current = next;
    setRun(next);
  };

  const running = run !== null;

  useEffect(() => {
    if (!running) return;
    const activation = activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => {
      clearInterval(id);
      activation.then(() => deactivateKeepAwake(KEEP_AWAKE_TAG));
    };
  }, [running]);

  const recordUntil = (r: Run, t: number): number => {
    const done = completedReps(r, t);
    for (let i = r.recorded; i < done; i++) onRep(r.workMs, repEnd(r, i));
    return done;
  };

  useEffect(() => {
    const r = runRef.current;
    if (r === null) return;
    const done = recordUntil(r, now);
    const pos = locate(r, now);
    if (pos === null) {
      phaseRef.current = null;
      commit(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    if (done !== r.recorded) commit({ ...r, recorded: done });
    if (pos.phase !== phaseRef.current) {
      if (phaseRef.current !== null) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      phaseRef.current = pos.phase;
    }
  });

  /**
   * 준비 카운트다운부터 인터벌을 시작한다.
   *
   * Args:
   *   plan: 운동 ms, 휴식 ms, 세트 수.
   */
  const start = (plan: IntervalPlan) => {
    if (runRef.current !== null) return;
    const t = Date.now();
    setNow(t);
    phaseRef.current = null;
    commit({ ...plan, startedAt: t, recorded: 0 });
  };

  const stop = () => {
    const r = runRef.current;
    if (r === null) return;
    const t = Date.now();
    recordUntil(r, t);
    const pos = locate(r, t);
    if (pos?.phase === 'work') onRep(t - pos.phaseStart, t);
    phaseRef.current = null;
    commit(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const pos = run === null ? null : locate(run, now);
  return {
    running,
    phase: pos?.phase ?? null,
    remainingMs: pos?.remainingMs ?? 0,
    setsLeft: pos?.setsLeft ?? 0,
    start,
    stop,
  };
}
