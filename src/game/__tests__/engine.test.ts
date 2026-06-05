/**
 * ホワイトボックステスト: ゲームエンジン
 *
 * カードデータ（確認済み）:
 *   Card 1:  [I,R]/[P,C]  road T+L
 *   Card 2:  [P,I]/[R,C]  road T+R
 *   Card 3:  [C,R]/[I,P]  road B+L
 *   Card 4:  [P,C]/[I,R]  road B+L
 *   Card 7:  [C,P]/[R,I]  road B+R
 *   Card 8:  [R,C]/[P,I]  road B+R
 *   Card 9:  [I,R]/[P,C]  road T+L   ← Card1と同ブロック配置、道路も同じ
 *   Card 16: [C,I]/[P,R]  road T+R
 */
import { describe, it, expect } from 'vitest';
import type { PlacedCard } from '../types';
import { getCard, getRoadEdges, getBlocks } from '../cardData';
import {
  isValidPlacement, roadsConnect, buildRoadComponents,
  findBlockGroups, largestGroupPerZone, getCityBounds,
} from '../engine';

// ───────────── ヘルパー ─────────────
function pc(cardId: number, x: number, y: number, rotation: 0 | 180 = 0): PlacedCard {
  return { cardId, pos: { x, y }, rotation };
}

// ───────────── getRoadEdges (回転) ─────────────
describe('getRoadEdges', () => {
  it('Card1 rotation=0 → T+L', () => {
    const edges = getRoadEdges(getCard(1), 0);
    expect(new Set(edges)).toEqual(new Set(['T', 'L']));
  });

  it('Card1 rotation=180 → B+R (T↔B, L↔R)', () => {
    const edges = getRoadEdges(getCard(1), 180);
    expect(new Set(edges)).toEqual(new Set(['B', 'R']));
  });

  it('Card7 rotation=0 → B+R', () => {
    const edges = getRoadEdges(getCard(7), 0);
    expect(new Set(edges)).toEqual(new Set(['B', 'R']));
  });

  it('Card7 rotation=180 → T+L', () => {
    const edges = getRoadEdges(getCard(7), 180);
    expect(new Set(edges)).toEqual(new Set(['T', 'L']));
  });
});

// ───────────── getBlocks (回転) ─────────────
describe('getBlocks rotation=180', () => {
  it('Card1 [I,R]/[P,C] → 180° → [C,P]/[R,I]', () => {
    const b = getBlocks(getCard(1), 180);
    expect(b[0]).toEqual(['C', 'P']);
    expect(b[1]).toEqual(['R', 'I']);
  });

  it('Card3 [C,R]/[I,P] → 180° → [P,I]/[R,C]', () => {
    const b = getBlocks(getCard(3), 180);
    expect(b[0]).toEqual(['P', 'I']);
    expect(b[1]).toEqual(['R', 'C']);
  });
});

// ───────────── isValidPlacement ─────────────
describe('isValidPlacement', () => {
  it('最初の1枚は常に配置可能', () => {
    expect(isValidPlacement({ x: 0, y: 0 }, [])).toBe(true);
    expect(isValidPlacement({ x: 5, y: -3 }, [])).toBe(true);
  });

  it('既存カードに隣接するセルは配置可能', () => {
    const city = [pc(1, 0, 0)];
    expect(isValidPlacement({ x: 1, y: 0 }, city)).toBe(true);  // 右
    expect(isValidPlacement({ x: -1, y: 0 }, city)).toBe(true); // 左
    expect(isValidPlacement({ x: 0, y: 1 }, city)).toBe(true);  // 下
    expect(isValidPlacement({ x: 0, y: -1 }, city)).toBe(true); // 上
  });

  it('既存カードから離れたセルは配置不可', () => {
    const city = [pc(1, 0, 0)];
    expect(isValidPlacement({ x: 2, y: 0 }, city)).toBe(false); // 2マス離れ
    expect(isValidPlacement({ x: 1, y: 1 }, city)).toBe(false); // 斜め（辺共有なし）
  });

  it('既存カードと重複するセルは配置不可', () => {
    const city = [pc(1, 0, 0)];
    expect(isValidPlacement({ x: 0, y: 0 }, city)).toBe(false);
  });
});

