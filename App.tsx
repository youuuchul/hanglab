import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BoardView } from './src/BoardView';
import { BOARDS, HandMode, Hold, selectionFor, selectionLabel, shortBoardName } from './src/boards';
import { formatDelta, formatDuration, holdKey, holdStats, weekStarts } from './src/stats';
import { StatsSheet } from './src/StatsSheet';
import {
  DEFAULT_TIMER_PREFS,
  HangSet,
  loadSelection,
  loadSets,
  loadTimerPrefs,
  saveSelection,
  saveSets,
  saveTimerPrefs,
  TimerPrefs,
} from './src/storage';
import { TARGET_STEPS, TargetDial } from './src/TargetDial';
import { colors } from './src/theme';
import { Phase, READY_MS, useHangTimer } from './src/useHangTimer';

const PHASE_LABEL: Record<Phase, string> = { idle: '대기', ready: '준비', hang: '매달리기', rest: '휴식' };

const TARGET_MIN_S = TARGET_STEPS[0];
const TARGET_MAX_S = TARGET_STEPS[TARGET_STEPS.length - 1];
const DOUBLE_TAP_MS = 350;

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

function formatRemaining(ms: number): string {
  if (ms > 60000) return formatClock(Math.ceil(ms / 1000) * 1000);
  return (Math.ceil(Math.max(0, ms) / 100) / 10).toFixed(1);
}

