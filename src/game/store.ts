import { create } from 'zustand';
import type { GameState, PlacedCard, GridPos, Difficulty, ScoreBreakdown } from './types';
import { getCard, getRoadEdges } from './cardData';
import { isValidPlacement } from './engine';
import { calcScore } from './scoring';

const ALL_IDS = Array.from({ length: 18 }, (_, i) => i + 1);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface GameStore {
  state: GameState | null;
  selectedCardId: number | null;
  rotation: 0 | 180;
  scoreBreakdown: ScoreBreakdown | null;
  hoveredPos: GridPos | null;

  // Actions
  initGame: (difficulty: Difficulty, playerCount: number) => void;
  selectCard: (cardId: number | null) => void;
  toggleRotation: () => void;
  setHoveredPos: (pos: GridPos | null) => void;
  placeCard: (pos: GridPos) => void;
  calcFinalScore: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  selectedCardId: null,
  rotation: 0,
  scoreBreakdown: null,
  hoveredPos: null,

  initGame(difficulty, playerCount) {
    const shuffled = shuffle(ALL_IDS);
    // 先頭3枚をスコアリングカード、残り15枚を山札
    const scoringIds = shuffled.slice(0, 3);
    const deckIds = shuffled.slice(3);

    const targetScore = scoringIds.reduce((s, id) => s + id, 0);

    // 先頭1枚を都市の最初のカードとして配置
    const firstCardId = deckIds.shift()!;
    const firstCard: PlacedCard = { cardId: firstCardId, pos: { x: 0, y: 0 }, rotation: 0 };

    // 手札を配る（ソロ: 2枚, 2-4人: 各1枚 → 手札合計 = playerCount枚）
    const handSize = playerCount === 1 ? 2 : playerCount;
    const hand = deckIds.splice(0, handSize);

    set({
      state: {
        difficulty,
        scoringCards: scoringIds.map(id => getCard(id)),
        targetScore,
        city: [firstCard],
        deck: deckIds,
        hand,
        playerCount,
        currentPlayer: 0,
        phase: 'playing',
      },
      selectedCardId: null,
      rotation: 0,
      scoreBreakdown: null,
      hoveredPos: null,
    });
  },

  selectCard(cardId) {
    set({ selectedCardId: cardId, rotation: 0 });
  },

  toggleRotation() {
    set(s => ({ rotation: s.rotation === 0 ? 180 : 0 }));
  },

  setHoveredPos(pos) {
    set({ hoveredPos: pos });
  },

  placeCard(pos) {
    const { state, selectedCardId, rotation } = get();
    if (!state || selectedCardId === null) return;
    if (!isValidPlacement(pos, state.city)) return;

    const newCard: PlacedCard = { cardId: selectedCardId, pos, rotation };
    const newCity = [...state.city, newCard];

    // 手札から除去
    const newHand = state.hand.filter(id => id !== selectedCardId);

    // 山札から1枚補充
    const newDeck = [...state.deck];
    if (newDeck.length > 0) {
      newHand.push(newDeck.shift()!);
    }

    // ゲーム終了チェック（全15枚配置）
    const isFinished = newCity.length >= 15;

    set({
      state: {
        ...state,
        city: newCity,
        hand: newHand,
        deck: newDeck,
        phase: isFinished ? 'scoring' : 'playing',
      },
      selectedCardId: null,
      rotation: 0,
    });

    if (isFinished) get().calcFinalScore();
  },

  calcFinalScore() {
    const { state } = get();
    if (!state) return;
    const breakdown = calcScore(
      state.city,
      state.scoringCards,
      state.difficulty,
      state.targetScore,
    );
    set({ scoreBreakdown: breakdown });
  },

  resetGame() {
    set({ state: null, selectedCardId: null, rotation: 0, scoreBreakdown: null });
  },

  // DEV ONLY: ゲーム終了状態を強制してScoreModalをテスト
  devForceScoring() {
    const { state } = get();
    if (!state) return;
    set({ state: { ...state, phase: 'scoring' } });
    get().calcFinalScore();
  },
}));

// dev モードでブラウザコンソールからアクセス可能にする
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__gameStore = useGameStore;
}
