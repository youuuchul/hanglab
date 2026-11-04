import bm1000 from '../data/boards/beastmaker-1000.json';
import bm2000 from '../data/boards/beastmaker-2000.json';

export type HoldType = 'jug' | 'edge' | 'pocket' | 'sloper';
export type HandMode = 'both' | 'one';

export type Shape = { x: number; y: number; w: number; h: number };

export type Hold = {
  id: string;
  row: number;
  order: number;
  type: HoldType;
  fingers: number | null;
  depthMm: number | null;
  slopeDeg: number | null;
  mirrorOf: string | null;
  shape: Shape;
};

export type BoardPart = Shape & { role: 'block' | 'body' | 'ledge'; r: number };

export type Board = {
  id: string;
  name: string;
  layout: { width: number; height: number; parts: BoardPart[] };
  holds: Hold[];
};

export const BOARDS: Board[] = [bm1000 as Board, bm2000 as Board];

const ROW_NAMES: Record<number, string> = { 1: '윗줄', 2: '가운데줄', 3: '아랫줄', 4: '윗면' };
const TYPE_NAMES: Record<HoldType, string> = { jug: '저그', edge: '엣지', pocket: '포켓', sloper: '슬로퍼' };

/**
 * 홀드를 화면 표시용 한국어 이름으로 바꾼다.
 *
 * Args:
 *   hold: 대상 홀드.
 *   side: 한 손 행일 때 붙일 좌우 표기. 없으면 생략.
 *
 * Returns:
 *   '가운데줄 · 3손가락 포켓 · 45mm' 형식의 문자열.
 */
export function holdLabel(hold: Hold, side?: '왼쪽' | '오른쪽'): string {
  const parts = [ROW_NAMES[hold.row]];
  if (side) parts.push(side);
  if (hold.type === 'sloper') {
    parts.push(`${TYPE_NAMES.sloper} ${hold.slopeDeg}°`);
  } else if (hold.type === 'pocket' && hold.fingers === 1) {
    parts.push('모노');
  } else if (hold.type === 'jug' || hold.fingers === null) {
    parts.push(TYPE_NAMES[hold.type]);
  } else {
    parts.push(`${hold.fingers}손가락 ${TYPE_NAMES[hold.type]}`);
  }
  if (hold.depthMm !== null) parts.push(`${hold.depthMm}mm`);
  return parts.join(' · ');
}

/**
 * 보드 이름을 목록 부제용 짧은 이름으로 바꾼다.
 *
 * Args:
 *   board: 대상 보드.
 *
 * Returns:
 *   'BM 1000' 형식의 문자열.
 */
export function shortBoardName(board: Board): string {
  return board.name.replace('Beastmaker ', 'BM ').replace(' Series', '');
}

/**
 * 선택된 홀드 묶음의 표시 이름을 만든다.
 *
 * Args:
 *   board: 홀드가 속한 보드.
 *   holdIds: 선택된 홀드 id 목록.
 *   mode: 양손/한 손 모드.
 *
 * Returns:
 *   표시 이름. 홀드를 찾지 못하면 빈 문자열.
 */
export function selectionLabel(board: Board, holdIds: string[], mode: HandMode): string {
  const hold = board.holds.find((h) => h.id === holdIds[0]);
  if (!hold) return '';
  if (mode === 'both' || hold.mirrorOf === null) return holdLabel(hold);
  const cx = hold.shape.x + hold.shape.w / 2;
  return holdLabel(hold, cx < board.layout.width / 2 ? '왼쪽' : '오른쪽');
}

/**
 * 탭한 홀드에 맞춰 선택할 홀드 id 목록을 정한다.
 *
 * Args:
 *   hold: 탭한 홀드.
 *   mode: 양손이면 대칭 쌍을 함께 선택한다.
 *
 * Returns:
 *   선택할 홀드 id 목록. 탭한 홀드가 첫 번째.
 */
export function selectionFor(hold: Hold, mode: HandMode): string[] {
  return mode === 'both' && hold.mirrorOf ? [hold.id, hold.mirrorOf] : [hold.id];
}

/**
 * 보드 좌표에서 가장 가까운 홀드를 찾는다.
 *
 * Args:
 *   board: 대상 보드.
 *   x: 보드 좌표 x.
 *   y: 보드 좌표 y.
 *   maxDistance: 이 거리보다 먼 홀드는 무시한다.
 *
 * Returns:
 *   가장 가까운 홀드. 없으면 null.
 */
export function holdAt(board: Board, x: number, y: number, maxDistance = 16): Hold | null {
  let best: Hold | null = null;
  let bestDistance = maxDistance;
  for (const hold of board.holds) {
    const { x: hx, y: hy, w, h } = hold.shape;
    const dx = Math.max(hx - x, 0, x - (hx + w));
    const dy = Math.max(hy - y, 0, y - (hy + h));
    const distance = Math.hypot(dx, dy);
    if (distance <= bestDistance) {
      best = hold;
      bestDistance = distance;
    }
  }
  return best;
}
