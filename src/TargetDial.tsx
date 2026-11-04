import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

const TICK = 12;

function range(from: number, to: number, step: number): number[] {
  return Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
}

export const TARGET_STEPS = [...range(1, 60, 1), ...range(65, 180, 5), ...range(195, 600, 15)];

function labelOf(s: number): string | null {
  const clock = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (s < 60) return s % 5 === 0 ? String(s) : null;
  if (s <= 180) return s % 30 === 0 ? clock : null;
  return s % 60 === 0 ? clock : null;
}

function nearestIndex(value: number): number {
  let best = 0;
  TARGET_STEPS.forEach((s, i) => {
    if (Math.abs(s - value) < Math.abs(TARGET_STEPS[best] - value)) best = i;
  });
  return best;
}

type Props = {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
};

/**
 * 좌우로 끌어 목표 시간을 고르는 눈금자 다이얼. 가운데 선이 현재 값이다.
 * 눈금 간격은 60초까지 1초, 3분까지 5초, 10분까지 15초.
 *
 * Args:
 *   value: 현재 값(초). 눈금에 없는 값이면 가장 가까운 눈금에 놓인다.
 *   disabled: 조작 잠금 여부.
 *   onChange: 끄는 중 눈금이 바뀔 때마다 호출된다.
 *   onCommit: 손을 뗐을 때 최종 값으로 호출된다.
 */
export function TargetDial({ value, disabled, onChange, onCommit }: Props) {
  const [width, setWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const drag = useRef<{ x0: number; start: number; last: number } | null>(null);
  const last = TARGET_STEPS.length - 1;
  const offset = (index: number) => width / 2 - index * TICK;

  useEffect(() => {
    if (drag.current === null) x.setValue(width / 2 - nearestIndex(value) * TICK);
  }, [x, value, width]);

  const move = (pageX: number) => {
    const d = drag.current;
    if (d === null) return;
    const pos = Math.min(last, Math.max(0, d.start - (pageX - d.x0) / TICK));
    x.setValue(offset(pos));
    const next = Math.round(pos);
    if (next !== d.last) {
      d.last = next;
      onChange(TARGET_STEPS[next]);
      Haptics.selectionAsync();
    }
  };

  const release = () => {
    const d = drag.current;
    if (d === null) return;
    drag.current = null;
    Animated.spring(x, { toValue: offset(d.last), speed: 24, bounciness: 0, useNativeDriver: false }).start();
    if (d.last !== d.start) onCommit(TARGET_STEPS[d.last]);
  };

  const step = (delta: number) => {
    const next = TARGET_STEPS[Math.min(last, Math.max(0, nearestIndex(value) + delta))];
    if (next === value) return;
    onChange(next);
    onCommit(next);
  };

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="목표 시간"
      accessibilityValue={{ text: `${value}초` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => !disabled && step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        const index = nearestIndex(value);
        drag.current = { x0: e.nativeEvent.pageX, start: index, last: index };
      }}
      onResponderMove={(e) => move(e.nativeEvent.pageX)}
      onResponderRelease={release}
      onResponderTerminate={release}
      style={[styles.root, disabled && styles.disabled]}
    >
      <Animated.View style={[styles.track, { transform: [{ translateX: x }] }]}>
        {TARGET_STEPS.map((s, i) => {
          const label = labelOf(s);
          return (
            <View key={s} style={[styles.tick, label !== null && styles.tickMajor, { left: i * TICK - 1 }]}>
              {label !== null && <Text style={styles.label}>{label}</Text>}
            </View>
          );
        })}
      </Animated.View>
      <View pointerEvents="none" style={[styles.center, { left: width / 2 - 1 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', height: 44, overflow: 'hidden', marginTop: 4 },
  disabled: { opacity: 0.4 },
  track: { position: 'absolute', top: 0, left: 0, height: 44 },
  tick: { position: 'absolute', top: 6, width: 2, height: 10, borderRadius: 1, backgroundColor: colors.line, alignItems: 'center' },
  tickMajor: { height: 16, top: 3, backgroundColor: colors.textDim },
  label: {
    position: 'absolute',
    top: 20,
    left: -19,
    width: 40,
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    userSelect: 'none',
  },
  center: { position: 'absolute', top: 0, width: 2, height: 22, borderRadius: 1, backgroundColor: colors.accent },
});
