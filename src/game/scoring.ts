import type { PlacedCard, Zone, ScoreBreakdown, Difficulty, BlockGrid } from './types';
import type { CardDef } from './types';
import { getCard, getBlocks, getRoadEdges, getRoadTouchedZones, getZoneAt, EDGE_QUADS } from './cardData';
import {
  buildRoadComponents, largestGroupPerZone, findBlockGroups,
  getAllBlocks, isBlockOnCityEdge, cityMap, getCityBounds,
  buildRoadPath, getEdgeTouchedZones,
} from './engine';

// ==================== Base Score ====================

export function calcBlockScore(city: PlacedCard[], difficulty: Difficulty): number {
  const largest = largestGroupPerZone(city);
  if (difficulty === 'hard') {
    return Math.max(...Object.values(largest));
  }
  return Object.values(largest).reduce((a, b) => a + b, 0);
}

export function calcRoadTax(city: PlacedCard[], difficulty: Difficulty): number {
  if (difficulty === 'easy') return 0;
  const components = buildRoadComponents(city);
  return -components.length;
}

// ==================== Scoring Conditions ====================

type ScoringFn = (city: PlacedCard[], def: CardDef) => number;

const SCORERS: Record<string, ScoringFn> = {

  // #1 THE OUTSKIRTS: +1pt 都市端でない道路, -1pt 都市端道路
  road_edge(city) {
    const map = cityMap(city);
    let score = 0;
    for (const pc of city) {
      const card = getCard(pc.cardId);
      const edges = getRoadEdges(card, pc.rotation);
      for (const edge of edges) {
        const nb = { T: { x:0,y:-1 }, B:{x:0,y:1}, L:{x:-1,y:0}, R:{x:1,y:0} }[edge];
        const key = `${pc.pos.x+nb.x},${pc.pos.y+nb.y}`;
        if (map.has(key)) score += 0; // 接続済み（内部道路）
        else score += (city.length === 15) ? -1 : +1; // 全カード配置後判定
      }
    }
    // シンプル版: 独立道路の端末ごとにカウント
    const components = buildRoadComponents(city);
    let s = 0;
    for (const comp of components) {
      s += comp.endsAtCityEdge ? -1 : +1;
    }
    return s;
  },

  // #2 BLOOM BOOM: +1pt ちょうど3 Park の行/列, -1pt 0 Park の行/列
  row_col_park(city) {
    return calcRowColPark(city);
  },

  // #3 GO GREEN: +1pt Park ブロック, -3pt Industrial ブロック
  block_count(city, def) {
    // JSON内のゾーン名(例:"park")をZone型の1文字コード(例:'P')にマップ
    const ZONE_NAME_MAP: Record<string, Zone> = {
      commercial: 'C', park: 'P', industrial: 'I', residential: 'R',
      C: 'C', P: 'P', I: 'I', R: 'R',
    };
    const rules = def.scoring.rules as Array<{ zone: string; points_per_block: number }>;
    const blocks = getAllBlocks(city);
    let score = 0;
    for (const rule of rules) {
      const zoneCode = ZONE_NAME_MAP[rule.zone];
      if (!zoneCode) continue;
      const count = blocks.filter(b => b.zone === zoneCode).length;
      score += count * rule.points_per_block;
    }
    return score;
  },

  // #4 BLOCK PARTY: 4コーナー接触同ゾーングループ数でテーブル参照
  table_lookup(city, def) {
    const table = def.scoring.table as Record<string, number>;
    const count = countBlockPartyGroups(city);
    const key = count >= 5 ? '5+' : String(count);
    return table[key] ?? 0;
  },

  // #5 STACKS AND SCRAPERS: 最大Industrial - 最大Residential
  // #6 MASTER PLANNED: 最大Residential - 最大Industrial
  group_comparison(city, def) {
    const rules = def.scoring.rules as Array<{ operation: string; a: string; b: string }>;
    const largest = largestGroupPerZone(city);
    const get = (key: string) =>
      key === 'largest_industrial_group' ? largest.I :
      key === 'largest_residential_group' ? largest.R :
      key === 'largest_commercial_group' ? largest.C :
      key === 'largest_park_group' ? largest.P : 0;
    let score = 0;
    for (const rule of rules) {
      score += rule.operation === 'subtract' ? get(rule.a) - get(rule.b) : 0;
    }
    return score;
  },

  // #7 CENTRAL PERKS: Park内部+6pt, Park端-2pt
  park_position(city) {
    const blocks = getAllBlocks(city);
    const parkBlocks = blocks.filter(b => b.zone === 'P');
    let score = 0;
    for (const b of parkBlocks) {
      score += isBlockOnCityEdge(b, city) ? -2 : 6;
    }
    return score;
  },

  // #8 THE BURRS: 最大Residentialグループに隣接するPark+1, Industrial-2
  adjacency_to_largest_group(city) {
    return calcBurrsScore(city);
  },

  // #9 CONCRETE JUNGLE: Industrial コーナー共有+1pt
  corner_adjacency(city) {
    return calcConcreteJungle(city);
  },

  // #10 THE STRIP: 最良1行/列の Commercial ブロック数
  best_row_or_col(city, def) {
    return calcBestRowOrCol(city, def.scoring.zone as Zone);
  },

  // #11 MINI MARTS: Commercial が同一道路でResidential-Commercial-Residentialの階段パターン+2pt
  road_sandwich(city) {
    return calcMiniMarts(city);
  },

  // #12 SUPERHIGHWAY: 最長道路 ÷ 2 (切捨て)
  longest_road(city) {
    const components = buildRoadComponents(city);
    const maxLen = Math.max(0, ...components.map(c => c.cards.length));
    return Math.floor(maxLen / 2);
  },

  // #13 PARK HOPPING: 異なる2つのParkを結ぶ道路+3pt
  road_park_to_park(city) {
    return calcParkHopping(city);
  },

  // #14 LOOPING LANES: 完成ループのセクション数×1pt (最大12)
  road_loop(city, def) {
    const components = buildRoadComponents(city);
    const max = def.scoring.max_points as number;
    let total = 0;
    for (const comp of components) {
      if (comp.isLoop) total += comp.cards.length;
    }
    return Math.min(total, max);
  },

  // #15 SKID ROW: 2つ以上のIndustrialに隣接するIndustrial+2pt
  industrial_adjacency(city) {
    return calcSkidRow(city);
  },

  // #16 MORNING COMMUTE: ResidentialとCommercial両方を通る道路+2pt
  road_passes_through(city) {
    const components = buildRoadComponents(city);
    let score = 0;
    for (const comp of components) {
      if (comp.touchedZones.has('R') && comp.touchedZones.has('C')) score += 2;
    }
    return score;
  },

  // #17 TOURIST TRAPS: Industrial隣接数が多い側のCommercial+1pt/ブロック
  commercial_industrial_edge(city) {
    return calcTouristTraps(city);
  },

  // #18 SPRAWLOPOLIS: 最良1行/列の全ブロック数 (最大6pt)
  best_row_or_col_all(city, def) {
    return Math.min(calcBestRowOrColAll(city), def.scoring.max_points as number);
  },
};