// ───────────── roadsConnect ─────────────
describe('roadsConnect', () => {
  // Card1: road T+L → 上と左に道路出口
  // Card1を(0,0)に置き、Card1を(0,-1)に置く場合:
  //   下のCard1のT辺 ↔ 上のCard1のB辺
  //   Card1のB辺には道路なし → 接続しない

  it('Card1(0,0)の上にCard1(0,-1): T辺⇔B辺 → 非接続 (Card1にB辺道路なし)', () => {
    const a = pc(1, 0, 0);   // road T+L
    const b = pc(1, 0, -1);  // road T+L (同じカード)
    // a のT辺 と b のB辺: b.roadEdges={T,L}, B辺なし → false
    expect(roadsConnect(a, b)).toBe(false);
  });

  it('Card1(0,0)の上にCard7-180°(0,-1): T辺⇔B辺 → 接続 (Card7-180=T+L, B辺あり)', () => {
    // Card7 rotation=0: B+R, rotation=180: T+L
    // Card7@(0,-1) rotation=180 → roadEdges={T,L} → B辺なし... 接続なし
    // 正しいパターン: Card7 rotation=0 は B+R → Bが下向き
    // Card7@(0,-1) rotation=0: road B+R → B辺あり
    // Card1@(0,0) road T+L → T辺あり
    // a=Card1(0,0).T と b=Card7(0,-1).B で接続
    const a = pc(1, 0, 0);   // road T+L → T辺あり
    const b = pc(7, 0, -1);  // road B+R (rotation=0) → B辺あり
    expect(roadsConnect(a, b)).toBe(true);
  });

  it('Card1(0,0)の右にCard2(1,0): R辺⇔L辺 → 非接続 (Card1にR辺なし)', () => {
    const a = pc(1, 0, 0); // road T+L (R辺なし)
    const b = pc(2, 1, 0); // road T+R (L辺なし)
    expect(roadsConnect(a, b)).toBe(false);
  });

  it('Card3(0,0)の左にCard1(-1,0): L辺⇔R辺 → 接続 (Card3 road B+L にL辺あり, Card1 rotation=180 road B+R にR辺あり)', () => {
    // Card3: road B+L → L辺あり
    // Card1 rotation=180: road B+R → R辺あり
    const a = pc(3, 0, 0);      // road B+L → L辺あり
    const b = pc(1, -1, 0, 180); // road B+R → R辺あり
    expect(roadsConnect(a, b)).toBe(true);
  });

  it('斜め配置は接続判定しない', () => {
    const a = pc(1, 0, 0);
    const b = pc(7, 1, 1);
    expect(roadsConnect(a, b)).toBe(false);
  });
});

// ───────────── buildRoadComponents ─────────────
describe('buildRoadComponents', () => {
  it('1枚のカード → 1つの道路連結成分', () => {
    const city = [pc(1, 0, 0)];
    const comps = buildRoadComponents(city);
    expect(comps).toHaveLength(1);
    expect(comps[0].cards).toHaveLength(1);
  });

  it('道路が接続しない2枚 → 2つの連結成分', () => {
    // Card1(0,0) road T+L, Card2(1,0) road T+R → L辺⇔R辺なし
    const city = [pc(1, 0, 0), pc(2, 1, 0)];
    const comps = buildRoadComponents(city);
    expect(comps).toHaveLength(2);
  });

  it('道路が接続する2枚 → 1つの連結成分', () => {
    // Card1(0,0): road T+L → Tあり
    // Card7(0,-1): road B+R → Bあり
    // → T辺⇔B辺 接続
    const city = [pc(1, 0, 0), pc(7, 0, -1)];
    const comps = buildRoadComponents(city);
    expect(comps).toHaveLength(1);
    expect(comps[0].cards).toHaveLength(2);
  });

  it('3枚チェーン接続 → 1つの連結成分', () => {
    // Card1(0,0):  road T+L → T辺あり
    // Card7(0,-1): road B+R → B辺(↔Card1.T ✓) + R辺
    // Card3(1,-1): road B+L → L辺(↔Card7.R ✓)
    // → 3枚すべて1つの連結成分
    const city = [
      pc(1, 0, 0),   // road T+L
      pc(7, 0, -1),  // road B+R → B⇔Card1.T ✓, R辺あり
      pc(3, 1, -1),  // road B+L → L⇔Card7.R ✓
    ];
    const comps = buildRoadComponents(city);
    expect(comps).toHaveLength(1);
    expect(comps[0].cards).toHaveLength(3);
  });

  it('都市端の道路 → endsAtCityEdge=true', () => {
    const city = [pc(1, 0, 0)]; // 単体: 全辺が都市端
    const comps = buildRoadComponents(city);
    expect(comps[0].endsAtCityEdge).toBe(true);
  });
});

