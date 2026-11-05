import * as Haptics from 'expo-haptics';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors } from './theme';

const ACTION_W = 80;
const SLOP = 8;
const FULL_RATIO = 0.6;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPress: () => void;
  onDelete: () => void;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * 왼쪽으로 끌면 오른쪽에서 삭제 버튼이 나오는 목록 행. 폭의 60% 넘게 밀고 놓으면 바로 삭제한다.
 *
 * Args:
 *   open: 삭제 버튼이 열린 상태인지. 한 번에 한 행만 열리도록 부모가 관리한다.
 *   onOpenChange: 끌어서 열거나 닫았을 때 호출된다.
 *   onPress: 끌지 않고 탭했을 때 호출된다. 열린 행을 탭하면 닫기만 한다.
 *   onDelete: 삭제 버튼을 누르거나 끝까지 밀었을 때 호출된다.
 *   style: 움직이는 행 내용의 스타일. 뒤의 삭제 버튼을 가리도록 배경색이 있어야 한다.
 *   children: 행 내용.
 */
export function SwipeRow({ open, onOpenChange, onPress, onDelete, style, children }: Props) {
  const [x] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const drag = useRef<{ x0: number; y0: number; base: number; offset: number; swiping: boolean; armed: boolean } | null>(
    null,
  );

  const settle = (toOpen: boolean) => {
    Animated.spring(x, { toValue: toOpen ? -ACTION_W : 0, speed: 20, bounciness: 0, useNativeDriver: false }).start(
      ({ finished }) => finished && !toOpen && setRevealed(false),
    );
  };

  useEffect(() => {
    if (drag.current !== null) return;
    Animated.spring(x, { toValue: open ? -ACTION_W : 0, speed: 20, bounciness: 0, useNativeDriver: false }).start(
      ({ finished }) => finished && !open && setRevealed(false),
    );
  }, [open, x]);

  const remove = () => {
    Animated.timing(x, { toValue: -Math.max(width, ACTION_W), duration: 160, useNativeDriver: false }).start(() =>
      onDelete(),
    );
  };

  const full = Math.max(width, ACTION_W + 1);
  const actionWidth = x.interpolate({
    inputRange: [-full, -ACTION_W, 0],
    outputRange: [full, ACTION_W, ACTION_W],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.root} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {(revealed || open) && (
        <Animated.View style={[styles.action, { width: actionWidth }]}>
          <Pressable onPress={remove} style={styles.actionButton}>
            <Text style={styles.actionText}>삭제</Text>
          </Pressable>
        </Animated.View>
      )}
      <Animated.View
        accessibilityActions={[{ name: 'delete', label: '삭제' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && onDelete()}
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => !drag.current?.swiping}
        onResponderGrant={(e) => {
          const base = open ? -ACTION_W : 0;
          drag.current = { x0: e.nativeEvent.pageX, y0: e.nativeEvent.pageY, base, offset: base, swiping: false, armed: false };
        }}
        onResponderMove={(e) => {
          const d = drag.current;
          if (d === null) return;
          const dx = e.nativeEvent.pageX - d.x0;
          const dy = e.nativeEvent.pageY - d.y0;
          if (!d.swiping && Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) {
            d.swiping = true;
            setRevealed(true);
          }
          if (!d.swiping) return;
          d.offset = Math.min(0, d.base + dx);
          x.setValue(d.offset);
          const armed = -d.offset > width * FULL_RATIO;
          if (armed !== d.armed) {
            d.armed = armed;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }}
        onResponderRelease={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d === null) return;
          if (!d.swiping) {
            const moved = Math.abs(e.nativeEvent.pageX - d.x0) > SLOP || Math.abs(e.nativeEvent.pageY - d.y0) > SLOP;
            if (moved) return;
            if (open) onOpenChange(false);
            else onPress();
            return;
          }
          if (d.armed) {
            remove();
            return;
          }
          const toOpen = -d.offset > ACTION_W / 2;
          settle(toOpen);
          if (toOpen !== open) onOpenChange(toOpen);
        }}
        onResponderTerminate={() => {
          drag.current = null;
          settle(open);
        }}
        style={[style, { transform: [{ translateX: x }] }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  action: { position: 'absolute', top: 0, right: 0, bottom: 0, backgroundColor: colors.danger },
  actionButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
