import { useGameStore } from '../game/store';
import { getCard } from '../game/cardData';
import { CardSvg } from './CardSvg';
import { largestGroupPerZone, buildRoadComponents } from '../game/engine';

const ZONE_LABEL = { C: '商業(C)', P: '公園(P)', I: '工業(I)', R: '住宅(R)' } as const;
const ZONE_COLOR = { C: '#5b9bd5', P: '#70ad47', I: '#8c8c8c', R: '#ed7d31' } as const;

export function SidePanel() {
  const { state, scoreBreakdown, calcFinalScore, resetGame } = useGameStore();
  if (!state) return null;

  const largest = largestGroupPerZone(state.city);
  const roadComps = buildRoadComponents(state.city);
  const currentBlock = Object.values(largest).reduce((a, b) => a + b, 0);
  const currentRoadTax = state.difficulty === 'easy' ? 0 : -roadComps.length;

  return (
    <div style={{
      width: 220,
      background: '#12122a',
      borderLeft: '2px solid #2d2d44',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      padding: '12px 10px',
      gap: 12,
      fontSize: 12,
      color: '#ccc',
    }}>
      {/* ターゲットスコア */}
      <div style={{ textAlign: 'center', padding: 8, background: '#2d2d44', borderRadius: 6 }}>
        <div style={{ color: '#888', fontSize: 11 }}>ターゲットスコア</div>
        <div style={{ color: '#ffe66d', fontSize: 28, fontWeight: 'bold' }}>
          {state.targetScore}
        </div>
        <div style={{ color: '#555', fontSize: 10 }}>
          ({state.scoringCards.map(c => c.id).join(' + ')} = {state.targetScore})
        </div>
      </div>

      {/* スコアリング条件カード */}
      <div>
        <div style={{ color: '#4ecdc4', marginBottom: 6, fontWeight: 'bold' }}>
          スコアリング条件
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {state.scoringCards.map(card => (
            <div key={card.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <CardSvg card={card} rotation={0} width={40} height={55} />
              <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>
                <div style={{ color: '#ffe66d', fontWeight: 'bold' }}>#{card.id} {card.name}</div>
                <div>{card.scoring.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* リアルタイムスコア */}
      <div>
        <div style={{ color: '#4ecdc4', marginBottom: 6, fontWeight: 'bold' }}>現在のスコア</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {(['R','C','I','P'] as const).map(z => (
            <div key={z} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: ZONE_COLOR[z] }}>最大{ZONE_LABEL[z]}</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>+{largest[z]}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #333', marginTop: 3, paddingTop: 3,
            display: 'flex', justifyContent: 'space-between' }}>
            <span>ブロック計</span>
            <span style={{ color: '#4ecdc4', fontWeight: 'bold' }}>+{currentBlock}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>道路({roadComps.length}本)</span>
            <span style={{ color: currentRoadTax < 0 ? '#ff6b6b' : '#888' }}>
              {currentRoadTax}
            </span>
          </div>
          <div style={{ borderTop: '1px solid #555', marginTop: 3, paddingTop: 3,
            display: 'flex', justifyContent: 'space-between' }}>
            <span>合計 (条件抜き)</span>
            <span style={{
              color: currentBlock + currentRoadTax >= state.targetScore ? '#70ad47' : '#ff6b6b',
              fontWeight: 'bold', fontSize: 14,
            }}>
              {currentBlock + currentRoadTax}
            </span>
          </div>
        </div>
      </div>

      {/* 難易度 */}
      <div style={{ fontSize: 10, color: '#555' }}>
        難易度: {state.difficulty === 'easy' ? 'EASY(道路タックスなし)' :
                  state.difficulty === 'hard' ? 'HARD(1ゾーンのみ)' : 'NORMAL'}
      </div>

      {/* ゲーム終了後スコア */}
      {state.phase === 'scoring' && scoreBreakdown && (
        <div style={{
          background: scoreBreakdown.win ? '#1a3a1a' : '#3a1a1a',
          border: `2px solid ${scoreBreakdown.win ? '#70ad47' : '#ff6b6b'}`,
          borderRadius: 8, padding: 10, marginTop: 4,
        }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', textAlign: 'center',
            color: scoreBreakdown.win ? '#70ad47' : '#ff6b6b' }}>
            {scoreBreakdown.win ? '🏆 WIN!' : '💀 LOSE'}
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {scoreBreakdown.detail.conditions.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: '#aaa' }}>{c.name}</span>
                <span style={{ color: c.score >= 0 ? '#4ecdc4' : '#ff6b6b' }}>
                  {c.score >= 0 ? '+' : ''}{c.score}
                </span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #555', paddingTop: 4, marginTop: 2,
              display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 'bold' }}>最終スコア</span>
              <span style={{ fontSize: 16, fontWeight: 'bold',
                color: scoreBreakdown.win ? '#70ad47' : '#ff6b6b' }}>
                {scoreBreakdown.total} / {scoreBreakdown.targetScore}
              </span>
            </div>
          </div>
          <button onClick={resetGame} style={{
            marginTop: 10, width: '100%',
            background: '#2d2d44', border: '1px solid #4ecdc4',
            color: '#4ecdc4', borderRadius: 6, padding: '6px 0',
            cursor: 'pointer', fontSize: 12,
          }}>もう一度プレイ</button>
        </div>
      )}
    </div>
  );
}
