// ==================== Zone & Block ====================

export type Zone = 'C' | 'P' | 'I' | 'R'; // Commercial, Park, Industrial, Residential
export type Edge = 'T' | 'B' | 'L' | 'R';
export type Rotation = 0 | 180;
export type Quadrant = 'TL' | 'TR' | 'BL' | 'BR';

// 2×2 ブロックグリッド: [row][col]  row0=top, col0=left
export type BlockGrid = [[Zone, Zone], [Zone, Zone]];

// ==================== Card Definition ====================

export interface ScoringRule {
  type: string;
  description: string;
  [key: string]: unknown;
}

export interface CardDef {
  id: number;           // 1-18（ターゲットスコア計算にも使用）
  name: string;
  number: number;
  blocks: BlockGrid;
  road_edges: [Edge, Edge]; // 常に隣接2辺（Industrial象限の2辺）
  road_quadrant: Quadrant;
  scoring: ScoringRule;
}

// ==================== Placed Card ====================

export interface GridPos {
  x: number; // 列 (右が+)
  y: number; // 行 (下が+)
}

export interface PlacedCard {
  cardId: number;
  pos: GridPos;
  rotation: Rotation;
}

// ==================== Road Network ====================

export interface RoadComponent {
  cards: PlacedCard[];         // この連結成分に属するカード
  touchedZones: Set<Zone>;     // 道路が接触するゾーン集合
  isLoop: boolean;             // ループを形成するか
  endsAtCityEdge: boolean;     // 都市端で終わるか
}

// ==================== Block Groups ====================

export interface BlockGroup {
  zone: Zone;
  cells: Array<{ pos: GridPos; quadrant: Quadrant }>;
  size: number;
}

// ==================== Game State ====================

export type Difficulty = 'easy' | 'normal' | 'hard';
export type GamePhase = 'setup' | 'playing' | 'scoring';

export interface GameState {
  difficulty: Difficulty;
  scoringCards: CardDef[];    // 公開中の3枚（スコアリング条件）
  targetScore: number;        // スコアリングカードの番号合計
  city: PlacedCard[];
  deck: number[];             // カードIDの配列（残り山札）
  hand: number[];             // 手札カードID（ソロ: 最大3枚）
  playerCount: number;
  currentPlayer: number;
  phase: GamePhase;
}

// ==================== Score Breakdown ====================

export interface ScoreBreakdown {
  blockScore: number;         // 4ゾーン最大グループ合計
  roadTax: number;            // 独立道路本数（負の値）
  conditionScores: number[];  // スコアリング条件3枚分
  total: number;
  targetScore: number;
  win: boolean;
  detail: {
    largestGroups: Record<Zone, number>;  // ゾーン別最大グループサイズ
    roadCount: number;                    // 独立道路数
    conditions: Array<{ name: string; score: number }>;
  };
}
