import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BoardView } from './src/BoardView';
import { BOARDS, HandMode, Hold, selectionFor, selectionLabel } from './src/boards';
import { HangSet, loadSets, saveSets } from './src/storage';
import { colors } from './src/theme';
import { Phase, READY_MS, useHangTimer } from './src/useHangTimer';

const PHASE_LABEL: Record<Phase, string> = { idle: '대기', ready: '준비', hang: '매달리기', rest: '휴식' };

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatTime(epoch: number): string {
  const d = new Date(epoch);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const { width } = useWindowDimensions();
  const [boardId, setBoardId] = useState(BOARDS[0].id);
  const [mode, setMode] = useState<HandMode>('both');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sets, setSets] = useState<HangSet[] | null>(null);

  const board = BOARDS.find((b) => b.id === boardId) ?? BOARDS[0];

  useEffect(() => {
    loadSets().then(setSets);
  }, []);

  const record = (durationMs: number, endedAt: number) => {
    setSets((prev) => {
      const next = [
        ...(prev ?? []),
        { id: `${endedAt}`, boardId, holdIds: selectedIds, mode, durationMs, endedAt },
      ];
      saveSets(next);
      return next;
    });
  };

  const timer = useHangTimer(record);
  const busy = timer.phase === 'ready' || timer.phase === 'hang';

  const selectHold = (hold: Hold) => {
    if (busy) return;
    setSelectedIds((prev) => (prev[0] === hold.id ? [] : selectionFor(hold, mode)));
  };

  const changeMode = (next: HandMode) => {
    if (busy) return;
    setMode(next);
    const primary = board.holds.find((h) => h.id === selectedIds[0]);
    setSelectedIds(primary ? selectionFor(primary, next) : []);
  };

  const changeBoard = (id: string) => {
    if (busy || id === boardId) return;
    setBoardId(id);
    setSelectedIds([]);
  };

  const today = useMemo(() => {
    const from = startOfToday();
    return (sets ?? []).filter((s) => s.endedAt >= from);
  }, [sets]);
  const todayTotalMs = today.reduce((sum, s) => sum + s.durationMs, 0);

  const display =
    timer.phase === 'ready'
      ? String(Math.max(1, Math.ceil((READY_MS - timer.elapsedMs) / 1000)))
      : timer.phase === 'rest'
        ? formatClock(timer.elapsedMs)
        : formatSeconds(timer.phase === 'hang' ? timer.elapsedMs : 0);

  const canStart = selectedIds.length > 0 && sets !== null;
  const primaryLabel = busy ? (timer.phase === 'ready' ? '취소' : '정지') : '시작';
  const boardWidth = Math.min(width - 24, 560);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.segment}>
        {BOARDS.map((b) => {
          const on = b.id === boardId;
          return (
            <Pressable key={b.id} onPress={() => changeBoard(b.id)} style={[styles.segmentItem, on && styles.segmentOn]}>
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{b.name.replace(' Series', '')}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.boardWrap}>
        <BoardView board={board} width={boardWidth} selectedIds={selectedIds} onSelect={selectHold} />
      </View>

      <View style={styles.holdRow}>
        <Text style={[styles.holdText, selectedIds.length === 0 && styles.dim]} numberOfLines={1}>
          {selectedIds.length > 0 ? selectionLabel(board, selectedIds, mode) : '홀드 선택'}
        </Text>
        <View style={styles.modeGroup}>
          {(['both', 'one'] as HandMode[]).map((m) => (
            <Pressable key={m} onPress={() => changeMode(m)} style={[styles.modeItem, mode === m && styles.modeOn]}>
              <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>{m === 'both' ? '양손' : '한 손'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.timer}>
        <Text style={[styles.phase, timer.phase === 'hang' && styles.phaseHang]}>{PHASE_LABEL[timer.phase]}</Text>
        <Text style={[styles.clock, timer.phase === 'hang' && styles.clockHang]}>{display}</Text>
        <Pressable
          disabled={!busy && !canStart}
          onPress={busy ? timer.stop : timer.start}
          style={[styles.primary, busy && styles.primaryStop, !busy && !canStart && styles.primaryDisabled]}
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.setsHeader}>
        <Text style={styles.setsTitle}>오늘</Text>
        <Text style={styles.setsMeta}>
          {today.length}세트 · {formatSeconds(todayTotalMs)}초
        </Text>
      </View>
      <ScrollView style={styles.sets} contentContainerStyle={styles.setsContent}>
        {[...today].reverse().map((s, i) => {
          const b = BOARDS.find((x) => x.id === s.boardId);
          return (
            <View key={s.id} style={styles.setRow}>
              <Text style={styles.setIndex}>{today.length - i}</Text>
              <View style={styles.setBody}>
                <Text style={styles.setHold} numberOfLines={1}>
                  {b ? selectionLabel(b, s.holdIds, s.mode) : s.boardId}
                </Text>
                <Text style={styles.setSub}>
                  {b?.name.replace('Beastmaker ', 'BM ').replace(' Series', '')} · {s.mode === 'both' ? '양손' : '한 손'} · {formatTime(s.endedAt)}
                </Text>
              </View>
              <Text style={styles.setDuration}>{formatSeconds(s.durationMs)}초</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.surfaceHigh },
  segmentText: { color: colors.textDim, fontSize: 15, fontWeight: '600' },
  segmentTextOn: { color: colors.text },
  boardWrap: { alignItems: 'center', paddingTop: 20, paddingBottom: 8 },
  holdRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, gap: 12 },
  holdText: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  dim: { color: colors.textDim, fontWeight: '500' },
  modeGroup: { flexDirection: 'row', padding: 3, borderRadius: 10, backgroundColor: colors.surface },
  modeItem: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  modeOn: { backgroundColor: colors.surfaceHigh },
  modeText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  modeTextOn: { color: colors.text },
  timer: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  phase: { color: colors.textDim, fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  phaseHang: { color: colors.accent },
  clock: {
    color: colors.text,
    fontSize: 76,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginVertical: 4,
  },
  clockHang: { color: colors.accent },
  primary: {
    alignSelf: 'stretch',
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  primaryStop: { backgroundColor: colors.surfaceHigh },
  primaryDisabled: { backgroundColor: colors.surfaceHigh, opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  setsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 6,
  },
  setsTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  setsMeta: { color: colors.textDim, fontSize: 14, fontVariant: ['tabular-nums'] },
  sets: { flex: 1 },
  setsContent: { paddingHorizontal: 16, paddingBottom: 32 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: 12,
  },
  setIndex: { width: 22, color: colors.textDim, fontSize: 14, fontVariant: ['tabular-nums'], textAlign: 'right' },
  setBody: { flex: 1 },
  setHold: { color: colors.text, fontSize: 15, fontWeight: '600' },
  setSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  setDuration: { color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
