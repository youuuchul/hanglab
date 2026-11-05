import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

const ROW = 30;
const VISIBLE = 5;
const WINDOW = 4;
const CENTER_TOP = ((VISIBLE - 1) / 2) * ROW;

function nearestIndex(values: number[], value: number): number {
  let best = 0;
  values.forEach((v, i) => {
    if (Math.abs(v - value) < Math.abs(values[best] - value)) best = i;
  });
  return best;
}

type Props = {
  label: string;
  unit: string;
  values: number[];
  value: number;
  major?: (value: number) => boolean;
  disabled: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
};

/**
 * 위아래로 끌어 값을 고르는 세로 다이얼. 가운데 칸이 현재 값이고, 위로 끌면 값이 커진다.
 * 숫자와 눈금은 함께 움직이고, 단위와 선택 위치의 주황 선은 고정된다(타이머 목표 시간 다이얼과 같은 눈금).
 *
 * Args:
 *   label: 다이얼 위 이름. 접근성 이름으로도 쓴다.
 *   unit: 가운데 칸 숫자 옆에 고정으로 붙는 단위.
 *   values: 고를 수 있는 값(오름차순).
 *   value: 현재 값. 목록에 없으면 가장 가까운 값에 놓인다.
 *   major: 긴 눈금으로 표시할 값인지. 없으면 눈금 없이 숫자만 보인다.
 *   disabled: 조작 잠금 여부.
 *   onChange: 끄는 중 칸이 바뀔 때마다 호출된다.
 *   onCommit: 손을 뗐을 때 최종 값으로 호출된다.
 */
export function VerticalDial({ label, unit, values, value, major, disabled, onChange, onCommit }: Props) {
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
        aria-valuetext={`${value}${unit}`}
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
              <Animated.View key={v} style={[styles.row, { top: i * ROW, opacity }]}>
                {major && <View style={[styles.tick, major(v) && styles.tickMajor]} />}
                <Text style={styles.number}>{v}</Text>
              </Animated.View>
            );
          })}
        </Animated.View>
        {major && <View pointerEvents="none" style={styles.center} />}
        <Text pointerEvents="none" style={styles.unit}>
          {unit}
        </Text>
      </View>
    </View>
  );
}

const NUMBER_RIGHT = '31%';
const UNIT_LEFT = '72%';
const TICK_MID = 15;

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'stretch' },
  disabled: { opacity: 0.4 },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 6 },
  wheel: { height: ROW * VISIBLE, overflow: 'hidden' },
  band: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: CENTER_TOP,
    height: ROW,
    borderRadius: 8,
    backgroundColor: colors.surfaceHigh,
  },
  track: { position: 'absolute', left: 0, right: 0, top: CENTER_TOP },
  row: { position: 'absolute', left: 0, right: 0, height: ROW },
  tick: {
    position: 'absolute',
    left: TICK_MID - 5,
    top: ROW / 2 - 1,
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.line,
  },
  tickMajor: { left: TICK_MID - 8, width: 16, backgroundColor: colors.textDim },
  center: {
    position: 'absolute',
    left: TICK_MID - 11,
    top: CENTER_TOP + ROW / 2 - 1,
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  number: {
    position: 'absolute',
    left: 0,
    right: NUMBER_RIGHT,
    height: ROW,
    lineHeight: ROW,
    color: colors.text,
    fontSize: 22,
    fontWeight: '400',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    userSelect: 'none',
  },
  unit: {
    position: 'absolute',
    left: UNIT_LEFT,
    top: CENTER_TOP,
    height: ROW,
    lineHeight: ROW + 2,
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '500',
    userSelect: 'none',
  },
});