// ==================== Helper Functions ====================

function calcRowColPark(city: PlacedCard[]): number {
  const blocks = getAllBlocks(city);
  const bounds = getCityBounds(city);
  let score = 0;

  // 行ごと（カード行 × 2ブロック行）
  for (let cy = bounds.minY; cy <= bounds.maxY; cy++) {
    for (let by = 0; by < 2; by++) {
      const absY = cy * 2 + by;
      const row = blocks.filter(b => {
        const [, ay] = [b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0),
                        b.pos.y * 2 + (b.quadrant.startsWith('B') ? 1 : 0)];
        return ay === absY;
      });
      const parkCount = row.filter(b => b.zone === 'P').length;
      if (parkCount === 3) score += 1;
      else if (parkCount === 0) score -= 1;
    }
  }

  // 列ごと
  for (let cx = bounds.minX; cx <= bounds.maxX; cx++) {
    for (let bx = 0; bx < 2; bx++) {
      const absX = cx * 2 + bx;
      const col = blocks.filter(b => {
        const ax = b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0);
        return ax === absX;
      });
      const parkCount = col.filter(b => b.zone === 'P').length;
      if (parkCount === 3) score += 1;
      else if (parkCount === 0) score -= 1;
    }
  }

  return score;
}

function countBlockPartyGroups(city: PlacedCard[]): number {
  const blocks = getAllBlocks(city);
  const positions = new Map(blocks.map(b => {
    const ax = b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0);
    const ay = b.pos.y * 2 + (b.quadrant.startsWith('B') ? 1 : 0);
    return [`${ax},${ay}`, b.zone];
  }));

  let count = 0;
  for (const [key, zone] of positions) {
    const [ax, ay] = key.split(',').map(Number);
    // 2×2コーナー接触グループのチェック（自分+右+下+右下）
    const candidates = [
      [ax, ay], [ax+1, ay], [ax, ay+1], [ax+1, ay+1]
    ];
    if (candidates.every(([x, y]) => positions.get(`${x},${y}`) === zone)) {
      count++;
    }
  }
  return count;
}

