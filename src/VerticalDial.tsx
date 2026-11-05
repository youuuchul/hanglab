import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

const ROW = 30;
const VISIBLE = 5;
const WINDOW = 4;

function nearestIndex(values: number[], value: number): number {
  let best = 0;
  values.forEach((v, i) => {
    if (Math.abs(v - value) < Math.abs(values[best] - value)) best = i;
  });
  return best;
}

type Props = {
  label: string;
  values: number[];
  value: number;
  format: (value: number) => string;
  disabled: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
};

/**
 * 위아래로 끌어 값을 고르는 세로 다이얼. 가운데 칸이 현재 값이고, 위로 끌면 값이 커진다.
 *
 * Args:
 *   label: 다이얼 위 이름. 접근성 이름으로도 쓴다.
 *   values: 고를 수 있는 값(오름차순).
 *   value: 현재 값. 목록에 없으면 가장 가까운 값에 놓인다.
 *   format: 칸에 보일 문자열.
 *   disabled: 조작 잠금 여부.
 *   onChange: 끄는 중 칸이 바뀔 때마다 호출된다.
 *   onCommit: 손을 뗐을 때 최종 값으로 호출된다.
 */
export function VerticalDial({ label, values, value, format, disabled, onChange, onCommit }: Props) {
  const [pos] = useState(() => new Animated.Value(0));
  const drag = useRef<{ y0: number; start: number; last: number } | null>(null);
  const index = nearestIndex(values, value);
  const last = values.length - 1;

  useEffect(() => {
    if (drag.current === null) pos.setValue(index);
  }, [pos, index]);

  const release = () => {
    const d = drag.current;
    if (d === null) return;
    drag.current = null;
    Animated.spring(pos, { toValue: d.last, speed: 24, bounciness: 0, useNativeDriver: false }).start();
    if (d.last !== d.start) onCommit(values[d.last]);
  };

  const step = (delta: number) => {
    const next = values[Math.min(last, Math.max(0, index + delta))];
    if (next === value) return;
    onChange(next);
    onCommit(next);
  };

  const shift = pos.interpolate({ inputRange: [0, 1], outputRange: [0, -ROW] });
  const from = Math.max(0, index - WINDOW);
  const to = Math.min(last, index + WINDOW);

  return (
    <View style={[styles.root, disabled && styles.disabled]}>
      <Text style={styles.label}>{label}</Text>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        aria-valuetext={format(value)}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => !disabled && step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          drag.current = { y0: e.nativeEvent.pageY, start: index, last: index };
        }}
        onResponderMove={(e) => {
          const d = drag.current;
          if (d === null) return;
          const p = Math.min(last, Math.max(0, d.start - (e.nativeEvent.pageY - d.y0) / ROW));
          pos.setValue(p);
          const next = Math.round(p);
          if (next !== d.last) {
            d.last = next;
            onChange(values[next]);
            Haptics.selectionAsync();
          }
        }}
        onResponderRelease={release}
        onResponderTerminate={release}
        style={styles.wheel}
      >
        <View pointerEvents="none" style={styles.band} />
        <Animated.View pointerEvents="none" style={[styles.track, { transform: [{ translateY: shift }] }]}>
          {values.slice(from, to + 1).map((v, j) => {
            const i = from + j;
            const opacity = pos.interpolate({
              inputRange: [i - 3, i, i + 3],
              outputRange: [0.1, 1, 0.1],
              extrapolate: 'clamp',
            });
            return (
              <Animated.Text key={v} style={[styles.item, { top: i * ROW, opacity }]}>
                {format(v)}
              </Animated.Text>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'stretch' },
  disabled: { opacity: 0.4 },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 6 },
  wheel: { height: ROW * VISIBLE, overflow: 'hidden' },
  band: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: ((VISIBLE - 1) / 2) * ROW,
    height: ROW,
    borderRadius: 8,
    backgroundColor: colors.surfaceHigh,
  },
  track: { position: 'absolute', left: 0, right: 0, top: ((VISIBLE - 1) / 2) * ROW },
  item: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW,
    lineHeight: ROW,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    userSelect: 'none',
  },
});
