import type { CardDef, BlockGrid, Edge, Quadrant, Zone, Rotation } from './types';
import rawData from './cards.json';

// JSONからCardDefに変換
const ALL_CARDS: CardDef[] = (rawData as { cards: CardDef[] }).cards;
const CARD_MAP = new Map<number, CardDef>(ALL_CARDS.map(c => [c.id, c]));

export function getCard(id: number): CardDef {
  const c = CARD_MAP.get(id);
  if (!c) throw new Error(`Card ${id} not found`);
  return c;
}

export function getAllCards(): CardDef[] {
  return ALL_CARDS;
}

// ==================== Rotation Helpers ====================

const EDGE_FLIP: Record<Edge, Edge> = { T: 'B', B: 'T', L: 'R', R: 'L' };
const QUAD_FLIP: Record<Quadrant, Quadrant> = { TL: 'BR', BR: 'TL', TR: 'BL', BL: 'TR' };

/** 回転を適用した道路出口辺を返す */
export function getRoadEdges(card: CardDef, rotation: Rotation): [Edge, Edge] {
  if (rotation === 0) return card.road_edges;
  return card.road_edges.map(e => EDGE_FLIP[e]) as [Edge, Edge];
}

/** 回転を適用したブロックグリッドを返す */
export function getBlocks(card: CardDef, rotation: Rotation): BlockGrid {
  if (rotation === 0) return card.blocks;
  // 180°回転: [TL,TR]/[BL,BR] → [BR,BL]/[TR,TL]
  const [[tl, tr], [bl, br]] = card.blocks;
  return [[br, bl], [tr, tl]];
}

/** 象限から (row, col) インデックスを返す */
export function quadToIndex(q: Quadrant): [number, number] {
  return { TL: [0, 0], TR: [0, 1], BL: [1, 0], BR: [1, 1] }[q];
}

/** ブロックグリッドから各象限のゾーンを取得 */
export function getZoneAt(blocks: BlockGrid, q: Quadrant): Zone {
  const [r, c] = quadToIndex(q);
  return blocks[r][c];
}

/** 辺の中点が接する2象限を返す（T→[TL,TR], B→[BL,BR], L→[TL,BL], R→[TR,BR]）*/
export const EDGE_QUADS: Record<Edge, [Quadrant, Quadrant]> = {
  T: ['TL', 'TR'],
  B: ['BL', 'BR'],
  L: ['TL', 'BL'],
  R: ['TR', 'BR'],
};

/** カードの道路が接触するゾーン集合を返す */
export function getRoadTouchedZones(card: CardDef, rotation: Rotation): Set<Zone> {
  const blocks = getBlocks(card, rotation);
  const edges = getRoadEdges(card, rotation);
  const zones = new Set<Zone>();
  for (const edge of edges) {
    for (const q of EDGE_QUADS[edge]) {
      zones.add(getZoneAt(blocks, q));
    }
  }
  // カード内部の道路は常にIndustrial象限を通る
  const roadQuad = (rotation === 0 ? card.road_quadrant : QUAD_FLIP[card.road_quadrant]);
  zones.add(getZoneAt(blocks, roadQuad));
  return zones;
}

/** 反対辺を返す */
export function oppositeEdge(e: Edge): Edge {
  return EDGE_FLIP[e];
}
