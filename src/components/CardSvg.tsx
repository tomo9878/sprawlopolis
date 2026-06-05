import { useState } from 'react';
import type { Zone, Rotation, Edge } from '../game/types';
import type { CardDef } from '../game/types';
import { getBlocks, getRoadEdges } from '../game/cardData';

const ZONE_COLOR: Record<Zone, string> = {
  C: '#5b9bd5', P: '#70ad47', I: '#8c8c8c', R: '#ed7d31',
};

interface Props {
  card: CardDef;
  rotation: Rotation;
  width?: number;
  height?: number;
  showLabel?: boolean;
  showBack?: boolean;     // 裏面（スコアリング条件画像）を表示
  useTexture?: boolean;   // 実際のカード画像を背景に使用
  dimmed?: boolean;
  selected?: boolean;
  animateRotation?: boolean; // Step9: 回転アニメーション
}

function roadPath(edges: [Edge, Edge], W: number, H: number): string {
  const hw = W / 2, hh = H / 2;
  const edgeSet = new Set(edges);
  const pts: Record<Edge, [number, number]> = {
    T: [hw, 0], B: [hw, H], L: [0, hh], R: [W, hh],
  };
  const [e1, e2] = edges;
  const [x1, y1] = pts[e1];
  const [x2, y2] = pts[e2];
  const cornerX = edgeSet.has('R') ? W : 0;
  const cornerY = edgeSet.has('B') ? H : 0;
  const cx = cornerX === 0 ? W * 0.08 : W * 0.92;
  const cy = cornerY === 0 ? H * 0.08 : H * 0.92;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export function CardSvg({
  card,
  rotation,
  width = 80,
  height = 110,
  showLabel = false,
  showBack = false,
  useTexture = true,
  dimmed = false,
  selected = false,
  animateRotation = false,
}: Props) {
  const blocks = getBlocks(card, rotation);
  const edges = getRoadEdges(card, rotation);
  const W = width, H = height;
  const hw = W / 2, hh = H / 2;

  const quadrant = [
    { x: 0,  y: 0,  w: hw, h: hh, zone: blocks[0][0] },
    { x: hw, y: 0,  w: hw, h: hh, zone: blocks[0][1] },
    { x: 0,  y: hh, w: hw, h: hh, zone: blocks[1][0] },
    { x: hw, y: hh, w: hw, h: hh, zone: blocks[1][1] },
  ];

  const roadW = W * 0.28;
  const path = roadPath(edges, W, H);

  // 画像URL: /cards/front/card_01.png など
  const imgSrc = showBack
    ? `/cards/back/card_${String(card.id).padStart(2,'0')}.png`
    : `/cards/front/card_${String(card.id).padStart(2,'0')}.png`;

  // Step9: 回転アニメーション用トランジション
  const rotateStyle = animateRotation ? {
    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center',
  } : {};

  return (
    <div style={{
      display: 'inline-block',
      position: 'relative',
      width: W,
      height: H,
      flexShrink: 0,
      ...rotateStyle,
    }}>
      <svg
        width={W} height={H}
        style={{
          border: selected ? '3px solid #ffe66d' : '1px solid #333',
          borderRadius: 4,
          opacity: dimmed ? 0.35 : 1,
          display: 'block',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        <defs>
          <clipPath id={`clip-${card.id}-${rotation}`}>
            <rect x={0} y={0} width={W} height={H} rx={3} />
          </clipPath>
        </defs>

        <g clipPath={`url(#clip-${card.id}-${rotation})`}>
          {/* ① ゾーンカラー（常に表示） */}
          {quadrant.map((q, i) => (
            <rect key={i} x={q.x} y={q.y} width={q.w} height={q.h}
              fill={ZONE_COLOR[q.zone]} />
          ))}

          {/* ② 実際のカード画像（テクスチャ） */}
          {useTexture && (
            <image
              href={imgSrc}
              x={0} y={0} width={W} height={H}
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {/* ③ 道路オーバーレイ（正面のみ） */}
          {!showBack && (
            <>
              <path d={path} fill="none" stroke="rgba(60,60,60,0.7)"
                strokeWidth={roadW} strokeLinecap="round" />
              <path d={path} fill="none" stroke="rgba(150,150,150,0.5)"
                strokeWidth={roadW * 0.22}
                strokeLinecap="round"
                strokeDasharray={`${W*0.06} ${W*0.04}`} />
            </>
          )}

          {/* ④ ゾーン色の薄いオーバーレイ（テクスチャが暗くなりすぎた場合の補正） */}
          {useTexture && !showBack && quadrant.map((q, i) => (
            <rect key={`ov-${i}`} x={q.x} y={q.y} width={q.w} height={q.h}
              fill={ZONE_COLOR[q.zone]} opacity={0.18} />
          ))}

          {/* ゾーンコーナーラベル */}
          {showLabel && quadrant.map((q, i) => (
            <text key={`lbl-${i}`}
              x={q.x + (q.x === 0 ? 4 : q.w - 4)}
              y={q.y + (q.y === 0 ? 11 : q.h + q.y - 3)}
              textAnchor={q.x === 0 ? 'start' : 'end'}
              fontSize={W * 0.11} fill="white" fontWeight="bold"
              style={{ filter: 'drop-shadow(0 0 2px #000)', pointerEvents: 'none' }}>
              {q.zone}
            </text>
          ))}

          {/* カードID */}
          <text x={W - 3} y={H - 3} textAnchor="end" fontSize={W * 0.12}
            fill="white" fontWeight="bold"
            style={{ filter: 'drop-shadow(0 0 2px #000)', pointerEvents: 'none' }}>
            {card.id}
          </text>

          {/* 選択枠 */}
          {selected && (
            <rect x={1} y={1} width={W-2} height={H-2}
              fill="none" stroke="#ffe66d" strokeWidth={3} rx={3} />
          )}
        </g>
      </svg>

      {/* Step9: 回転中インジケーター */}
      {animateRotation && rotation === 180 && (
        <div style={{
          position: 'absolute', top: 2, left: 2,
          background: 'rgba(255,230,109,0.9)',
          borderRadius: 3, padding: '1px 4px',
          fontSize: 9, color: '#1a1a2e', fontWeight: 'bold',
          pointerEvents: 'none',
          lineHeight: '14px',
        }}>
          180°
        </div>
      )}
    </div>
  );
}