function calcBurrsScore(city: PlacedCard[]): number {
  const groups = findBlockGroups(city);
  const resGroups = groups.filter(g => g.zone === 'R');
  if (resGroups.length === 0) return 0;
  const maxRes = Math.max(...resGroups.map(g => g.size));
  const largestRes = resGroups.find(g => g.size === maxRes)!;

  // 最大Residentialグループの隣接ブロックを調べる
  const resKeys = new Set(largestRes.cells.map(c => {
    const ax = c.pos.x * 2 + (c.quadrant.endsWith('R') ? 1 : 0);
    const ay = c.pos.y * 2 + (c.quadrant.startsWith('B') ? 1 : 0);
    return `${ax},${ay}`;
  }));

  const allBlocks = getAllBlocks(city);
  const blockMap = new Map(allBlocks.map(b => {
    const ax = b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0);
    const ay = b.pos.y * 2 + (b.quadrant.startsWith('B') ? 1 : 0);
    return [`${ax},${ay}`, b.zone];
  }));

  let score = 0;
  const counted = new Set<string>();
  for (const key of resKeys) {
    const [ax, ay] = key.split(',').map(Number);
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nk = `${ax+dx},${ay+dy}`;
      if (resKeys.has(nk) || counted.has(nk)) continue;
      const zone = blockMap.get(nk);
      if (zone === 'P') { score += 1; counted.add(nk); }
      else if (zone === 'I') { score -= 2; counted.add(nk); }
    }
  }
  return score;
}

function calcConcreteJungle(city: PlacedCard[]): number {
  const blocks = getAllBlocks(city);
  const indBlocks = blocks.filter(b => b.zone === 'I');
  const keySet = new Set(blocks.filter(b => b.zone === 'I').map(b => {
    const ax = b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0);
    const ay = b.pos.y * 2 + (b.quadrant.startsWith('B') ? 1 : 0);
    return `${ax},${ay}`;
  }));

  let score = 0;
  for (const b of indBlocks) {
    const ax = b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0);
    const ay = b.pos.y * 2 + (b.quadrant.startsWith('B') ? 1 : 0);
    const hasCornerIndustrial = [
      [-1,-1],[-1,1],[1,-1],[1,1]
    ].some(([dx,dy]) => keySet.has(`${ax+dx},${ay+dy}`));
    if (hasCornerIndustrial) score += 1;
  }
  return score;
}

function calcBestRowOrCol(city: PlacedCard[], zone: Zone): number {
  const blocks = getAllBlocks(city);
  const bounds = getCityBounds(city);
  let best = 0;

  for (let cy = bounds.minY; cy <= bounds.maxY; cy++) {
    for (let by = 0; by < 2; by++) {
      const absY = cy * 2 + by;
      const row = blocks.filter(b =>
        b.pos.y * 2 + (b.quadrant.startsWith('B') ? 1 : 0) === absY
      );
      best = Math.max(best, row.filter(b => b.zone === zone).length);
    }
  }

  for (let cx = bounds.minX; cx <= bounds.maxX; cx++) {
    for (let bx = 0; bx < 2; bx++) {
      const absX = cx * 2 + bx;
      const col = blocks.filter(b =>
        b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0) === absX
      );
      best = Math.max(best, col.filter(b => b.zone === zone).length);
    }
  }
  return best;
}

function calcBestRowOrColAll(city: PlacedCard[]): number {
  const blocks = getAllBlocks(city);
  const bounds = getCityBounds(city);
  let best = 0;

  for (let cy = bounds.minY; cy <= bounds.maxY; cy++) {
    for (let by = 0; by < 2; by++) {
      const absY = cy * 2 + by;
      best = Math.max(best, blocks.filter(b =>
        b.pos.y * 2 + (b.quadrant.startsWith('B') ? 1 : 0) === absY
      ).length);
    }
  }
  for (let cx = bounds.minX; cx <= bounds.maxX; cx++) {
    for (let bx = 0; bx < 2; bx++) {
      const absX = cx * 2 + bx;
      best = Math.max(best, blocks.filter(b =>
        b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0) === absX
      ).length);
    }
  }
  return best;
}

function calcMiniMarts(city: PlacedCard[]): number {
  /**
   * MINI MARTS: 道路経路上で R-C-R の連続パターンを検出
   *
   * 連続する3枚 (prev, curr, next) の接続辺ゾーンを検査:
   *   - prev が curr 方向の辺で R に接触している
   *   - curr の全道路接触ゾーンに C が含まれる
   *   - next が curr 方向の辺で R に接触している
   * → +2pt
   */
  const components = buildRoadComponents(city);
  let score = 0;

  for (const comp of components) {
    if (comp.cards.length < 3) continue;
    const path = buildRoadPath(comp.cards);

    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const next = path[i + 1];

      // prev の「curr方向の辺」= findConnectingEdge(prev, curr) = prev→curr
      const prevToCurrEdge = findConnectingEdge(prev, curr);
      // next の「curr方向の辺」= findConnectingEdge(next, curr) = next→curr
      const nextToCurrEdge = findConnectingEdge(next, curr);
      if (!prevToCurrEdge || !nextToCurrEdge) continue;

      // prev の出口辺（curr 方向）でのゾーン
      const prevExitZones = getEdgeTouchedZones(prev, prevToCurrEdge);
      // next の出口辺（curr 方向）でのゾーン
      const nextExitZones = getEdgeTouchedZones(next, nextToCurrEdge);
      // curr の全道路接触ゾーン
      const currZones = getRoadTouchedZones(getCard(curr.cardId), curr.rotation);

      const prevHasR = prevExitZones.some(z => z === 'R');
      const nextHasR = nextExitZones.some(z => z === 'R');
      const currHasC = currZones.has('C');

      if (prevHasR && currHasC && nextHasR) {
        score += 2;
      }
    }
  }

  return score;
}

