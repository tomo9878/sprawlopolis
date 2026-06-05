import type {
  PlacedCard, GridPos, Zone, Edge, BlockGroup,
  RoadComponent, BlockGrid, Quadrant,
} from './types';
import { getCard, getBlocks, getRoadEdges, getRoadTouchedZones,
         getZoneAt, EDGE_QUADS, oppositeEdge } from './cardData';

// ==================== Grid Lookup ====================

export function cityMap(city: PlacedCard[]): Map<string, PlacedCard> {
  return new Map(city.map(pc => [posKey(pc.pos), pc]));
}

function posKey(pos: GridPos): string {
  return `${pos.x},${pos.y}`;
}

const NEIGHBORS: Array<{ dx: number; dy: number; from: Edge; to: Edge }> = [
  { dx: 0, dy: -1, from: 'T', to: 'B' },
  { dx: 0, dy: +1, from: 'B', to: 'T' },
  { dx: -1, dy: 0, from: 'L', to: 'R' },
  { dx: +1, dy: 0, from: 'R', to: 'L' },
];

// ==================== Placement Validation ====================

export function isValidPlacement(
  pos: GridPos,
  city: PlacedCard[],
): boolean {
  if (city.length === 0) return true; // 最初の1枚はどこでも可
  const map = cityMap(city);
  if (map.has(posKey(pos))) return false; // 既存カードと重複
  // 少なくとも1辺で隣接するカードがあること
  return NEIGHBORS.some(({ dx, dy }) =>
    map.has(posKey({ x: pos.x + dx, y: pos.y + dy }))
  );
}

// ==================== Road Connectivity ====================

/** 2枚のカードが道路で接続しているか */
export function roadsConnect(a: PlacedCard, b: PlacedCard): boolean {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const dir = NEIGHBORS.find(n => n.dx === dx && n.dy === dy);
  if (!dir) return false;
  const aEdges = getRoadEdges(getCard(a.cardId), a.rotation);
  const bEdges = getRoadEdges(getCard(b.cardId), b.rotation);
  return aEdges.includes(dir.from) && bEdges.includes(dir.to);
}

/** UnionFind で道路の連結成分を構築 */
export function buildRoadComponents(city: PlacedCard[]): RoadComponent[] {
  const n = city.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  function union(i: number, j: number) {
    const pi = find(i), pj = find(j);
    if (pi !== pj) parent[pi] = pj;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (roadsConnect(city[i], city[j])) union(i, j);
    }
  }

  // 連結成分をグループ化
  const groups = new Map<number, PlacedCard[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(city[i]);
  }

  return Array.from(groups.values()).map(cards => buildRoadComponent(cards, city));
}

function buildRoadComponent(cards: PlacedCard[], allCity: PlacedCard[]): RoadComponent {
  const map = cityMap(allCity);
  const touchedZones = new Set<Zone>();
  let endsAtCityEdge = false;
  let connectionCount = 0;

  for (const pc of cards) {
    const card = getCard(pc.cardId);
    for (const z of getRoadTouchedZones(card, pc.rotation)) touchedZones.add(z);

    const roadEdges = getRoadEdges(card, pc.rotation);
    for (const edge of roadEdges) {
      const dir = NEIGHBORS.find(n => n.from === edge)!;
      const neighborKey = posKey({ x: pc.pos.x + dir.dx, y: pc.pos.y + dir.dy });
      const neighbor = map.get(neighborKey);
      if (!neighbor) {
        endsAtCityEdge = true; // 隣にカードなし = 都市端
      } else {
        const neighborEdges = getRoadEdges(getCard(neighbor.cardId), neighbor.rotation);
        if (neighborEdges.includes(oppositeEdge(edge))) connectionCount++;
      }
    }
  }

  // ループ判定: 全接続数 >= カード数 × 2（全辺が別の道路と接続）
  const isLoop = connectionCount >= cards.length * 2 && !endsAtCityEdge;

  return { cards, touchedZones, isLoop, endsAtCityEdge };
}

// ==================== Road Path (順序付き経路) ====================

/**
 * 道路連結成分のカードを経路順に並べて返す
 * 非ループ: エンドポイント（接続数1のカード）から始めてDFS
 * ループ: 任意のカードから始めて1周
 */
