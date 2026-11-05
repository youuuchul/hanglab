import { Platform, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { Board, holdAt, Hold } from './boards';
import { colors } from './theme';

const PAD_X = 6;
const TOP = -28;
const SVG_FONT = Platform.select({ web: 'system-ui, -apple-system, sans-serif', default: undefined });
const BOTTOM_PAD = 8;

type Props = {
  board: Board;
  width: number;
  selectedIds: string[];
  markedIds: string[];
  onPress: (hold: Hold | null) => void;
};

/**
 * 보드 정면 도식을 그리고 탭한 위치의 홀드를 알려준다.
 *
 * Args:
 *   board: 그릴 보드.
 *   width: 화면에 그릴 폭(pt).
 *   selectedIds: 지금 고른 홀드 id 목록. 주황으로 채우고 실선 테두리.
 *   markedIds: 기록에서 불러온 홀드 id 목록. 파랑으로 채우고 점선 테두리.
 *   onPress: 보드를 탭할 때마다 호출된다. 탭한 위치의 홀드, 홀드가 없으면 null.
 */
export function BoardView({ board, width, selectedIds, markedIds, onPress }: Props) {
  const { width: bw, height: bh, parts } = board.layout;
  const vbW = bw + PAD_X * 2;
  const vbH = bh - TOP + BOTTOM_PAD;
  const height = (width * vbH) / vbW;
  const scale = vbW / width;
  const selected = new Set(selectedIds);
  const marked = new Set(markedIds);

  const holes = board.holds.filter((h) => h.type !== 'sloper');
  const slopers = board.holds.filter((h) => h.type === 'sloper');
  const ledges = parts.filter((p) => p.role === 'ledge');
  const upper = [...parts.filter((p) => p.role === 'body'), ...parts.filter((p) => p.role === 'block')];
  const upperBottom = Math.max(...upper.map((p) => p.y + p.h));

  return (
    <View
      accessibilityLabel={board.name}
      onStartShouldSetResponder={() => true}
      onResponderRelease={(e) => {
        const x = e.nativeEvent.locationX * scale - PAD_X;
        const y = e.nativeEvent.locationY * scale + TOP;
        onPress(holdAt(board, x, y));
      }}
      style={{ width, height }}
    >
      <View style={{ pointerEvents: 'none' }}>
        <Svg width={width} height={height} viewBox={`${-PAD_X} ${TOP} ${vbW} ${vbH}`}>
          <Defs>
            <LinearGradient id="upper" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={upperBottom}>
              <Stop offset="0" stopColor="#F8F2E8" />
              <Stop offset="0.55" stopColor="#EEE4D3" />
              <Stop offset="1" stopColor="#D9C9AE" />
            </LinearGradient>
            {ledges.map((p, i) => (
              <LinearGradient key={i} id={`ledge${i}`} gradientUnits="userSpaceOnUse" x1="0" y1={p.y} x2="0" y2={p.y + p.h}>
                <Stop offset="0" stopColor="#A8977B" />
                <Stop offset="0.28" stopColor="#E3D8C3" />
                <Stop offset="0.8" stopColor="#DDD0B8" />
                <Stop offset="1" stopColor="#C2B195" />
              </LinearGradient>
            ))}
            <LinearGradient id="hole" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#15100C" />
              <Stop offset="0.5" stopColor="#3A2E25" />
              <Stop offset="1" stopColor="#806C57" />
            </LinearGradient>
            <LinearGradient id="holeOn" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#7A2404" />
              <Stop offset="0.5" stopColor={colors.accent} />
              <Stop offset="1" stopColor="#FFB685" />
            </LinearGradient>
            <LinearGradient id="holeRec" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0B2A52" />
              <Stop offset="0.5" stopColor={colors.rest} />
              <Stop offset="1" stopColor="#A9D1FF" />
            </LinearGradient>
            <LinearGradient id="sloper" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F8F2E8" />
              <Stop offset="1" stopColor="#D8C9AE" />
            </LinearGradient>
          </Defs>

          {[
            [2, 0.16, 1],
            [4.5, 0.11, 2.5],
            [8, 0.07, 4.5],
          ].map(([dy, opacity, grow]) => (
            <G key={`sh${dy}`} opacity={opacity}>
              {parts.map((p, i) => (
                <Rect key={i} x={p.x - grow} y={p.y + dy - grow / 2} width={p.w + grow * 2} height={p.h + grow} rx={p.r + grow} fill="#000" />
              ))}
            </G>
          ))}

          {ledges.map((p, i) => (
            <Rect key={`l${i}`} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} fill={`url(#ledge${i})`} />
          ))}
          {upper
            .filter((p) => p.role === 'body')
            .map((p, i) => (
              <G key={`u${i}`}>
                <Rect x={p.x + 4} y={p.y + 3} width={p.w - 8} height={p.h} rx={p.r} fill="#000" opacity={0.14} />
                <Rect x={p.x + 6} y={p.y + 1.5} width={p.w - 12} height={p.h} rx={p.r} fill="#000" opacity={0.12} />
              </G>
            ))}
          {upper.map((p, i) => (
            <G key={`p${i}`}>
              <Rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} fill="url(#upper)" />
              <Rect x={p.x + p.r * 0.7} y={p.y + 0.5} width={p.w - p.r * 1.4} height={1.1} rx={0.55} fill="#FFFFFF" opacity={0.75} />
            </G>
          ))}

          {holes.map((hold) => {
            const { x, y, w, h } = hold.shape;
            const on = selected.has(hold.id);
            const rec = marked.has(hold.id);
            const rx = Math.min(h / 2, 11);
            return (
              <G key={hold.id}>
                <Rect x={x} y={y + 1.4} width={w} height={h} rx={rx} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.2} />
                <Rect x={x} y={y} width={w} height={h} rx={rx} fill={on ? 'url(#holeOn)' : rec ? 'url(#holeRec)' : 'url(#hole)'} />
                <Rect x={x + 0.4} y={y + 0.4} width={w - 0.8} height={h - 0.8} rx={rx} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={0.8} />
                {on && <Rect x={x - 2.5} y={y - 2.5} width={w + 5} height={h + 5} rx={rx + 2.5} fill="none" stroke={colors.accent} strokeWidth={1.6} />}
                {rec && (
                  <Rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={rx + 3} fill="none" stroke={colors.rest} strokeWidth={1.6} strokeDasharray="4 3" />
                )}
              </G>
            );
          })}

          {slopers.map((hold) => {
            const { x, y, w, h } = hold.shape;
            const on = selected.has(hold.id);
            const rec = marked.has(hold.id);
            const fill = on ? colors.accent : rec ? colors.rest : 'url(#sloper)';
            return (
              <G key={hold.id}>
                <Rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} stroke={on ? colors.accent : rec ? colors.rest : '#C9B99D'} strokeWidth={0.6} />
                {rec && (
                  <Rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={h / 2 + 3} fill="none" stroke={colors.rest} strokeWidth={1.6} strokeDasharray="4 3" />
                )}
                <SvgText x={x + w / 2} y={y + h / 2 + 3.3} fontSize={9.5} fontWeight="700" fontFamily={SVG_FONT} textAnchor="middle" fill={on || rec ? '#FFFFFF' : '#7C6A52'}>
                  {`${hold.slopeDeg}°`}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}