/** 2枚のカード間の接続辺を返す (a の視点) */
function findConnectingEdge(
  a: PlacedCard,
  b: PlacedCard,
): import('./types').Edge | null {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const dirMap: Record<string, import('./types').Edge> = {
    '0,-1': 'T', '0,1': 'B', '-1,0': 'L', '1,0': 'R',
  };
  return dirMap[`${dx},${dy}`] ?? null;
}

function calcParkHopping(city: PlacedCard[]): number {
  const components = buildRoadComponents(city);
  let score = 0;
  for (const comp of components) {
    const parkCards = comp.cards.filter(pc => {
      const blocks = getBlocks(getCard(pc.cardId), pc.rotation);
      const edges = getRoadEdges(getCard(pc.cardId), pc.rotation);
      // 道路が接触するゾーンにParkが含まれるか
      return edges.some(e => EDGE_QUADS[e].some(q => getZoneAt(blocks, q) === 'P'));
    });
    if (parkCards.length >= 2) score += 3;
  }
  return score;
}

function calcSkidRow(city: PlacedCard[]): number {
  const blocks = getAllBlocks(city);
  const indKeys = new Set(blocks.filter(b => b.zone === 'I').map(b => {
    const ax = b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0);
    const ay = b.pos.y * 2 + (b.quadrant.startsWith('B') ? 1 : 0);
    return `${ax},${ay}`;
  }));

  let score = 0;
  for (const b of blocks.filter(b => b.zone === 'I')) {
    const ax = b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0);
    const ay = b.pos.y * 2 + (b.quadrant.startsWith('B') ? 1 : 0);
    const adjCount = [[0,-1],[0,1],[-1,0],[1,0]]
      .filter(([dx,dy]) => indKeys.has(`${ax+dx},${ay+dy}`)).length;
    if (adjCount >= 2) score += 2;
  }
  return score;
}

function calcTouristTraps(city: PlacedCard[]): number {
  const blocks = getAllBlocks(city);
  const blockMap = new Map(blocks.map(b => {
    const ax = b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0);
    const ay = b.pos.y * 2 + (b.quadrant.startsWith('B') ? 1 : 0);
    return [`${ax},${ay}`, b.zone];
  }));

  let score = 0;
  for (const b of blocks.filter(b => b.zone === 'C')) {
    const ax = b.pos.x * 2 + (b.quadrant.endsWith('R') ? 1 : 0);
    const ay = b.pos.y * 2 + (b.quadrant.startsWith('B') ? 1 : 0);
    const indAdj = [[0,-1],[0,1],[-1,0],[1,0]]
      .filter(([dx,dy]) => blockMap.get(`${ax+dx},${ay+dy}`) === 'I').length;
    const othAdj = [[0,-1],[0,1],[-1,0],[1,0]]
      .filter(([dx,dy]) => {
        const z = blockMap.get(`${ax+dx},${ay+dy}`);
        return z && z !== 'I';
      }).length;
    if (indAdj > othAdj) score += 1 + indAdj;
  }
  return score;
}

// ==================== Main Score Calculator ====================

export function calcScore(
  city: PlacedCard[],
  scoringCards: CardDef[],
  difficulty: Difficulty,
  targetScore: number,
): ScoreBreakdown {
  const largest = largestGroupPerZone(city);
  const blockScore = difficulty === 'hard'
    ? Math.max(...Object.values(largest))
    : Object.values(largest).reduce((a, b) => a + b, 0);

  const roadComponents = buildRoadComponents(city);
  const roadTax = difficulty === 'easy' ? 0 : -roadComponents.length;

  const conditionScores = scoringCards.map(card => {
    const fn = SCORERS[card.scoring.type];
    return fn ? fn(city, card) : 0;
  });

  const total = blockScore + roadTax + conditionScores.reduce((a, b) => a + b, 0);

  return {
    blockScore,
    roadTax,
    conditionScores,
    total,
    targetScore,
    win: total >= targetScore,
    detail: {
      largestGroups: largest,
      roadCount: roadComponents.length,
      conditions: scoringCards.map((card, i) => ({
        name: card.name,
        score: conditionScores[i],
      })),
    },
  };
}
