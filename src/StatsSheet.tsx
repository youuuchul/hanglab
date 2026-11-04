import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BOARDS, selectionLabel, shortBoardName } from './boards';
import { formatDelta, formatDuration, holdStats, weeklyMs, weekStarts } from './stats';
import { HangSet } from './storage';
import { colors } from './theme';

type Props = {
  visible: boolean;
  openedAt: number;
  sets: HangSet[];
  onClose: () => void;
};

function weekLabel(start: number, isCurrent: boolean): string {
  if (isCurrent) return '이번 주';
  const d = new Date(start);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 주별 매달린 시간을 막대로 그린다. 마지막 막대가 이번 주다.
 *
 * Args:
 *   values: 주별 합계(ms).
 *   starts: 주 시작 시각(ms).
 *   height: 막대 영역 높이.
 *   labels: 막대 아래 주 표기 여부.
 */
function WeekBars({ values, starts, height, labels }: { values: number[]; starts: number[]; height: number; labels: boolean }) {
  const max = Math.max(...values);
  const last = values.length - 1;
  return (
    <View>
      <View style={[styles.bars, { height }]}>
        {values.map((v, i) => (
          <View
            key={starts[i]}
            accessibilityLabel={`${weekLabel(starts[i], i === last)} ${formatDuration(v)}`}
            style={[
              styles.bar,
              { height: max > 0 && v > 0 ? Math.max(3, (v / max) * height) : 2 },
              v === 0 ? styles.barEmpty : i === last ? styles.barCurrent : styles.barPast,
            ]}
          />
        ))}
      </View>
      {labels && (
        <View style={styles.barLabels}>
          {starts.map((s, i) => (
            <Text key={s} style={[styles.barLabel, i === last && styles.barLabelCurrent]}>
              {weekLabel(s, i === last)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * 주간 볼륨 요약과 홀드별 지표를 보여주는 시트.
 *
 * Args:
 *   visible: 표시 여부.
 *   openedAt: 이번 주를 정하는 기준 시각(ms). 시트를 연 시각.
 *   sets: 전체 세트.
 *   onClose: 닫기 버튼이나 아래로 밀어 닫을 때 호출된다.
 */
export function StatsSheet({ visible, openedAt, sets, onClose }: Props) {
  const { starts, totals, thisWeekCount, holds } = useMemo(() => {
    const starts = weekStarts(openedAt);
    return {
      starts,
      totals: weeklyMs(sets, starts),
      thisWeekCount: sets.filter((s) => s.endedAt >= starts[starts.length - 1]).length,
      holds: holdStats(sets, starts),
    };
  }, [sets, openedAt]);

  const last = starts.length - 1;
  const delta = totals[last] - totals[last - 1];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>기록</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>닫기</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.caption}>이번 주</Text>
            <View style={styles.totalRow}>
              <Text style={styles.total}>{formatDuration(totals[last])}</Text>
              <Text style={[styles.delta, delta > 0 && styles.deltaUp]}>{formatDelta(delta)}</Text>
            </View>
            <Text style={styles.sub}>
              {thisWeekCount}세트 · 지난주 {formatDuration(totals[last - 1])}
            </Text>
            <View style={styles.chart}>
              <WeekBars values={totals} starts={starts} height={96} labels />
            </View>
          </View>

          <Text style={styles.section}>홀드별</Text>
          {holds.length === 0 && <Text style={styles.empty}>기록 없음</Text>}
          {holds.map((h) => {
            const board = BOARDS.find((b) => b.id === h.boardId);
            const holdDelta = h.weeks[last] - h.weeks[last - 1];
            return (
              <View key={h.key} style={styles.card}>
                <View style={styles.holdTop}>
                  <View style={styles.holdBody}>
                    <Text style={styles.holdName} numberOfLines={1}>
                      {board ? selectionLabel(board, h.holdIds, h.mode) : h.boardId}
                    </Text>
                    <Text style={styles.sub}>
                      {board ? shortBoardName(board) : ''} · {h.mode === 'both' ? '양손' : '한 손'} · 최장{' '}
                      {formatDuration(h.bestMs)}
                    </Text>
                  </View>
                  <View style={styles.holdNumbers}>
                    <Text style={styles.holdVolume}>{formatDuration(h.weeks[last])}</Text>
                    <Text style={[styles.delta, styles.deltaSmall, holdDelta > 0 && styles.deltaUp]}>
                      {formatDelta(holdDelta)}
                    </Text>
                  </View>
                </View>
                <View style={styles.mini}>
                  <WeekBars values={h.weeks} starts={starts} height={28} labels={false} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  close: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface },
  caption: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 4 },
  total: { color: colors.text, fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  delta: { color: colors.textDim, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  deltaSmall: { fontSize: 13, marginTop: 2 },
  deltaUp: { color: colors.accent },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 4, fontVariant: ['tabular-nums'] },
  chart: { marginTop: 16 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bar: { flex: 1, borderRadius: 3 },
  barCurrent: { backgroundColor: colors.accent },
  barPast: { backgroundColor: colors.textDim },
  barEmpty: { backgroundColor: colors.line },
  barLabels: { flexDirection: 'row', gap: 6, marginTop: 6 },
  barLabel: { flex: 1, color: colors.textDim, fontSize: 10, textAlign: 'center', fontVariant: ['tabular-nums'] },
  barLabelCurrent: { color: colors.text, fontWeight: '600' },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 14, marginLeft: 4 },
  empty: { color: colors.textDim, fontSize: 14, marginLeft: 4 },
  holdTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  holdBody: { flex: 1 },
  holdName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  holdNumbers: { alignItems: 'flex-end' },
  holdVolume: { color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  mini: { marginTop: 12 },
});
