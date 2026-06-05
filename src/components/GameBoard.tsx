import { useRef, useState, useCallback } from 'react';
import type { GridPos } from '../game/types';
import { useGameStore } from '../game/store';
import { getCard } from '../game/cardData';
import { isValidPlacement } from '../game/engine';
import { CardSvg } from './CardSvg';

const CARD_W = 80;
const CARD_H = 110;
const GAP = 4;
const CELL_W = CARD_W + GAP;
const CELL_H = CARD_H + GAP;

// ボード表示範囲（中心から±N枚分）
const VIEW_RANGE = 4;

export function GameBoard() {
  const { state, selectedCardId, rotation, placeCard, setHoveredPos, hoveredPos } = useGameStore();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  if (!state) return null;

  const { city } = state;

  // 配置済みカードとプレビュー候補を計算
  const cityMap = new Map(city.map(pc => [`${pc.pos.x},${pc.pos.y}`, pc]));

  // 表示するセル範囲
  const allX = city.map(c => c.pos.x);
  const allY = city.map(c => c.pos.y);
  const minX = Math.min(-VIEW_RANGE, ...(allX.length ? allX : [0])) - 1;
  const maxX = Math.max(VIEW_RANGE, ...(allX.length ? allX : [0])) + 1;
  const minY = Math.min(-VIEW_RANGE, ...(allY.length ? allY : [0])) - 1;
  const maxY = Math.max(VIEW_RANGE, ...(allY.length ? allY : [0])) + 1;

  const gridW = (maxX - minX + 1) * CELL_W;
  const gridH = (maxY - minY + 1) * CELL_H;

  function cellToPos(col: number, row: number): GridPos {
    return { x: minX + col, y: minY + row };
  }

  function posToStyle(pos: GridPos) {
    return {
      left: (pos.x - minX) * CELL_W,
      top:  (pos.y - minY) * CELL_H,
    };
  }

  // マウスドラッグでボード移動
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1 && e.button !== 0) return; // 左クリック or 中ボタン
    if (selectedCardId !== null) return; // カード選択中はドラッグしない
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  }, [selectedCardId, offset]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return;
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.mx,
      y: dragStart.current.oy + e.clientY - dragStart.current.my,
    });
  }, [dragging]);

  const onMouseUp = useCallback(() => {
    setDragging(false);
    dragStart.current = null;
  }, []);

  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  return (
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        background: '#1a1a2e',
        position: 'relative',
        cursor: dragging ? 'grabbing' : selectedCardId !== null ? 'crosshair' : 'grab',
        userSelect: 'none',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div style={{
        position: 'absolute',
        transform: `translate(calc(50% + ${offset.x}px), calc(50% + ${offset.y}px))`,
        width: gridW,
        height: gridH,
        marginLeft: -gridW / 2,
        marginTop: -gridH / 2,
      }}>
        {/* 配置済みカード */}
        {city.map(pc => {
          const card = getCard(pc.cardId);
          const style = posToStyle(pc.pos);
          return (
            <div key={`${pc.pos.x},${pc.pos.y}`}
              style={{ position: 'absolute', left: style.left, top: style.top }}>
              <CardSvg card={card} rotation={pc.rotation} width={CARD_W} height={CARD_H} />
            </div>
          );
        })}

        {/* 配置候補セル */}
        {selectedCardId !== null && Array.from({ length: rows }, (_, row) =>
          Array.from({ length: cols }, (_, col) => {
            const pos = cellToPos(col, row);
            const key = `${pos.x},${pos.y}`;
            if (cityMap.has(key)) return null;
            const valid = isValidPlacement(pos, city);
            if (!valid) return null;
            const style = posToStyle(pos);
            const isHovered = hoveredPos?.x === pos.x && hoveredPos?.y === pos.y;
            return (
              <div
                key={key}
                style={{
                  position: 'absolute',
                  left: style.left,
                  top: style.top,
                  width: CARD_W,
                  height: CARD_H,
                  border: isHovered ? '2px solid #ffe66d' : '2px dashed #4ecdc4',
                  borderRadius: 4,
                  background: isHovered ? 'rgba(255,230,109,0.15)' : 'rgba(78,205,196,0.08)',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={() => setHoveredPos(pos)}
                onMouseLeave={() => setHoveredPos(null)}
                onClick={() => placeCard(pos)}
              >
                {isHovered && selectedCardId && (
                  <div style={{ opacity: 0.7, pointerEvents: 'none' }}>
                    <CardSvg card={getCard(selectedCardId)} rotation={rotation}
                      width={CARD_W} height={CARD_H} />
                  </div>
                )}
                {!isHovered && (
                  <span style={{ color: '#4ecdc4', fontSize: 20 }}>+</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 座標表示 */}
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        color: '#555', fontSize: 11,
      }}>
        {city.length}/15 枚配置 | ドラッグでスクロール
      </div>
    </div>
  );
}