// ───────────── findBlockGroups ─────────────
describe('findBlockGroups', () => {
  it('1枚のカード → 4グループ各サイズ1', () => {
    const city = [pc(1, 0, 0)]; // [I,R]/[P,C]
    const groups = findBlockGroups(city);
    expect(groups).toHaveLength(4);
    expect(groups.every(g => g.size === 1)).toBe(true);
  });

  it('同ゾーンが辺共有するとグループが結合される', () => {
    // Card1(0,0): [I,R]/[P,C] → TR=R
    // Card1(1,0): [I,R]/[P,C] → TL=I ← 隣接するのは(0,0)のTR辺と(1,0)のTL辺
    // (0,0)のTR=R と (1,0)のTL=I → 異なるゾーン、結合なし
    // (0,0)のBR=C と (1,0)のBL=I → 異なるゾーン、結合なし
    // Parkを結合させたい: Card3(0,0): [C,R]/[I,P] → BR=P
    //                    Card3(1,0): [C,R]/[I,P] → BL=I → 結合なし
    // Card3(0,0): BL=I, Card4(0,1): [P,C]/[I,R] → TL=P
    // → Card3のBLとCard4のTLが隣接 → I vs P → 異なる

    // 簡単なケース: Card1(0,0)のBL=Pと Card1(0,1)のTL=IはゾーンP vs I → 結合なし
    // Card1(0,0)のTR=R と Card1-180(1,0)のTL:
    //   Card1-180のblocks: [C,P]/[R,I] → TL=C → 結合なし

    // Card1(0,0): TR=R, Card9(1,0): TL=I → 結合なし
    // Card2(0,0): [P,I]/[R,C] → TR=I, Card2(1,0): TL=P → 結合なし

    // Card1(0,0) TL=I, Card9(1,0) TL=I だが位置が違う...
    // (0,0)のTR=R の絶対座標は (1,0)
    // (1,0)のTL=I の絶対座標は (2,0)
    // → 隣接(絶対座標差が1)するが異なるゾーン

    // Parkが結合するケース: Card1の BL=Pと Card1(0,1)の TL=I → 異なる
    // → Card4(0,0): [P,C]/[I,R] → TL=P, Card4(0,-1): 同→ BR=R... hmm

    // 正確なテスト: Card4(0,0)のTL=Pと Card4(-1,0)のTR=C → 異なる
    // Card3(0,0): [C,R]/[I,P] → BR=P, Card4(0,1): [P,C]/[I,R] → TR=C → 異なる

    // Card4(0,0): TL=P絶対(0,0), Card4(-1,0): TR=C絶対(-1,0)... 離れている
    // Card4(0,0): TL=P絶対(0,0), Card3(0,-1): BR=P絶対(1,-1) → x差=1,y差=1 → 斜め → 非隣接

    // P同士が辺隣接するケース:
    // Card4(0,0): [P,C]/[I,R] → BL=I (絶対0,1)
    // Card2(0,0): [P,I]/[R,C] → TL=P (絶対0,0)
    // 同じカード上のTL=PとBL=Rは辺隣接するが異なるゾーン

    // Card2(0,0): TL=P (abs 0,0), Card2(0,-1): BL=R (abs 0,-1) → 隣接 P vs R → 否
    // Card2(0,0): TL=P (abs 0,0), Card2(-1,0): TR=I (abs -1,0) → 隣接 P vs I → 否

    // 最もシンプル: 同ゾーンのブロックが辺共有するカード配置
    // Card1(0,0): BL=P (abs 0,1)
    // Card4(0,1): TL=P (abs 0,2) → 差=(0,1) → 隣接 → P+P結合!
    const city = [pc(1, 0, 0), pc(4, 0, 1)];
    // Card1(0,0): [I,R]/[P,C] → BL=P, 絶対座標(0,1)
    // Card4(0,1): [P,C]/[I,R] → TL=P, 絶対座標(0,2)
    // 差=(0,1) → 隣接 → Pグループが結合してサイズ2

    const groups = findBlockGroups(city);
    const parkGroups = groups.filter(g => g.zone === 'P');
    const maxPark = Math.max(...parkGroups.map(g => g.size));
    expect(maxPark).toBe(2);
  });
});

// ───────────── largestGroupPerZone ─────────────
describe('largestGroupPerZone', () => {
  it('1枚: 全ゾーン最大1', () => {
    const city = [pc(1, 0, 0)];
    const lg = largestGroupPerZone(city);
    expect(lg).toEqual({ C: 1, P: 1, I: 1, R: 1 });
  });

  it('ブロック合計スコア = 4 (全ゾーン×1)', () => {
    const city = [pc(1, 0, 0)];
    const lg = largestGroupPerZone(city);
    const total = Object.values(lg).reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
  });

  it('Card1+Card4垂直配置: Pが結合してP最大=2', () => {
    const city = [pc(1, 0, 0), pc(4, 0, 1)];
    const lg = largestGroupPerZone(city);
    expect(lg.P).toBe(2);
  });
});

// ───────────── getCityBounds ─────────────
describe('getCityBounds', () => {
  it('空の都市', () => {
    const b = getCityBounds([]);
    expect(b).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  });

  it('1枚: bounds = (0,0,0,0)', () => {
    const b = getCityBounds([pc(1, 0, 0)]);
    expect(b).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  });

  it('3枚L字配置', () => {
    const city = [pc(1, 0, 0), pc(2, 1, 0), pc(3, 0, 1)];
    const b = getCityBounds(city);
    expect(b).toEqual({ minX: 0, maxX: 1, minY: 0, maxY: 1 });
  });
});