export function buildRoadPath(cards: PlacedCard[]): PlacedCard[] {
  if (cards.length <= 1) return [...cards];

  const keyOf = (pc: PlacedCard) => `${pc.pos.x},${pc.pos.y}`;

  // 隣接リスト構築
  const adj = new Map<string, PlacedCard[]>();
  for (const c of cards) adj.set(keyOf(c), []);
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (roadsConnect(cards[i], cards[j])) {
        adj.get(keyOf(cards[i]))!.push(cards[j]);
        adj.get(keyOf(cards[j]))!.push(cards[i]);
      }
    }
  }

  // エンドポイント（接続数=1）を開始点にする。ループは任意の点から
  const start = cards.find(c => adj.get(keyOf(c))!.length === 1) ?? cards[0];

  const path: PlacedCard[] = [start];
  const visited = new Set<string>([keyOf(start)]);
  let current = start;

  while (true) {
    const next = adj.get(keyOf(current))!.find(n => !visited.has(keyOf(n)));
    if (!next) break;
    visited.add(keyOf(next));
    path.push(next);
    current = next;
  }

  return path;
}

/** 道路が特定の辺で接する2ゾーンを返す（MINI MARTS用） */
export function getEdgeTouchedZones(pc: PlacedCard, edge: import('./types').Edge): [import('./types').Zone, import('./types').Zone] {
  const blocks = getBlocks(getCard(pc.cardId), pc.rotation);
  const [q1, q2] = EDGE_QUADS[edge];
  return [getZoneAt(blocks, q1), getZoneAt(blocks, q2)];
}

// ==================== Block Connectivity ====================

type CityBlock = { pos: GridPos; quadrant: Quadrant; zone: Zone };

/** 全カードから個別ブロックのリストを生成 */
export function getAllBlocks(city: PlacedCard[]): CityBlock[] {
  const blocks: CityBlock[] = [];
  const quads: Quadrant[] = ['TL', 'TR', 'BL', 'BR'];
  for (const pc of city) {
    const grid = getBlocks(getCard(pc.cardId), pc.rotation);
    for (const q of quads) {
      blocks.push({ pos: pc.pos, quadrant: q, zone: getZoneAt(grid, q) });
    }
  }
  return blocks;
}

/** ブロックの絶対座標（カード位置 × 2 + 象限オフセット）*/
function blockAbsPos(b: CityBlock): [number, number] {
  const qOff: Record<Quadrant, [number, number]> = {
    TL: [0, 0], TR: [1, 0], BL: [0, 1], BR: [1, 1],
  };
  const [qx, qy] = qOff[b.quadrant];
  return [b.pos.x * 2 + qx, b.pos.y * 2 + qy];
}

/** 同ゾーンの連結グループを BFS で探索 */
export function findBlockGroups(city: PlacedCard[]): BlockGroup[] {
  const allBlocks = getAllBlocks(city);
  const keyOf = (b: CityBlock) => blockAbsPos(b).join(',');
  const byKey = new Map(allBlocks.map(b => [keyOf(b), b]));
  const visited = new Set<string>();

  const groups: BlockGroup[] = [];

  for (const block of allBlocks) {
    const k = keyOf(block);
    if (visited.has(k)) continue;
    visited.add(k);

    const zone = block.zone;
    const group: BlockGroup = { zone, cells: [], size: 0 };
    const queue: CityBlock[] = [block];

    while (queue.length) {
      const curr = queue.shift()!;
      group.cells.push({ pos: curr.pos, quadrant: curr.quadrant });
      group.size++;

      const [ax, ay] = blockAbsPos(curr);
      for (const [ddx, ddy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nk = `${ax+ddx},${ay+ddy}`;
        const neighbor = byKey.get(nk);
        if (neighbor && !visited.has(nk) && neighbor.zone === zone) {
          visited.add(nk);
          queue.push(neighbor);
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

/** ゾーン別の最大グループサイズ */
export function largestGroupPerZone(city: PlacedCard[]): Record<Zone, number> {
  const groups = findBlockGroups(city);
  const result: Record<Zone, number> = { C: 0, P: 0, I: 0, R: 0 };
  for (const g of groups) {
    if (g.size > result[g.zone]) result[g.zone] = g.size;
  }
  return result;
}

// ==================== City Boundary ====================

export function getCityBounds(city: PlacedCard[]): {
  minX: number; maxX: number; minY: number; maxY: number;
} {
  if (city.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return {
    minX: Math.min(...city.map(c => c.pos.x)),
    maxX: Math.max(...city.map(c => c.pos.x)),
    minY: Math.min(...city.map(c => c.pos.y)),
    maxY: Math.max(...city.map(c => c.pos.y)),
  };
}

/** ブロックが都市の端（外周カード上）にあるか */
export function isBlockOnCityEdge(
  block: CityBlock,
  city: PlacedCard[],
): boolean {
  const bounds = getCityBounds(city);
  const { x, y } = block.pos;
  const q = block.quadrant;
  const [ax, ay] = blockAbsPos(block);
  const [minAX, maxAX] = [bounds.minX * 2, bounds.maxX * 2 + 1];
  const [minAY, maxAY] = [bounds.minY * 2, bounds.maxY * 2 + 1];
  return ax === minAX || ax === maxAX || ay === minAY || ay === maxAY;
}