function formatElapsed(ms: number): string {
  return ms >= 60000 ? formatClock(ms) : formatSeconds(ms);
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
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsAt, setStatsAt] = useState(0);
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<TimerPrefs>(DEFAULT_TIMER_PREFS);
  const [editing, setEditing] = useState<{ key: string | null } | null>(null);
  const [draft, setDraft] = useState('');
  const lastClockTap = useRef(0);

  const board = BOARDS.find((b) => b.id === boardId) ?? BOARDS[0];

  useEffect(() => {
    Promise.all([loadSets(), loadTimerPrefs(), loadSelection()]).then(([loadedSets, loadedPrefs, selection]) => {
      const savedBoard = BOARDS.find((b) => b.id === selection?.boardId);
      if (selection && savedBoard) {
        const hold = savedBoard.holds.find((h) => h.id === selection.holdId);
        setBoardId(savedBoard.id);
        setMode(selection.mode);
        setSelectedIds(hold ? selectionFor(hold, selection.mode) : []);
      }
      setPrefs(loadedPrefs);
      setSets(loadedSets);
    });
  }, []);

  const loaded = sets !== null;
  const primaryId = selectedIds[0] ?? null;
  useEffect(() => {
    if (loaded) saveSelection({ boardId, mode, holdId: primaryId });
  }, [loaded, boardId, mode, primaryId]);

  const countdown = prefs.countdown;
  const selectedKey = selectedIds.length > 0 ? holdKey(boardId, mode, selectedIds) : null;
  const targetS = (selectedKey !== null ? prefs.targetsS[selectedKey] : undefined) ?? prefs.lastTargetS;

  const updatePrefs = (change: (p: TimerPrefs) => TimerPrefs, save: boolean) => {
    setPrefs((prev) => {
      const next = change(prev);
      if (save) saveTimerPrefs(next);
      return next;
    });
  };

  const setTarget = (key: string | null, seconds: number, save: boolean) => {
    const value = Math.min(TARGET_MAX_S, Math.max(TARGET_MIN_S, seconds));
    updatePrefs(
      (p) => ({ ...p, lastTargetS: value, targetsS: key === null ? p.targetsS : { ...p.targetsS, [key]: value } }),
      save,
    );
  };

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

  const removeSet = (id: string) => {
    setOpenSetId(null);
    setSets((prev) => {
      const next = (prev ?? []).filter((s) => s.id !== id);
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

  const selectedStat = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const key = holdKey(boardId, mode, selectedIds);
    return holdStats(sets ?? [], weekStarts(Date.now())).find((h) => h.key === key) ?? null;
  }, [sets, boardId, mode, selectedIds]);
  const selectedDelta = selectedStat ? selectedStat.weeks.at(-1)! - selectedStat.weeks.at(-2)! : 0;

  const canEditTarget = countdown && !busy;

  const tapClock = () => {
    const t = Date.now();
    if (t - lastClockTap.current < DOUBLE_TAP_MS) {
      lastClockTap.current = 0;
      setDraft(String(targetS));
      setEditing({ key: selectedKey });
    } else {
      lastClockTap.current = t;
    }
  };

  const finishEdit = () => {
    if (editing === null) return;
    const n = Number.parseInt(draft, 10);
    if (Number.isFinite(n)) setTarget(editing.key, n, true);
    setEditing(null);
  };

  let display = countdown ? formatRemaining(targetS * 1000) : formatSeconds(0);
  if (timer.phase === 'ready') display = String(Math.max(1, Math.ceil((READY_MS - timer.elapsedMs) / 1000)));
  else if (timer.phase === 'rest' && !countdown) display = formatClock(timer.elapsedMs);
  else if (timer.phase === 'hang')
    display = timer.target === null ? formatElapsed(timer.elapsedMs) : formatRemaining(timer.target - timer.elapsedMs);

  const canStart = selectedIds.length > 0 && sets !== null;
  const primaryLabel = busy ? (timer.phase === 'ready' ? '취소' : '정지') : '시작';
  const boardWidth = Math.min(width - 24, 560);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
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
        <Pressable
          disabled={busy || sets === null}
          onPress={() => {
            setStatsAt(Date.now());
            setStatsOpen(true);
          }}
          style={[styles.statsButton, (busy || sets === null) && styles.statsButtonDisabled]}
        >
          <Text style={styles.statsButtonText}>기록</Text>
        </Pressable>
      </View>

      <View style={styles.boardWrap}>
        <BoardView board={board} width={boardWidth} selectedIds={selectedIds} onSelect={selectHold} />
      </View>

      <View style={styles.holdRow}>
        <View style={styles.holdInfo}>
          <Text style={[styles.holdText, selectedIds.length === 0 && styles.dim]} numberOfLines={1}>
            {selectedIds.length > 0 ? selectionLabel(board, selectedIds, mode) : '홀드 선택'}
          </Text>
          <Text style={styles.holdStat} numberOfLines={1}>
            {selectedStat ? (
              <>
                이번 주 {formatDuration(selectedStat.weeks.at(-1)!)}{' '}
                <Text style={selectedDelta > 0 && styles.up}>{formatDelta(selectedDelta)}</Text> · 최장{' '}
                {formatDuration(selectedStat.bestMs)}
              </>
            ) : selectedIds.length > 0 ? (
              '기록 없음'
            ) : null}
          </Text>
        </View>
        <View style={styles.modeGroup}>
          {(['both', 'one'] as HandMode[]).map((m) => (
            <Pressable key={m} onPress={() => changeMode(m)} style={[styles.modeItem, mode === m && styles.modeOn]}>
              <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>{m === 'both' ? '양손' : '한 손'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.timer}>
        <View style={styles.timerControls}>
          <View style={styles.modeGroup}>
            {[false, true].map((cd) => (
              <Pressable
                key={String(cd)}
                disabled={busy}
                onPress={() => updatePrefs((p) => ({ ...p, countdown: cd }), true)}
                style={[styles.modeItem, countdown === cd && styles.modeOn]}
              >
                <Text style={[styles.modeText, countdown === cd && styles.modeTextOn]}>{cd ? '카운트다운' : '스톱워치'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={[styles.phase, timer.phase === 'hang' && styles.phaseHang]}>
          {countdown && timer.phase === 'rest' ? `휴식 · ${formatClock(timer.elapsedMs)}` : PHASE_LABEL[timer.phase]}
        </Text>
        {editing !== null ? (
          <View style={styles.editRow}>
            <TextInput
              accessibilityLabel="목표 시간 입력"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={finishEdit}
              onBlur={finishEdit}
              keyboardType="number-pad"
              maxLength={3}
              autoFocus
              selectTextOnFocus
              style={[styles.clock, styles.clockInput]}
            />
            <Pressable onPress={finishEdit} style={styles.doneButton}>
              <Text style={styles.doneText}>완료</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable disabled={!canEditTarget} onPress={tapClock}>
            <Text style={[styles.clock, timer.phase === 'hang' && styles.clockHang]}>{display}</Text>
          </Pressable>
        )}
        {countdown && (
          <TargetDial
            value={targetS}
            disabled={!canEditTarget || editing !== null}
            onChange={(v) => setTarget(selectedKey, v, false)}
            onCommit={(v) => setTarget(selectedKey, v, true)}
          />
        )}
        <Pressable
          disabled={(!busy && !canStart) || editing !== null}
          onPress={busy ? timer.stop : () => timer.start(countdown ? targetS * 1000 : null)}
          style={[styles.primary, busy && styles.primaryStop, !busy && !canStart && styles.primaryDisabled]}
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.setsHeader}>
        <Text style={styles.setsTitle}>오늘</Text>
        <Text style={styles.setsMeta}>
          {today.length}세트 · {formatDuration(todayTotalMs)}
        </Text>
      </View>
      <ScrollView style={styles.sets} contentContainerStyle={styles.setsContent}>
        {[...today].reverse().map((s, i) => {
          const b = BOARDS.find((x) => x.id === s.boardId);
          const open = openSetId === s.id;
          return (
            <Pressable key={s.id} onPress={() => setOpenSetId(open ? null : s.id)} style={styles.setRow}>
              <Text style={styles.setIndex}>{today.length - i}</Text>
              <View style={styles.setBody}>
                <Text style={styles.setHold} numberOfLines={1}>
                  {b ? selectionLabel(b, s.holdIds, s.mode) : s.boardId}
                </Text>
                <Text style={styles.setSub}>
                  {b ? shortBoardName(b) : ''} · {s.mode === 'both' ? '양손' : '한 손'} · {formatTime(s.endedAt)}
                </Text>
              </View>
              <Text style={styles.setDuration}>{formatDuration(s.durationMs)}</Text>
              {open && (
                <Pressable onPress={() => removeSet(s.id)} style={styles.deleteButton}>
                  <Text style={styles.deleteText}>삭제</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      <StatsSheet visible={statsOpen} openedAt={statsAt} sets={sets ?? []} onClose={() => setStatsOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'stretch', marginHorizontal: 16, marginTop: 8, gap: 8 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.surfaceHigh },
  segmentText: { color: colors.textDim, fontSize: 15, fontWeight: '600' },
  segmentTextOn: { color: colors.text },
  statsButton: { justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface },
  statsButtonDisabled: { opacity: 0.4 },
  statsButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  boardWrap: { alignItems: 'center', paddingTop: 20, paddingBottom: 8 },
  holdRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, gap: 12 },
  holdInfo: { flex: 1 },
  holdText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  holdStat: { color: colors.textDim, fontSize: 13, lineHeight: 18, minHeight: 18, marginTop: 2, fontVariant: ['tabular-nums'] },
  up: { color: colors.accent },
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
  timerControls: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clockInput: {
    width: 170,
    paddingVertical: 0,
    textAlign: 'center',
    color: colors.accent,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  doneButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.surfaceHigh },
  doneText: { color: colors.text, fontSize: 15, fontWeight: '700' },
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
  deleteButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.danger },
  deleteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
